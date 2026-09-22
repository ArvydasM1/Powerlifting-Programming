/**
 * Template schema, §5.4 of SPEC.md. Templates are data (JSON/TS) validated with zod.
 */
import { z } from "zod";
import { LIFTS } from "./types";
import { isValidRepTarget } from "./calc";

const repTarget = z.string().refine(isValidRepTarget, { message: "invalid rep target" });
const lift = z.enum(LIFTS);

export const mainSetSchema = z.object({
  pct: z.number().min(0.1).max(1.5),
  reps: repTarget,
  optional: z.boolean().optional(),
  note: z.string().optional(),
});

export const mainBlockSchema = z.object({
  type: z.literal("main"),
  lift,
  sets: z.array(mainSetSchema).min(1),
  restSec: z.number().int().positive().optional(),
  optional: z.boolean().optional(),
  label: z.string().optional(),
});

export const supplementalBlockSchema = z
  .object({
    type: z.literal("supplemental"),
    lift,
    scheme: z.enum(["FSL", "SSL", "pct"]),
    pct: z.number().min(0.1).max(1.5).optional(),
    sets: z.number().int().positive(),
    reps: repTarget,
    restSec: z.number().int().positive().optional(),
    optional: z.boolean().optional(),
    label: z.string().optional(),
  })
  .refine((b) => b.scheme !== "pct" || b.pct !== undefined, { message: "pct scheme needs pct" });

export const assistanceBlockSchema = z.object({
  type: z.literal("assistance"),
  exercise: z.string().min(1),
  sets: z.number().int().positive(),
  reps: repTarget,
  superset: z.boolean().optional(),
  restSec: z.number().int().positive().optional(),
  /** always optional per §6.9; kept explicit for clarity */
  optional: z.literal(true).optional().default(true),
  label: z.string().optional(),
});

export const blockSchema = z.discriminatedUnion("type", [
  mainBlockSchema,
  supplementalBlockSchema,
  assistanceBlockSchema,
]);

export const sessionTemplateSchema = z.object({
  label: z.string().min(1),
  blocks: z.array(blockSchema).min(1),
});

export const weekTemplateSchema = z.object({
  label: z.string().min(1),
  sessions: z.array(sessionTemplateSchema).min(1),
});

export const trainingPhaseSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["prep", "leader", "anchor"]),
  tmOffset: z.number().int().min(0),
  weeks: z.array(weekTemplateSchema).min(1),
});

export const seventhWeekPhaseSchema = z.object({
  name: z.string().min(1),
  kind: z.literal("seventhWeek"),
  protocol: z.enum(["deload", "tmTest"]),
  tmOffset: z.number().int().min(0),
  optional: z.literal(true),
  /** which lifts to include; defaults to all four */
  lifts: z.array(lift).optional(),
});

export const phaseSchema = z.discriminatedUnion("kind", [
  trainingPhaseSchema.extend({ kind: z.literal("prep") }),
  trainingPhaseSchema.extend({ kind: z.literal("leader") }),
  trainingPhaseSchema.extend({ kind: z.literal("anchor") }),
  seventhWeekPhaseSchema,
]);

export const templateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().min(1),
  /** typical sessions per week, used for scheduling */
  daysPerWeek: z.number().int().min(1).max(7),
  /** guideline note shown when the template has no explicit assistance */
  assistanceNote: z.string().optional(),
  phases: z.array(phaseSchema).min(1),
});

export type MainSetTemplate = z.infer<typeof mainSetSchema>;
export type MainBlock = z.infer<typeof mainBlockSchema>;
export type SupplementalBlock = z.infer<typeof supplementalBlockSchema>;
export type AssistanceBlock = z.infer<typeof assistanceBlockSchema>;
export type Block = z.infer<typeof blockSchema>;
export type SessionTemplate = z.infer<typeof sessionTemplateSchema>;
export type WeekTemplate = z.infer<typeof weekTemplateSchema>;
export type TrainingPhase = Extract<z.infer<typeof phaseSchema>, { weeks: unknown }>;
export type SeventhWeekPhase = z.infer<typeof seventhWeekPhaseSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type Template = z.infer<typeof templateSchema>;

export function validateTemplate(input: unknown): Template {
  return templateSchema.parse(input);
}

export function isTrainingPhase(p: Phase): p is TrainingPhase {
  return p.kind !== "seventhWeek";
}
