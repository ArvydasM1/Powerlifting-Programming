/**
 * §15.2 providers. All take the same bundle, prompt and schema; only who runs the model differs.
 * Provider 3 (Claude Code) has no runtime call: the app imports its report.json (see analysis/run.mjs).
 */
import { getKey } from "./keys";
import { composePrompt, estimateTokens, type PromptKind } from "./prompt";
import { parseReport, parseReportText, reportSchema, type Report } from "./schema";

export type ProviderId = "share" | "gemini-free" | "claude-code" | "anthropic-api";

export interface ProviderResult {
  report: Report;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export interface Estimate {
  inputTokens: number;
  costUsd: number | null;
  note: string;
}

export interface AnalysisProvider {
  id: ProviderId;
  label: string;
  costNote: string;
  /** whether a live run is possible (key present etc.) */
  ready(): Promise<{ ok: boolean; reason?: string }>;
  estimate(kind: PromptKind, bundleJson: string): Promise<Estimate>;
  /** live run; providers 1 and 3 throw because they have no live path */
  run(kind: PromptKind, bundleJson: string): Promise<ProviderResult>;
}

export const PROVIDER_ORDER: ProviderId[] = ["share", "gemini-free", "claude-code", "anthropic-api"];

/** Claude list prices per MTok (input, output) at spec time; shown as an estimate only. */
export const CLAUDE_PRICES: Record<string, [number, number]> = {
  "claude-opus-5": [5, 25],
  "claude-sonnet-5": [2, 10],
  "claude-haiku-4-5": [1, 5],
};
export const CLAUDE_MODELS = Object.keys(CLAUDE_PRICES);
export const DEFAULT_CLAUDE_MODEL = "claude-opus-5";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

const REPORT_OUTPUT_TOKENS = 4000;

export function costFor(model: string, inputTokens: number, outputTokens = REPORT_OUTPUT_TOKENS): number | null {
  const p = CLAUDE_PRICES[model];
  return p ? (inputTokens * p[0] + outputTokens * p[1]) / 1_000_000 : null;
}

// ---- 1. share-and-paste ------------------------------------------------------------

export const shareProvider: AnalysisProvider = {
  id: "share",
  label: "Share to Claude / Gemini app, paste the reply",
  costNote: "No cost. Covered by your subscription.",
  ready: async () => ({ ok: true }),
  estimate: async (kind, bundle) => ({ inputTokens: estimateTokens(composePrompt(kind, bundle).system + bundle), costUsd: 0, note: "estimate" }),
  run: async () => {
    throw new Error("Share provider has no live run; use the share file and paste the reply.");
  },
};

/** Provider 1 and 3: validate a pasted or imported reply. */
export function parsePastedReport(text: string): ReturnType<typeof parseReportText> {
  return parseReportText(text);
}

// ---- 2. Gemini free tier -------------------------------------------------------------

export function geminiProvider(model = DEFAULT_GEMINI_MODEL): AnalysisProvider {
  const base = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`;
  return {
    id: "gemini-free",
    label: `Gemini API free tier (${model})`,
    costNote: "No cost. Google may use free-tier data to improve its models; health data is never sent on this provider.",
    ready: async () => ((await getKey("gemini")) ? { ok: true } : { ok: false, reason: "No Gemini key saved" }),
    estimate: async (kind, bundle) => {
      const key = await getKey("gemini");
      const p = composePrompt(kind, bundle);
      if (!key) return { inputTokens: estimateTokens(p.system + p.user), costUsd: 0, note: "estimate" };
      try {
        const res = await fetch(`${base}:countTokens?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: p.system + "\n\n" + p.user }] }] }),
        });
        const j = (await res.json()) as { totalTokens?: number };
        return { inputTokens: j.totalTokens ?? estimateTokens(p.system + p.user), costUsd: 0, note: "counted" };
      } catch {
        return { inputTokens: estimateTokens(p.system + p.user), costUsd: 0, note: "estimate" };
      }
    },
    run: async (kind, bundle) => {
      const key = await getKey("gemini");
      if (!key) throw new Error("No Gemini key saved");
      const p = composePrompt(kind, bundle);
      const res = await fetch(`${base}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: p.system }] },
          contents: [{ role: "user", parts: [{ text: p.user }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: 8192 },
        }),
      });
      if (res.status === 429) throw new Error("Gemini free-tier limit reached; try again tomorrow.");
      if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const j = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
      const text = j.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("") ?? "";
      const parsed = parseReportText(text);
      if (!parsed.ok) throw new Error(`Report failed validation: ${parsed.error}`);
      return { report: parsed.report, model, inputTokens: j.usageMetadata?.promptTokenCount ?? null, outputTokens: j.usageMetadata?.candidatesTokenCount ?? null, costUsd: 0 };
    },
  };
}

// ---- 3. Claude Code on the laptop ------------------------------------------------------

export const claudeCodeProvider: AnalysisProvider = {
  id: "claude-code",
  label: "Claude Code on your computer (import report.json)",
  costNote: "No extra cost beyond your subscription. Export the bundle, run analysis/run.mjs, import the report.",
  ready: async () => ({ ok: true }),
  estimate: async (kind, bundle) => ({ inputTokens: estimateTokens(composePrompt(kind, bundle).system + bundle), costUsd: 0, note: "estimate" }),
  run: async () => {
    throw new Error("Claude Code provider has no live run; export the bundle and import report.json.");
  },
};

// ---- 4. Anthropic API --------------------------------------------------------------------

export function anthropicProvider(model = DEFAULT_CLAUDE_MODEL): AnalysisProvider {
  const client = async () => {
    const key = await getKey("anthropic");
    if (!key) throw new Error("No Anthropic key saved");
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    // single-user app: the key belongs to the person who installed it (§15.2)
    return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  };
  return {
    id: "anthropic-api",
    label: `Claude API (${model})`,
    costNote: "Metered. Estimate shown before each run.",
    ready: async () => ((await getKey("anthropic")) ? { ok: true } : { ok: false, reason: "No Anthropic key saved" }),
    estimate: async (kind, bundle) => {
      const p = composePrompt(kind, bundle);
      try {
        const c = await client();
        const r = await c.messages.countTokens({ model, system: p.system, messages: [{ role: "user", content: p.user }] });
        return { inputTokens: r.input_tokens, costUsd: costFor(model, r.input_tokens), note: "counted" };
      } catch {
        const n = estimateTokens(p.system + p.user);
        return { inputTokens: n, costUsd: costFor(model, n), note: "estimate" };
      }
    },
    run: async (kind, bundle) => {
      const c = await client();
      const p = composePrompt(kind, bundle);
      const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
      const res = await c.beta.messages.create({
        model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        system: [{ type: "text", text: p.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: p.user }],
        output_config: { effort: "high", format: zodOutputFormat(reportSchema) },
      });
      if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
      const text = res.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("");
      const parsed = parseReportText(text);
      if (!parsed.ok) throw new Error(`Report failed validation: ${parsed.error}`);
      const inTok = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
      return { report: parsed.report, model: res.model, inputTokens: inTok, outputTokens: res.usage.output_tokens, costUsd: costFor(model, inTok, res.usage.output_tokens) };
    },
  };
}

export function providerFor(id: ProviderId, models: { anthropic: string; gemini: string }): AnalysisProvider {
  switch (id) {
    case "share":
      return shareProvider;
    case "gemini-free":
      return geminiProvider(models.gemini);
    case "claude-code":
      return claudeCodeProvider;
    case "anthropic-api":
      return anthropicProvider(models.anthropic);
  }
}

export { parseReport };
