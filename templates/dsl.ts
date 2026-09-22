/**
 * Small helpers for writing templates as data. Everything returns plain objects
 * that satisfy the zod schema in src/domain/template.ts.
 */
import type {
  AssistanceBlock,
  Block,
  MainBlock,
  MainSetTemplate,
  Phase,
  SeventhWeekPhase,
  SessionTemplate,
  SupplementalBlock,
  Template,
  TrainingPhase,
  WeekTemplate,
} from "@/domain/template";
import type { Lift } from "@/domain/types";

/** 5s PRO waves (§A): A = 65/75/85, B = 70/80/90, C = 75/85/95 */
export const WAVE = {
  A: [0.65, 0.75, 0.85],
  B: [0.7, 0.8, 0.9],
  C: [0.75, 0.85, 0.95],
} as const;
export type WaveKey = keyof typeof WAVE;

/** 5/3/1 with PR sets, by week (1-based) */
export const PR_WAVE: Record<1 | 2 | 3, MainSetTemplate[]> = {
  1: [
    { pct: 0.65, reps: "5" },
    { pct: 0.75, reps: "5" },
    { pct: 0.85, reps: "5+" },
  ],
  2: [
    { pct: 0.7, reps: "3" },
    { pct: 0.8, reps: "3" },
    { pct: 0.9, reps: "3+" },
  ],
  3: [
    { pct: 0.75, reps: "5" },
    { pct: 0.85, reps: "3" },
    { pct: 0.95, reps: "1+" },
  ],
};

export function sets(pcts: readonly number[], reps: string | readonly string[]): MainSetTemplate[] {
  return pcts.map((pct, i) => ({ pct, reps: typeof reps === "string" ? reps : (reps[i] ?? reps[reps.length - 1]!) }));
}

export function main(lift: Lift, s: MainSetTemplate[], opts: Partial<Omit<MainBlock, "type" | "lift" | "sets">> = {}): MainBlock {
  return { type: "main", lift, sets: s, ...opts };
}

/** 5s PRO: three straight sets of 5 on a wave */
export function fivesPro(lift: Lift, wave: WaveKey, opts: Partial<Omit<MainBlock, "type" | "lift" | "sets">> = {}): MainBlock {
  return main(lift, sets(WAVE[wave], "5"), opts);
}

export function fsl(lift: Lift, n: number, reps: string, opts: Partial<SupplementalBlock> = {}): SupplementalBlock {
  return { type: "supplemental", lift, scheme: "FSL", sets: n, reps, ...opts };
}

export function ssl(lift: Lift, n: number, reps: string, opts: Partial<SupplementalBlock> = {}): SupplementalBlock {
  return { type: "supplemental", lift, scheme: "SSL", sets: n, reps, ...opts };
}

export function supp(lift: Lift, pct: number, n: number, reps: string, opts: Partial<SupplementalBlock> = {}): SupplementalBlock {
  return { type: "supplemental", lift, scheme: "pct", pct, sets: n, reps, ...opts };
}

export function assist(exercise: string, n: number, reps: string, opts: Partial<AssistanceBlock> = {}): AssistanceBlock {
  return { type: "assistance", exercise, sets: n, reps, optional: true, ...opts };
}

export function session(label: string, blocks: Block[]): SessionTemplate {
  return { label, blocks };
}

export function week(label: string, sessions: SessionTemplate[]): WeekTemplate {
  return { label, sessions };
}

export function phase(name: string, kind: TrainingPhase["kind"], tmOffset: number, weeks: WeekTemplate[]): TrainingPhase {
  return { name, kind, tmOffset, weeks } as TrainingPhase;
}

export function deload(tmOffset: number, name = "7th Week Deload"): SeventhWeekPhase {
  return { name, kind: "seventhWeek", protocol: "deload", tmOffset, optional: true };
}

export function tmTest(tmOffset: number, name = "7th Week TM Test"): SeventhWeekPhase {
  return { name, kind: "seventhWeek", protocol: "tmTest", tmOffset, optional: true };
}

export function template(t: Omit<Template, "phases"> & { phases: Phase[] }): Template {
  return t;
}

export const ASSISTANCE_NOTE_LEADER =
  "Assistance (optional): Push, Pull and Single-Leg/Core, 25–50 reps each. Pick from the catalogue.";
export const ASSISTANCE_NOTE_ANCHOR =
  "Assistance (optional): Push, Pull and Single-Leg/Core, 50–100 reps each. Pick from the catalogue.";

export const weekLabels = (n: number, offset = 0) => Array.from({ length: n }, (_, i) => `Week ${i + 1 + offset}`);
