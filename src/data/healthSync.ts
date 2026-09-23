/**
 * §12.4 / §12.9: Health Connect sync queue. Writes finished sessions, reads vitals later.
 * Jobs are idempotent and retried on launch; nothing here runs unless the plugin is present
 * and the lifter switched sync on.
 */
import { mergeSamples, emptyVitals } from "./vitalsStore";
import { perSetRecovery, summarise } from "@/domain/vitals";
import type { Session, SessionVitals, Settings, SyncJob, WorkoutSet } from "@/domain/types";
import { healthConnect, healthConnectAvailable, segmentTypeFor } from "@/native/healthConnect";
import type { AppDB } from "./db";

export interface HealthConnectSettings {
  enabled: boolean;
  readHeartRate: boolean;
  readReadiness: boolean;
  readWeight: boolean;
  preferredSource: string | null;
}

export const DEFAULT_HC: HealthConnectSettings = { enabled: false, readHeartRate: true, readReadiness: true, readWeight: false, preferredSource: null };

const READ_WINDOW_MS = 5 * 60_000;
const READ_GIVE_UP_MS = 48 * 3600_000;

export async function enqueue(db: AppDB, sessionId: string, kind: SyncJob["kind"]): Promise<void> {
  const existing = await db.syncQueue.where("sessionId").equals(sessionId).filter((j) => j.kind === kind && j.status === "queued").first();
  if (existing) return;
  await db.syncQueue.add({ sessionId, kind, status: "queued", createdAt: new Date().toISOString(), lastTriedAt: null, error: null });
}

/** Called on finish (§12.4): write plus a read for vitals. */
export async function onSessionFinished(db: AppDB, settings: Settings, sessionId: string): Promise<void> {
  const hc = settings.healthConnect ?? DEFAULT_HC;
  if (!hc.enabled) return;
  await enqueue(db, sessionId, "write");
  if (hc.readHeartRate || hc.readReadiness || hc.readWeight) await enqueue(db, sessionId, "read");
}

export async function onSessionDeleted(db: AppDB, settings: Settings, sessionId: string): Promise<void> {
  if (!(settings.healthConnect ?? DEFAULT_HC).enabled) return;
  await enqueue(db, sessionId, "delete");
}

/** Build the Health Connect payload for a session (§12.3). Only sessions with a logged main-lift set qualify. */
export function buildWritePayload(session: Session, sets: WorkoutSet[]) {
  if (!session.startedAt || !session.finishedAt) return null;
  const logged = sets.filter((s) => s.completedAt && !s.backfilled).sort((a, b) => Date.parse(a.completedAt!) - Date.parse(b.completedAt!));
  if (!logged.some((s) => s.blockType === "main")) return null;
  const startMs = Date.parse(session.startedAt);
  const segments = logged.map((s, i) => {
    const endMs = Date.parse(s.completedAt!);
    const prevEnd = i > 0 ? Date.parse(logged[i - 1]!.completedAt!) : startMs;
    const rest = s.actualRestSec ?? 30;
    const segStart = Math.max(prevEnd, endMs - Math.max(10, Math.min(rest, 120)) * 1000);
    return { startMs: segStart, endMs, type: segmentTypeFor(s.exerciseId), reps: s.actualReps ?? 0 };
  });
  return { clientId: session.id, startMs, endMs: Date.parse(session.finishedAt), title: session.plannedLabel, notes: session.notes || undefined, segments };
}

