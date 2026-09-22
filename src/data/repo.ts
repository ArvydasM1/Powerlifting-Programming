/**
 * Repository: every write the UI needs, each as one Dexie transaction (§9).
 */
import Dexie from "dexie";
import { e1rm, eligibleForPR, isE1rmPR, isRepPR, parseRepTarget, proposeNextTM, restBefore, type TmTestOutcome } from "@/domain/calc";
import { comparePointer, expandProgram, scheduleDates } from "@/domain/expand";
import type { Template } from "@/domain/template";
import { LIFTS, type Lift, type LiftMap, type PRRecord, type Program, type ProgramOptions, type ProgramPointer, type Session, type Settings, type TrainingMax, type TrainingMaxSource, type WorkoutSet } from "@/domain/types";
import { CATALOGUE } from "./catalogue";
import { db as defaultDb, type AppDB } from "./db";

export const DEFAULT_SETTINGS: Settings = {
  id: "settings",
  roundingStep: 2.5,
  unit: "kg",
  cycleIncrease: { Squat: 2.5, Bench: 2.5, Press: 2.5, Deadlift: 5 },
  includeDeloadAfterLeaders: true,
  includeTmTestAtEnd: true,
  includeAssistance: true,
  e1rmFormula: "wendler",
  defaultRestSec: { main: 180, supplemental: 90, assistance: 60, superset: 45 },
  restAlert: "vibrate",
};

export interface Clock {
  now(): Date;
}
const systemClock: Clock = { now: () => new Date() };

export const todayIso = (clock: Clock = systemClock) => clock.now().toISOString().slice(0, 10);

