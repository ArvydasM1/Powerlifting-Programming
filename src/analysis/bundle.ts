/** §15.4 analysis bundle: one reduced, versioned view of the lifter's data. */
import { TEMPLATES } from "../../templates";
import type { AppDB } from "@/data/db";
import type { Exercise, Session, SessionVitals, WorkoutSet } from "@/domain/types";
import { runChecks, type CheckFact } from "./checks";

export interface BundleOptions {
  includeHealth: boolean;
  includeNotes: boolean;
  now?: Date;
}

export interface Bundle {
  schemaVersion: 1;
  generatedAt: string;
  settings: { roundingStep: number; unit: string; cycleIncrease: Record<string, number> };
  trainingMax: Array<{ lift: string; value: number; effectiveFrom: string; source: string }>;
  currentTM: Record<string, number>;
  programs: Array<{ id: string; templateId: string; startDate: string; status: string; options: unknown; baseTM: unknown }>;
  sessions: Array<Record<string, unknown>>;
  olderSessions: Array<Record<string, unknown>>;
  prs: Array<{ lift: string; date: string | null; weight: number; reps: number; e1rm: number | null; source: string }>;
  vitals?: Array<Record<string, unknown>>;
  templates: Array<{ id: string; name: string; daysPerWeek: number; description: string; phases: Array<{ name: string; tmOffset: number }> }>;
  assistanceCatalogue: Array<{ id: string; name: string; category?: string }>;
  facts: CheckFact[];
}

const FULL_WEEKS = 26;

export async function buildBundle(db: AppDB, opts: BundleOptions): Promise<{ bundle: Bundle; json: string; hash: string }> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - FULL_WEEKS * 7 * 86_400_000).toISOString().slice(0, 10);
  const settings = await db.settings.get("settings");
  const tmRows = await db.trainingMax.orderBy("effectiveFrom").toArray();
  const programs = await db.programs.toArray();
  const sessions = (await db.sessions.toArray()).filter((s) => s.status === "done" || s.status === "backfilled" || s.status === "skipped");
  const sets = await db.sets.toArray();
  const prs = await db.prRecords.toArray();
  const vitals = opts.includeHealth ? await db.sessionVitals.toArray() : [];
  const exercises = await db.exercises.toArray();
  const currentTM: Record<string, number> = {};
  for (const r of tmRows) currentTM[r.lift] = r.value;

  const setsBy = new Map<string, WorkoutSet[]>();
  for (const s of sets) setsBy.set(s.sessionId, [...(setsBy.get(s.sessionId) ?? []), s]);
  const vitalsBy = new Map(vitals.map((v) => [v.sessionId, v]));

  const recent: Array<Record<string, unknown>> = [];
  const older: Array<Record<string, unknown>> = [];
  for (const s of sessions.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))) {
    const ss = (setsBy.get(s.id) ?? []).sort((a, b) => a.order - b.order);
    const logged = ss.filter((x) => x.completedAt || x.backfilled);
    if ((s.date ?? "") >= cutoff) recent.push(fullSession(s, ss, vitalsBy.get(s.id), opts));
    else older.push(aggregateSession(s, logged));
  }

  const bundle: Bundle = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    settings: { roundingStep: settings?.roundingStep ?? 2.5, unit: settings?.unit ?? "kg", cycleIncrease: settings?.cycleIncrease ?? {} },
    trainingMax: tmRows.map((r) => ({ lift: r.lift, value: r.value, effectiveFrom: r.effectiveFrom, source: r.source })),
    currentTM,
    programs: programs.map((p) => ({ id: p.id, templateId: p.templateId, startDate: p.startDate, status: p.status, options: p.options, baseTM: p.baseTM })),
    sessions: recent,
    olderSessions: older,
    prs: prs.map((p) => ({ lift: p.lift, date: p.date, weight: p.weight, reps: p.reps, e1rm: p.e1rm, source: p.source })),
    ...(opts.includeHealth
      ? {
          vitals: vitals.map((v) => ({ sessionId: v.sessionId, hrAvg: v.hrAvg, hrMax: v.hrMax, perSet: v.perSet.map((p) => ({ setId: p.setId, hrAtDone: p.hrAtDone, recoveryBpm: p.recoveryBpm })), restingHr: v.restingHr, hrvRmssd: v.hrvRmssd, sleepMinutes: v.sleepMinutes })),
        }
      : {}),
    templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, daysPerWeek: t.daysPerWeek, description: t.description, phases: t.phases.map((p) => ({ name: p.name, tmOffset: p.tmOffset })) })),
    assistanceCatalogue: exercises.filter((e: Exercise) => e.kind === "assistance").map((e) => ({ id: e.id, name: e.name, category: e.category })),
    facts: runChecks({ now, sessions, sets, prs, vitals, step: settings?.roundingStep ?? 2.5 }),
  };
  const json = JSON.stringify(bundle);
  return { bundle, json, hash: await sha256(json) };
}

function fullSession(s: Session, sets: WorkoutSet[], v: SessionVitals | undefined, opts: BundleOptions): Record<string, unknown> {
  return {
    id: s.id,
    date: s.date,
    dateApproximate: s.dateApproximate,
    program: s.programId,
    phase: s.phaseName,
    label: s.plannedLabel,
    status: s.status,
    tm: s.tm,
    durationSec: s.startedAt && s.finishedAt ? Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 1000) : null,
    ...(opts.includeNotes && s.notes ? { notes: s.notes } : {}),
    sets: sets.map((x) => ({
      id: x.id,
      exercise: x.exerciseName,
      block: x.blockType,
      prescribed: x.prescribedWeight !== null ? `${x.prescribedWeight}x${x.prescribedReps}` : x.prescribedReps,
      actual: x.completedAt || x.backfilled ? `${x.actualWeight ?? ""}x${x.actualReps ?? ""}` : null,
      rest: x.actualRestSec,
      pr: x.isRepPR || x.isE1rmPR || undefined,
      backfilled: x.backfilled || undefined,
      optional: x.optional || undefined,
    })),
    ...(v && opts.includeHealth ? { hrAvg: v.hrAvg, hrMax: v.hrMax } : {}),
  };
}

function aggregateSession(s: Session, logged: WorkoutSet[]): Record<string, unknown> {
  const main = logged.filter((x) => x.blockType === "main" && x.actualWeight !== null && x.actualReps !== null);
  const top = main.sort((a, b) => b.actualWeight! - a.actualWeight! || b.actualReps! - a.actualReps!)[0];
  const volume = logged.reduce((a, x) => a + (x.actualWeight ?? 0) * (x.actualReps ?? 0), 0);
  return {
    date: s.date,
    phase: s.phaseName,
    label: s.plannedLabel,
    status: s.status,
    lifts: [...new Set(main.map((x) => x.exerciseName))],
    topSet: top ? `${top.exerciseName} ${top.actualWeight}x${top.actualReps}` : null,
    volumeKg: Math.round(volume),
  };
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
