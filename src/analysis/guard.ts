/** §15.1 / §15.7 guardrails: diagnosis filter and the ±10 % TM clamp. Applied to every provider's output. */
import { roundToStep } from "@/domain/calc";
import { LIFTS, type LiftMap } from "@/domain/types";
import type { AttentionItem, Report } from "./schema";

/** Terms that name a condition. An attention item containing one is withheld, never shown. */
export const DIAGNOSIS_TERMS = [
  "arrhythmia",
  "atrial fibrillation",
  "afib",
  "tachycardia",
  "bradycardia",
  "heart disease",
  "heart failure",
  "cardiomyopathy",
  "hypertension",
  "hypotension",
  "diabetes",
  "anaemia",
  "anemia",
  "overtraining syndrome",
  "rhabdomyolysis",
  "thyroid",
  "hyperthyroid",
  "hypothyroid",
  "sleep apnea",
  "sleep apnoea",
  "depression",
  "anxiety disorder",
  "infection",
  "covid",
  "flu",
  "tendinopathy",
  "tendonitis",
  "hernia",
  "disc",
  "stress fracture",
  "concussion",
  "myocarditis",
  "diagnos",
  "you have",
  "you are suffering",
  "prescri",
];

export const DISCUSS_SUFFIX = " Consider discussing this with a medical professional.";

export function isDiagnosis(text: string): string | null {
  const t = text.toLowerCase();
  return DIAGNOSIS_TERMS.find((term) => t.includes(term)) ?? null;
}

export interface GuardedAttention {
  item: AttentionItem;
  withheld: string | null;
  displayText: string;
}

export function guardAttention(items: AttentionItem[]): GuardedAttention[] {
  return items.map((item) => {
    const hit = isDiagnosis(item.text) ?? item.evidence.map((e) => isDiagnosis(e.metric)).find(Boolean) ?? null;
    return {
      item,
      withheld: hit ? `withheld: names a condition ("${hit}")` : null,
      displayText: hit ? "" : item.severity === "discuss" ? item.text.trimEnd() + DISCUSS_SUFFIX : item.text,
    };
  });
}

export interface GuardedTM {
  lift: (typeof LIFTS)[number];
  proposed: number;
  used: number;
  clamped: boolean;
}

/** TM proposals outside ±10 % of the current TM are struck through and the current TM is used. */
export function guardTM(proposal: LiftMap<number>, current: LiftMap<number>, step: number): GuardedTM[] {
  return LIFTS.map((lift) => {
    const cur = current[lift];
    const p = proposal[lift];
    const ok = cur > 0 && Math.abs(p - cur) <= cur * 0.1;
    return { lift, proposed: p, used: ok ? roundToStep(p, step) : cur, clamped: !ok };
  });
}

export function guardReport(report: Report, currentTM: LiftMap<number>, step: number) {
  return {
    attention: guardAttention(report.attention),
    tm: report.programProposal ? guardTM(report.programProposal.tmProposal, currentTM, step) : null,
  };
}
