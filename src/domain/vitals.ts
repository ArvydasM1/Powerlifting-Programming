/**
 * §12.9 / §13: derive per-session and per-set heart-rate values from samples.
 * Pure functions; samples are [epochMs, bpm] sorted by time.
 */
import type { WorkoutSet } from "./types";

export type Sample = [number, number];

export function summarise(samples: Sample[]): { hrAvg: number | null; hrMax: number | null } {
  if (samples.length === 0) return { hrAvg: null, hrMax: null };
  let sum = 0;
  let max = 0;
  for (const [, bpm] of samples) {
    sum += bpm;
    if (bpm > max) max = bpm;
  }
  return { hrAvg: Math.round(sum / samples.length), hrMax: max };
}

/** nearest sample to t within `window` ms, else null */
export function nearest(samples: Sample[], t: number, window = 15000): number | null {
  let best: Sample | null = null;
  for (const s of samples) {
    const d = Math.abs(s[0] - t);
    if (d <= window && (!best || d < Math.abs(best[0] - t))) best = s;
  }
  return best ? best[1] : null;
}

export function minBetween(samples: Sample[], from: number, to: number): number | null {
  let min: number | null = null;
  for (const [t, bpm] of samples) {
    if (t >= from && t <= to && (min === null || bpm < min)) min = bpm;
  }
  return min;
}

/** §12.9 per-set values: HR at the done tap and the lowest HR before the next set. */
export function perSetRecovery(samples: Sample[], sets: WorkoutSet[], sessionEnd: number | null) {
  const done = sets.filter((s) => s.completedAt).sort((a, b) => Date.parse(a.completedAt!) - Date.parse(b.completedAt!));
  return done.map((s, i) => {
    const t = Date.parse(s.completedAt!);
    const next = done[i + 1] ? Date.parse(done[i + 1]!.completedAt!) : (sessionEnd ?? t + 5 * 60_000);
    const hrAtDone = nearest(samples, t);
    const hrMinBeforeNext = minBetween(samples, t, next);
    return { setId: s.id, hrAtDone, hrMinBeforeNext, recoveryBpm: hrAtDone !== null && hrMinBeforeNext !== null ? hrAtDone - hrMinBeforeNext : null };
  });
}

/** Parse a Bluetooth Heart Rate Measurement characteristic value (0x2A37). */
export function parseHeartRateMeasurement(data: DataView): number {
  const flags = data.getUint8(0);
  return flags & 0x01 ? data.getUint16(1, true) : data.getUint8(1);
}

/** Downsample to at most one sample per second, keeping the last in each second. */
export function downsample1Hz(samples: Sample[]): Sample[] {
  const out: Sample[] = [];
  for (const s of samples) {
    const sec = Math.floor(s[0] / 1000);
    const last = out[out.length - 1];
    if (last && Math.floor(last[0] / 1000) === sec) out[out.length - 1] = s;
    else out.push(s);
  }
  return out;
}
