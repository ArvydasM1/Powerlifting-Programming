/** Persists live heart-rate samples per session and derives the §12.9 fields. */
import { perSetRecovery, summarise, type Sample } from "@/domain/vitals";
import type { SessionVitals } from "@/domain/types";
import type { AppDB } from "./db";

export function emptyVitals(sessionId: string, hrSource: string | null): SessionVitals {
  return { sessionId, hrSource, hrAvg: null, hrMax: null, samples: [], perSet: [], restingHr: null, hrvRmssd: null, sleepMinutes: null, sleepStages: null, readAt: null, attempts: 0 };
}

export class LiveVitalsRecorder {
  private buffer: Sample[] = [];
  private flushTimer: number | null = null;
  constructor(
    private db: AppDB,
    private sessionId: string,
    private source: string,
  ) {}

  push(ts: number, bpm: number) {
    const last = this.buffer[this.buffer.length - 1];
    if (last && Math.floor(last[0] / 1000) === Math.floor(ts / 1000)) this.buffer[this.buffer.length - 1] = [ts, bpm];
    else this.buffer.push([ts, bpm]);
    if (this.flushTimer === null) this.flushTimer = window.setTimeout(() => void this.flush(), 5000);
  }

  get samples(): Sample[] {
    return this.buffer;
  }

  async flush(): Promise<void> {
    this.flushTimer = null;
    const existing = await this.db.sessionVitals.get(this.sessionId);
    const merged = mergeSamples(existing?.samples ?? [], this.buffer);
    const sets = await this.db.sets.where("sessionId").equals(this.sessionId).toArray();
    const session = await this.db.sessions.get(this.sessionId);
    const v: SessionVitals = {
      ...(existing ?? emptyVitals(this.sessionId, this.source)),
      hrSource: this.source,
      samples: merged,
      ...summarise(merged),
      perSet: perSetRecovery(merged, sets, session?.finishedAt ? Date.parse(session.finishedAt) : null),
    };
    await this.db.sessionVitals.put(v);
  }
}

export function mergeSamples(a: Sample[], b: Sample[]): Sample[] {
  const map = new Map<number, Sample>();
  for (const s of [...a, ...b]) map.set(Math.floor(s[0] / 1000), s);
  return [...map.values()].sort((x, y) => x[0] - y[0]);
}

/** Recompute per-set values after sets change (e.g. a late done tap). */
export async function recomputePerSet(db: AppDB, sessionId: string): Promise<void> {
  const v = await db.sessionVitals.get(sessionId);
  if (!v || v.samples.length === 0) return;
  const sets = await db.sets.where("sessionId").equals(sessionId).toArray();
  const session = await db.sessions.get(sessionId);
  await db.sessionVitals.update(sessionId, { perSet: perSetRecovery(v.samples, sets, session?.finishedAt ? Date.parse(session.finishedAt) : null) });
}
