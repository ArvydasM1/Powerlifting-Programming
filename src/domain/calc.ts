/**
 * Calculation rules, §6 of SPEC.md.
 * Pure functions, no I/O.
 */
import type { Lift, LiftMap } from "./types";

/** §6.1 Excel MROUND: round to nearest multiple of step, half away from zero. */
export function roundToStep(value: number, step: number): number {
  if (step <= 0) throw new Error("step must be positive");
  const q = value / step;
  const rounded = q >= 0 ? Math.floor(q + 0.5 + 1e-9) : -Math.floor(-q + 0.5 + 1e-9);
  // avoid 92.50000000001 style artefacts
  return Number((rounded * step).toFixed(6));
}

/** §6.2 TM for a phase = base + offset × cycle increase */
export function tmForPhase(baseTM: number, tmOffset: number, cycleIncrease: number): number {
  return baseTM + tmOffset * cycleIncrease;
}

export function tmMapForPhase(
  baseTM: LiftMap<number>,
  tmOffset: number,
  cycleIncrease: LiftMap<number>,
): LiftMap<number> {
  const out = {} as LiftMap<number>;
  for (const lift of Object.keys(baseTM) as Lift[]) {
    out[lift] = tmForPhase(baseTM[lift], tmOffset, cycleIncrease[lift]);
  }
  return out;
}

/** §6.11 base TM from the TM in use at a phase with the given offset */
export function baseTMFromCurrent(currentTM: number, tmOffset: number, cycleIncrease: number): number {
  return currentTM - tmOffset * cycleIncrease;
}

export function weightFor(tm: number, pct: number, step: number): number {
  return roundToStep(tm * pct, step);
}

/** §6.4 rep-target grammar */
export interface RepTarget {
  raw: string;
  /** minimum reps for success; 0 for "PR" */
  min: number;
  /** maximum reps for a range; null when open */
  max: number | null;
  /** AMRAP: "+" suffix or "PR" */
  amrap: boolean;
  /** "PR": a PR attempt with no minimum */
  pr: boolean;
}

const REP_RE = /^(\d+)(?:-(\d+))?(\+)?$/;

export function parseRepTarget(raw: string): RepTarget {
  const s = String(raw).trim();
  if (s.toUpperCase() === "PR") return { raw: s, min: 0, max: null, amrap: true, pr: true };
  const m = REP_RE.exec(s);
  if (!m) throw new Error(`Invalid rep target: "${raw}"`);
  const a = Number(m[1]);
  const b = m[2] === undefined ? null : Number(m[2]);
  const plus = m[3] === "+";
  if (b !== null && b < a) throw new Error(`Invalid rep range: "${raw}"`);
  return { raw: s, min: a, max: plus ? null : b, amrap: plus, pr: false };
}

export function isValidRepTarget(raw: string): boolean {
  try {
    parseRepTarget(raw);
    return true;
  } catch {
    return false;
  }
}

/** Success = reps within the target; "exact" targets treat extra reps as success too. */
export function repTargetMet(target: RepTarget, actualReps: number): boolean {
  if (target.pr) return actualReps > 0;
  if (actualReps < target.min) return false;
  if (target.max !== null && !target.amrap && actualReps > target.max) return true; // over a range still counts
  return true;
}

/** The default reps to pre-fill when a set is tapped done: the minimum, or the top of a range. */
export function defaultRepsFor(target: RepTarget): number {
  if (target.pr) return 1;
  return target.max ?? target.min;
}

/** Sets that count for PR detection (§6.6): AMRAP, range, PR, or actual > prescribed */
export function eligibleForPR(target: RepTarget, actualReps: number): boolean {
  return target.amrap || target.pr || target.max !== null || actualReps > target.min;
}

/** §6.5 Wendler e1RM; null above 12 reps or below 1 */
export function e1rm(weight: number, reps: number, step: number): number | null {
  if (reps < 1 || reps > 12 || weight <= 0) return null;
  return roundToStep(weight / (1.0278 - 0.0278 * reps), step);
}

/** §6.7 warm-up calculator */
export const WARMUP_SCHEME: ReadonlyArray<{ pct: number; reps: number }> = [
  { pct: 0.4, reps: 5 },
  { pct: 0.5, reps: 5 },
  { pct: 0.6, reps: 3 },
  { pct: 0.7, reps: 2 },
  { pct: 0.8, reps: 1 },
  { pct: 0.9, reps: 1 },
];

export function warmupSets(topSet: number, step: number): Array<{ pct: number; reps: number; weight: number }> {
  return WARMUP_SCHEME.map((w) => ({ ...w, weight: roundToStep(topSet * w.pct, step) }));
}

/** §A8 7th-week protocols */
export const DELOAD_SCHEME: ReadonlyArray<{ pct: number; reps: string }> = [
  { pct: 0.7, reps: "5" },
  { pct: 0.8, reps: "3-5" },
  { pct: 0.9, reps: "1" },
  { pct: 1.0, reps: "1" },
];

export const TM_TEST_SCHEME: ReadonlyArray<{ pct: number; reps: string }> = [
  { pct: 0.4, reps: "5" },
  { pct: 0.5, reps: "5" },
  { pct: 0.7, reps: "5" },
  { pct: 0.8, reps: "5" },
  { pct: 0.9, reps: "5" },
  { pct: 1.0, reps: "5" },
];

/** §6.3 proposed TM after a programme */
export type TmTestOutcome = "skipped" | "pass" | "borderline" | "fail";

export function proposeNextTM(args: {
  anchorTM: number;
  cycleIncrease: number;
  step: number;
  /** reps achieved at 100 % in the TM test; null when the test was skipped or not included */
  testReps: number | null;
  /** weight actually used for the test set; defaults to anchorTM + increase */
  testWeight?: number;
}): { value: number; outcome: TmTestOutcome } {
  const next = args.anchorTM + args.cycleIncrease;
  if (args.testReps === null) return { value: next, outcome: "skipped" };
  if (args.testReps >= 5) return { value: next, outcome: "pass" };
  if (args.testReps >= 3) return { value: next, outcome: "borderline" };
  const w = args.testWeight ?? next;
  const est = e1rm(w, Math.max(1, args.testReps), args.step) ?? w;
  return { value: roundToStep(est * 0.85, args.step), outcome: "fail" };
}

/** §6.6 PR detection against history */
export interface PRHistoryEntry {
  weight: number;
  reps: number;
}

export function isRepPR(history: PRHistoryEntry[], weight: number, reps: number): boolean {
  const best = history.filter((h) => h.weight >= weight).reduce((m, h) => Math.max(m, h.reps), 0);
  return reps > best;
}

export function isE1rmPR(history: PRHistoryEntry[], weight: number, reps: number, step: number): boolean {
  const mine = e1rm(weight, reps, step);
  if (mine === null) return false;
  const best = history.reduce((m, h) => Math.max(m, e1rm(h.weight, h.reps, step) ?? 0), 0);
  return mine > best;
}

/** §6.10 rest before a set = gap since the previous logged set in the session */
export function restBefore(prevCompletedAt: string | null, completedAt: string): number | null {
  if (!prevCompletedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(prevCompletedAt).getTime();
  return Math.max(0, Math.round(ms / 1000));
}

export function formatRest(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
