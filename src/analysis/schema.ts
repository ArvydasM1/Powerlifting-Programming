/** §15.5 report schema. Anything that fails validation is shown as a failure and never acted on. */
import { z } from "zod";
import { LIFTS } from "@/domain/types";

const lift = z.enum(LIFTS);

export const perLiftSchema = z.object({
  lift,
  trend: z.enum(["up", "flat", "down"]),
  e1rmChange12w: z.number().nullable(),
  bestRecent: z.object({ weight: z.number(), reps: z.number(), date: z.string().nullable() }).nullable(),
  notes: z.string().max(600),
});

export const attentionSchema = z.object({
  kind: z.enum(["performance", "recovery", "consistency", "load"]),
  severity: z.enum(["info", "watch", "discuss"]),
  evidence: z.array(z.object({ metric: z.string(), values: z.array(z.union([z.number(), z.string()])).max(30), dates: z.array(z.string()).max(30) })).max(6),
  text: z.string().max(500),
});

export const exerciseProposalSchema = z.object({
  exerciseId: z.string().nullable(),
  newName: z.string().max(60).nullable(),
  category: z.enum(["push", "pull", "singleLegCore"]),
  reason: z.string().max(400),
  suggestedSetsReps: z.string().max(40),
  forDays: z.array(z.string().max(40)).max(7),
});

export const programProposalSchema = z.object({
  templateId: z.enum(["krypteia", "five-and-dime", "coffinworm", "fbbbb", "leviathan", "god-is-a-beast", "pervertor"]),
  reason: z.string().max(600),
  tmProposal: z.object({ Squat: z.number(), Bench: z.number(), Press: z.number(), Deadlift: z.number() }),
  options: z.object({ includeDeload: z.boolean(), includeTmTest: z.boolean(), includeAssistance: z.boolean() }),
  startDate: z.string(),
});

export const reportSchema = z.object({
  performance: z.object({
    perLift: z.array(perLiftSchema).max(4),
    adherence: z.object({
      sessionsPlanned: z.number(),
      sessionsDone: z.number(),
      skippedSets: z.number(),
      avgRestByBlockType: z.object({ main: z.number().nullable(), supplemental: z.number().nullable(), assistance: z.number().nullable() }),
    }),
    summary: z.string().max(2400),
  }),
  attention: z.array(attentionSchema).max(10),
  exerciseProposals: z.array(exerciseProposalSchema).max(8),
  programProposal: programProposalSchema.nullable(),
});

export type Report = z.infer<typeof reportSchema>;
export type AttentionItem = z.infer<typeof attentionSchema>;
export type ExerciseProposal = z.infer<typeof exerciseProposalSchema>;
export type ProgramProposal = z.infer<typeof programProposalSchema>;

export function parseReport(input: unknown): { ok: true; report: Report } | { ok: false; error: string } {
  const r = reportSchema.safeParse(input);
  return r.success ? { ok: true, report: r.data } : { ok: false, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
}

/** Accepts raw model text: JSON, or JSON inside a ```json fence. */
export function parseReportText(text: string): ReturnType<typeof parseReport> {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fence ? fence[1] : text)!.trim();
  try {
    return parseReport(JSON.parse(candidate));
  } catch (e) {
    return { ok: false, error: `not JSON: ${(e as Error).message}` };
  }
}
