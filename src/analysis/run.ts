/** §15 orchestration: build bundle → provider → guard → store AnalysisRun. */
import type { AppDB } from "@/data/db";
import type { AnalysisRun, Settings } from "@/domain/types";
import { buildBundle, type BundleOptions } from "./bundle";
import { guardReport } from "./guard";
import { shareFileText, type PromptKind } from "./prompt";
import { parsePastedReport, providerFor, type ProviderId } from "./providers";
import type { Report } from "./schema";

export interface AnalysisSettings {
  provider: ProviderId;
  anthropicModel: string;
  geminiModel: string;
}

export const DEFAULT_ANALYSIS: AnalysisSettings = { provider: "share", anthropicModel: "claude-opus-5", geminiModel: "gemini-2.5-flash" };

export function analysisSettings(s: Settings): AnalysisSettings {
  return { ...DEFAULT_ANALYSIS, ...(s.analysis ?? {}) };
}

function bundleOptions(provider: ProviderId, opts: BundleOptions): BundleOptions {
  // §15.3: the free Gemini tier never receives health data
  return provider === "gemini-free" ? { ...opts, includeHealth: false } : opts;
}

export async function prepare(db: AppDB, s: AnalysisSettings, kind: PromptKind, opts: BundleOptions) {
  const o = bundleOptions(s.provider, opts);
  const built = await buildBundle(db, o);
  const provider = providerFor(s.provider, { anthropic: s.anthropicModel, gemini: s.geminiModel });
  const [estimate, ready] = await Promise.all([provider.estimate(kind, built.json), provider.ready()]);
  return { ...built, options: o, provider, estimate, ready, shareText: shareFileText(kind, built.json) };
}

async function currentTM(db: AppDB) {
  const rows = await db.trainingMax.orderBy("effectiveFrom").toArray();
  const tm = { Squat: 0, Bench: 0, Press: 0, Deadlift: 0 };
  for (const r of rows) tm[r.lift] = r.value;
  return tm;
}

export async function storeRun(db: AppDB, args: { provider: ProviderId; model: string | null; kind: PromptKind; hash: string; opts: BundleOptions; report: Report | null; error: string | null; inputTokens: number | null; outputTokens: number | null; costUsd: number | null }): Promise<AnalysisRun> {
  const run: AnalysisRun = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    provider: args.provider,
    model: args.model,
    promptKind: args.kind,
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    costUsd: args.costUsd,
    bundleHash: args.hash,
    includedHealth: args.opts.includeHealth,
    includedNotes: args.opts.includeNotes,
    report: args.report,
    status: args.report ? "ok" : "invalid",
    error: args.error,
    acceptedProposals: [],
  };
  await db.analysisRuns.add(run);
  return run;
}

/** Live run for providers 2 and 4. */
export async function runLive(db: AppDB, s: AnalysisSettings, kind: PromptKind, opts: BundleOptions): Promise<AnalysisRun> {
  const p = await prepare(db, s, kind, opts);
  try {
    const r = await p.provider.run(kind, p.json);
    return storeRun(db, { provider: s.provider, model: r.model, kind, hash: p.hash, opts: p.options, report: r.report, error: null, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: r.costUsd });
  } catch (e) {
    return storeRun(db, { provider: s.provider, model: null, kind, hash: p.hash, opts: p.options, report: null, error: (e as Error).message, inputTokens: p.estimate.inputTokens, outputTokens: null, costUsd: null });
  }
}

/** Providers 1 and 3: a pasted or imported reply. */
export async function acceptPasted(db: AppDB, s: AnalysisSettings, kind: PromptKind, opts: BundleOptions, hash: string, text: string): Promise<AnalysisRun> {
  const parsed = parsePastedReport(text);
  return storeRun(db, {
    provider: s.provider === "claude-code" ? "claude-code" : "share",
    model: null,
    kind,
    hash,
    opts: bundleOptions(s.provider, opts),
    report: parsed.ok ? parsed.report : null,
    error: parsed.ok ? null : parsed.error,
    inputTokens: null,
    outputTokens: null,
    costUsd: 0,
  });
}

export async function guardedView(db: AppDB, report: Report, step: number) {
  return guardReport(report, await currentTM(db), step);
}