/** Run every queued job once. Returns counts for the UI. */
export async function runQueue(db: AppDB, settings: Settings): Promise<{ done: number; failed: number; waiting: number }> {
  const hc = settings.healthConnect ?? DEFAULT_HC;
  const result = { done: 0, failed: 0, waiting: 0 };
  if (!hc.enabled || !healthConnectAvailable()) return result;
  const jobs = await db.syncQueue.where("status").equals("queued").toArray();
  for (const job of jobs) {
    const now = new Date().toISOString();
    try {
      if (job.kind === "write") {
        const session = await db.sessions.get(job.sessionId);
        if (!session) throw new Error("session missing");
        const payload = buildWritePayload(session, await db.sets.where("sessionId").equals(job.sessionId).toArray());
        if (payload) await healthConnect.writeSession(payload);
        await db.syncQueue.update(job.id!, { status: "done", lastTriedAt: now, error: null });
        result.done++;
      } else if (job.kind === "delete") {
        await healthConnect.deleteSession({ clientId: job.sessionId });
        await db.syncQueue.update(job.id!, { status: "done", lastTriedAt: now, error: null });
        result.done++;
      } else {
        const found = await readVitals(db, hc, job.sessionId);
        if (found) {
          await db.syncQueue.update(job.id!, { status: "done", lastTriedAt: now, error: null });
          result.done++;
        } else if (Date.now() - Date.parse(job.createdAt) > READ_GIVE_UP_MS) {
          await db.syncQueue.update(job.id!, { status: "failed", lastTriedAt: now, error: "no heart rate data within 48 h" });
          result.failed++;
        } else {
          await db.syncQueue.update(job.id!, { lastTriedAt: now });
          result.waiting++;
        }
      }
    } catch (e) {
      await db.syncQueue.update(job.id!, { status: "failed", lastTriedAt: now, error: (e as Error).message });
      result.failed++;
    }
  }
  return result;
}

/** §12.9 read for one session. Returns true when at least one heart-rate sample was found. */
export async function readVitals(db: AppDB, hc: HealthConnectSettings, sessionId: string): Promise<boolean> {
  const session = await db.sessions.get(sessionId);
  if (!session || !session.startedAt || !session.finishedAt) return false;
  const start = Date.parse(session.startedAt) - READ_WINDOW_MS;
  const end = Date.parse(session.finishedAt) + READ_WINDOW_MS;
  const existing = (await db.sessionVitals.get(sessionId)) ?? emptyVitals(sessionId, null);
  let v: SessionVitals = { ...existing, attempts: existing.attempts + 1, readAt: new Date().toISOString() };
  let foundHr = false;

  if (hc.readHeartRate) {
    const { samples } = await healthConnect.readHeartRate({ startMs: start, endMs: end });
    if (samples.length > 0) {
      foundHr = true;
      const bySource = new Map<string, Array<[number, number]>>();
      for (const s of samples) bySource.set(s.source, [...(bySource.get(s.source) ?? []), [s.ts, s.bpm]]);
      const preferred = hc.preferredSource && bySource.has(hc.preferredSource) ? hc.preferredSource : [...bySource.entries()].sort((a, b) => b[1].length - a[1].length)[0]![0];
      const hcSamples = bySource.get(preferred)!.sort((a, b) => a[0] - b[0]);
      const liveIsPrimary = existing.hrSource?.startsWith("ble:") && existing.samples.length > 0;
      if (!liveIsPrimary) {
        const sets = await db.sets.where("sessionId").equals(sessionId).toArray();
        const merged = mergeSamples([], hcSamples);
        v = { ...v, hrSource: preferred, samples: merged, ...summarise(merged), perSet: perSetRecovery(merged, sets, Date.parse(session.finishedAt)) };
      }
      v.otherSources = [...bySource.keys()].filter((k) => k !== preferred);
    }
  }
  if (hc.readReadiness || hc.readWeight) {
    const evening = new Date(session.date ?? session.startedAt);
    evening.setDate(evening.getDate() - 1);
    evening.setHours(18, 0, 0, 0);
    const d = await healthConnect.readDaily({ startMs: evening.getTime(), endMs: Date.parse(session.startedAt) });
    if (hc.readReadiness) {
      v.restingHr = d.restingHr ?? v.restingHr;
      v.hrvRmssd = d.hrvRmssd ?? v.hrvRmssd;
      v.sleepMinutes = d.sleepMinutes ?? v.sleepMinutes;
      v.sleepStages = d.sleepStages ?? v.sleepStages;
    }
    if (hc.readWeight && d.weightKg !== undefined) v.weightKg = d.weightKg;
  }
  await db.sessionVitals.put(v);
  return foundHr;
}

export async function queueStatus(db: AppDB): Promise<Map<string, SyncJob["status"]>> {
  const jobs = await db.syncQueue.toArray();
  const m = new Map<string, SyncJob["status"]>();
  for (const j of jobs) {
    if (j.kind !== "write") continue;
    const cur = m.get(j.sessionId);
    if (!cur || j.status === "failed" || (j.status === "queued" && cur === "done")) m.set(j.sessionId, j.status);
  }
  return m;
}