export function createRepo(db: AppDB = defaultDb, clock: Clock = systemClock) {
  const nowIso = () => clock.now().toISOString();

  async function ensureSeeded(): Promise<void> {
    await db.transaction("rw", db.settings, db.exercises, async () => {
      if (!(await db.settings.get("settings"))) await db.settings.put(DEFAULT_SETTINGS);
      const count = await db.exercises.count();
      if (count === 0) await db.exercises.bulkPut(CATALOGUE);
    });
  }

  async function getSettings(): Promise<Settings> {
    return (await db.settings.get("settings")) ?? DEFAULT_SETTINGS;
  }

  async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...(await getSettings()), ...patch, id: "settings" as const };
    await db.settings.put(next);
    return next;
  }

  /** TM in force on a date (§5.2) */
  async function currentTM(onDate = todayIso(clock)): Promise<LiftMap<number>> {
    const rows = await db.trainingMax.where("effectiveFrom").belowOrEqual(onDate).toArray();
    const out = { Squat: 0, Bench: 0, Press: 0, Deadlift: 0 } as LiftMap<number>;
    for (const lift of LIFTS) {
      const latest = rows.filter((r) => r.lift === lift).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : a.effectiveFrom > b.effectiveFrom ? -1 : (b.id ?? 0) - (a.id ?? 0)))[0];
      out[lift] = latest?.value ?? 0;
    }
    return out;
  }

  async function setTM(lift: Lift, value: number, source: TrainingMaxSource, effectiveFrom = todayIso(clock)): Promise<void> {
    await db.trainingMax.add({ lift, value, effectiveFrom, source });
  }

  async function setAllTM(values: LiftMap<number>, source: TrainingMaxSource, effectiveFrom = todayIso(clock)): Promise<void> {
    await db.trainingMax.bulkAdd(LIFTS.map((lift) => ({ lift, value: values[lift], effectiveFrom, source })));
  }

  async function tmHistory(): Promise<TrainingMax[]> {
    return db.trainingMax.orderBy("effectiveFrom").toArray();
  }

  // ---- programs -------------------------------------------------------------

  interface CreateProgramInput {
    template: Template;
    baseTM: LiftMap<number>;
    options: ProgramOptions;
    startAt?: ProgramPointer;
    /** date of the session at startAt (the next session for a mid-programme start) */
    anchorDate: string;
    trainingDays: number[];
  }

  async function createProgram(input: CreateProgramInput): Promise<Program> {
    const settings = await getSettings();
    const startAt = input.startAt ?? { phaseIndex: 0, weekIndex: 0, sessionIndex: 0 };
    const programId = crypto.randomUUID();
    const expanded = expandProgram({
      template: input.template,
      programId,
      baseTM: input.baseTM,
      cycleIncrease: settings.cycleIncrease,
      roundingStep: settings.roundingStep,
      defaultRestSec: settings.defaultRestSec,
      options: input.options,
      startAt,
    });
    const anchor = expanded.sessions.find((s) => comparePointer({ phaseIndex: s.phaseIndex, weekIndex: s.weekIndex, sessionIndex: s.sessionIndex }, startAt) >= 0);
    if (!anchor) throw new Error("startAt is beyond the end of the template");
    const dates = scheduleDates(expanded.sessions, { anchorOrdinal: anchor.ordinal, anchorDate: input.anchorDate, trainingDays: input.trainingDays });
    for (const s of expanded.sessions) {
      const d = dates.get(s.id) ?? null;
      s.plannedDate = d;
      if (s.status === "beforeStart") {
        s.date = d;
        s.dateApproximate = true;
      }
    }
    const first = expanded.sessions[0]!;
    const program: Program = {
      id: programId,
      templateId: input.template.id,
      templateName: input.template.name,
      startDate: dates.get(first.id) ?? input.anchorDate,
      baseTM: input.baseTM,
      options: input.options,
      status: "active",
      currentPointer: { phaseIndex: anchor.phaseIndex, weekIndex: anchor.weekIndex, sessionIndex: anchor.sessionIndex },
      startAt,
      sessionsPerWeek: input.trainingDays.length,
      trainingDays: input.trainingDays,
      createdAt: nowIso(),
    };
    await db.transaction("rw", db.programs, db.sessions, db.setGroups, db.sets, async () => {
      const active = await db.programs.where("status").equals("active").count();
      if (active > 0) throw new Error("Another programme is already active");
      await db.programs.add(program);
      await db.sessions.bulkAdd(expanded.sessions);
      await db.setGroups.bulkAdd(expanded.groups);
      await db.sets.bulkAdd(expanded.sets);
    });
    return program;
  }

  async function getActiveProgram(): Promise<Program | undefined> {
    return db.programs.where("status").equals("active").first();
  }

  async function programSessions(programId: string): Promise<Session[]> {
    return db.sessions.where("[programId+ordinal]").between([programId, Dexie.minKey], [programId, Dexie.maxKey]).toArray();
  }

  async function nextSession(programId: string): Promise<Session | undefined> {
    const all = await programSessions(programId);
    return all.find((s) => s.status === "inProgress") ?? all.find((s) => s.status === "planned");
  }

  async function sessionSets(sessionId: string): Promise<WorkoutSet[]> {
    return db.sets.where("[sessionId+order]").between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey]).toArray();
  }

  async function sessionGroups(sessionId: string) {
    return db.setGroups.where("[sessionId+order]").between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey]).toArray();
  }

  async function startSession(sessionId: string): Promise<void> {
    const now = nowIso();
    await db.sessions.update(sessionId, { status: "inProgress", startedAt: now, date: now.slice(0, 10), dateApproximate: false });
  }

  /** PR history for a lift from stored PR records (logged, imported and backfilled) */
  async function prHistory(lift: Lift): Promise<PRRecord[]> {
    return db.prRecords.where("lift").equals(lift).toArray();
  }

  /**
   * F4 / §6.10 / §6.6: mark a set done. One transaction. The tap is the only input;
   * rest is derived from the previous logged set in the session.
   */
  async function logSet(setId: string, values: { actualWeight?: number | null; actualReps?: number } = {}): Promise<WorkoutSet> {
    const settings = await getSettings();
    const completedAt = nowIso();
    return db.transaction("rw", db.sets, db.sessions, db.prRecords, db.exercises, async () => {
      const set = await db.sets.get(setId);
      if (!set) throw new Error("set not found");
      const target = parseRepTarget(set.prescribedReps);
      const siblings = await sessionSets(set.sessionId);
      const prev = siblings
        .filter((s) => s.id !== setId && s.completedAt)
        .map((s) => s.completedAt!)
        .sort()
        .at(-1) ?? null;

      const actualWeight = values.actualWeight === undefined ? (set.actualWeight ?? set.prescribedWeight) : values.actualWeight;
      const actualReps = values.actualReps ?? set.actualReps ?? (target.pr ? 1 : (target.max ?? target.min));

      let isRep = false;
      let isE1 = false;
      if (set.lift && set.blockType === "main" && actualWeight !== null && eligibleForPR(target, actualReps)) {
        const hist = (await prHistory(set.lift)).filter((h) => h.setId !== setId).map((h) => ({ weight: h.weight, reps: h.reps }));
        isRep = isRepPR(hist, actualWeight, actualReps);
        isE1 = isE1rmPR(hist, actualWeight, actualReps, settings.roundingStep);
        const session = await db.sessions.get(set.sessionId);
        const existing = await db.prRecords.where("setId").equals(setId).first();
        const rec: PRRecord = {
          ...(existing?.id ? { id: existing.id } : {}),
          lift: set.lift,
          date: session?.date ?? completedAt.slice(0, 10),
          ordinal: existing?.ordinal ?? (await db.prRecords.where("lift").equals(set.lift).count()) + 1,
          weight: actualWeight,
          reps: actualReps,
          e1rm: e1rm(actualWeight, actualReps, settings.roundingStep),
          source: "logged",
          dateApproximate: session?.dateApproximate ?? false,
          setId,
        };
        await db.prRecords.put(rec);
      }

      const updated: WorkoutSet = {
        ...set,
        actualWeight,
        actualReps,
        completedAt,
        actualRestSec: restBefore(prev, completedAt),
        isRepPR: isRep,
        isE1rmPR: isE1,
        source: "logged",
        backfilled: false,
      };
      await db.sets.put(updated);
      if (set.blockType === "assistance" && actualWeight !== null) {
        await db.exercises.update(set.exerciseId, { lastWeight: actualWeight });
      }
      const session = await db.sessions.get(set.sessionId);
      if (session && session.status === "planned") {
        await db.sessions.update(session.id, { status: "inProgress", startedAt: completedAt, date: completedAt.slice(0, 10) });
      }
      return updated;
    });
  }

  /** Undo the most recent done tap in a session (only the last one, so rest values stay true). */
  async function undoLastSet(sessionId: string): Promise<void> {
    await db.transaction("rw", db.sets, db.prRecords, async () => {
      const done = (await sessionSets(sessionId)).filter((s) => s.completedAt).sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1));
      const last = done[0];
      if (!last) return;
      await db.sets.update(last.id, { actualWeight: null, actualReps: null, completedAt: null, actualRestSec: null, isRepPR: false, isE1rmPR: false });
      await db.prRecords.where("setId").equals(last.id).delete();
    });
  }

  async function updateSetValues(setId: string, values: { actualWeight?: number | null; actualReps?: number }): Promise<void> {
    const set = await db.sets.get(setId);
    if (!set) return;
    if (set.completedAt) {
      // re-evaluate PR flags with new values, keep timestamps
      await db.transaction("rw", db.sets, db.prRecords, db.sessions, db.exercises, async () => {
        const settings = await getSettings();
        const actualWeight = values.actualWeight === undefined ? set.actualWeight : values.actualWeight;
        const actualReps = values.actualReps ?? set.actualReps ?? 0;
        const target = parseRepTarget(set.prescribedReps);
        let isRep = false;
        let isE1 = false;
        await db.prRecords.where("setId").equals(setId).delete();
        if (set.lift && set.blockType === "main" && actualWeight !== null && eligibleForPR(target, actualReps)) {
          const hist = (await prHistory(set.lift)).map((h) => ({ weight: h.weight, reps: h.reps }));
          isRep = isRepPR(hist, actualWeight, actualReps);
          isE1 = isE1rmPR(hist, actualWeight, actualReps, settings.roundingStep);
          const session = await db.sessions.get(set.sessionId);
          await db.prRecords.add({
            lift: set.lift,
            date: session?.date ?? null,
            ordinal: (await db.prRecords.where("lift").equals(set.lift).count()) + 1,
            weight: actualWeight,
            reps: actualReps,
            e1rm: e1rm(actualWeight, actualReps, settings.roundingStep),
            source: "logged",
            dateApproximate: session?.dateApproximate ?? false,
            setId,
          });
        }
        await db.sets.update(setId, { actualWeight, actualReps, isRepPR: isRep, isE1rmPR: isE1 });
      });
    } else {
      await db.sets.update(setId, values);
    }
  }

  async function finishSession(sessionId: string, notes?: string): Promise<{ programCompleted: boolean }> {
    const now = nowIso();
    return db.transaction("rw", db.sessions, db.programs, async () => {
      const session = await db.sessions.get(sessionId);
      if (!session) throw new Error("session not found");
      await db.sessions.update(sessionId, {
        status: "done",
        finishedAt: now,
        startedAt: session.startedAt ?? now,
        date: session.date ?? now.slice(0, 10),
        ...(notes !== undefined ? { notes } : {}),
      });
      return advancePointer(session.programId);
    });
  }

  async function skipSession(sessionId: string): Promise<{ programCompleted: boolean }> {
    return db.transaction("rw", db.sessions, db.programs, async () => {
      const session = await db.sessions.get(sessionId);
      if (!session) throw new Error("session not found");
      await db.sessions.update(sessionId, { status: "skipped" });
      return advancePointer(session.programId);
    });
  }

  async function advancePointer(programId: string): Promise<{ programCompleted: boolean }> {
    const next = await nextSession(programId);
    if (next) {
      await db.programs.update(programId, { currentPointer: { phaseIndex: next.phaseIndex, weekIndex: next.weekIndex, sessionIndex: next.sessionIndex } });
      return { programCompleted: false };
    }
    await db.programs.update(programId, { status: "completed" });
    return { programCompleted: true };
  }

  async function updateSessionNotes(sessionId: string, notes: string): Promise<void> {
    await db.sessions.update(sessionId, { notes });
  }

  async function setSessionDate(sessionId: string, date: string): Promise<void> {
    await db.sessions.update(sessionId, { date, dateApproximate: false });
  }

  async function abandonProgram(programId: string): Promise<void> {
    await db.programs.update(programId, { status: "abandoned" });
  }

  /** §6.3 TM proposal per lift at the end of a programme */
  async function proposeEndOfProgramTM(programId: string): Promise<LiftMap<{ value: number; outcome: TmTestOutcome; anchorTM: number; testReps: number | null }>> {
    const settings = await getSettings();
    const program = await db.programs.get(programId);
    if (!program) throw new Error("program not found");
    const sessions = await programSessions(programId);
    const out = {} as LiftMap<{ value: number; outcome: TmTestOutcome; anchorTM: number; testReps: number | null }>;
    for (const lift of LIFTS) {
      const anchorSessions = sessions.filter((s) => s.phaseKind === "anchor");
      const lastNonTest = [...sessions].reverse().find((s) => s.phaseKind !== "seventhWeek");
      const anchorTM = (anchorSessions.at(-1) ?? lastNonTest)?.tm[lift] ?? program.baseTM[lift];
      const test = sessions.find((s) => s.phaseKind === "seventhWeek" && s.plannedLabel.includes(`TM test · ${lift}`) && s.status === "done");
      let testReps: number | null = null;
      let testWeight: number | undefined;
      if (test) {
        const sets = await sessionSets(test.id);
        const top = sets.filter((s) => s.completedAt).sort((a, b) => b.order - a.order)[0];
        if (top && top.actualReps !== null) {
          testReps = top.actualReps;
          testWeight = top.actualWeight ?? undefined;
        }
      }
      const p = proposeNextTM({ anchorTM, cycleIncrease: settings.cycleIncrease[lift], step: settings.roundingStep, testReps, testWeight });
      out[lift] = { ...p, anchorTM, testReps };
    }
    return out;
  }

  // ---- backfill (F11) -------------------------------------------------------

  /** One tap: every non-optional main and supplemental set done as prescribed. */
  async function backfillAsPrescribed(sessionId: string): Promise<void> {
    const settings = await getSettings();
    await db.transaction("rw", db.sets, db.sessions, db.prRecords, async () => {
      const session = await db.sessions.get(sessionId);
      if (!session) throw new Error("session not found");
      const sets = await sessionSets(sessionId);
      for (const set of sets) {
        if (set.blockType === "assistance" || set.optional) continue;
        const target = parseRepTarget(set.prescribedReps);
        const reps = target.pr ? 1 : (target.max ?? target.min);
        await db.sets.update(set.id, {
          actualWeight: set.prescribedWeight,
          actualReps: reps,
          completedAt: null,
          actualRestSec: null,
          backfilled: true,
          source: "backfillPrescribed",
        });
        if (set.lift && set.blockType === "main" && eligibleForPR(target, reps) && set.prescribedWeight !== null) {
          await db.prRecords.add({
            lift: set.lift,
            date: session.date,
            ordinal: (await db.prRecords.where("lift").equals(set.lift).count()) + 1,
            weight: set.prescribedWeight,
            reps,
            e1rm: e1rm(set.prescribedWeight, reps, settings.roundingStep),
            source: "backfill",
            dateApproximate: session.dateApproximate,
            setId: set.id,
          });
        }
      }
      await db.sessions.update(sessionId, { status: "backfilled" });
    });
  }

  async function clearBackfill(sessionId: string): Promise<void> {
    await db.transaction("rw", db.sets, db.sessions, db.prRecords, async () => {
      const sets = await sessionSets(sessionId);
      for (const set of sets) {
        await db.sets.update(set.id, { actualWeight: null, actualReps: null, completedAt: null, actualRestSec: null, backfilled: false, source: "logged", isRepPR: false, isE1rmPR: false });
        await db.prRecords.where("setId").equals(set.id).delete();
      }
      await db.sessions.update(sessionId, { status: "beforeStart" });
    });
  }

  // ---- import (F8) ------------------------------------------------------------

  async function importPRList(lift: Lift, rows: Array<{ weight: number; reps: number }>): Promise<void> {
    const settings = await getSettings();
    await db.transaction("rw", db.prRecords, async () => {
      await db.prRecords.where("lift").equals(lift).filter((r) => r.source === "import").delete();
      let ordinal = 0;
      await db.prRecords.bulkAdd(
        rows.map((r) => ({ lift, date: null, ordinal: ++ordinal, weight: r.weight, reps: r.reps, e1rm: e1rm(r.weight, r.reps, settings.roundingStep), source: "import" as const, dateApproximate: true })),
      );
    });
  }

  return {
    db,
    ensureSeeded,
    getSettings,
    saveSettings,
    currentTM,
    setTM,
    setAllTM,
    tmHistory,
    createProgram,
    getActiveProgram,
    programSessions,
    nextSession,
    sessionSets,
    sessionGroups,
    startSession,
    logSet,
    undoLastSet,
    updateSetValues,
    finishSession,
    skipSession,
    updateSessionNotes,
    setSessionDate,
    abandonProgram,
    proposeEndOfProgramTM,
    backfillAsPrescribed,
    clearBackfill,
    importPRList,
    prHistory,
  };
}

export type Repo = ReturnType<typeof createRepo>;
