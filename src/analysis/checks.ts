/** §15.6 rule-based checks. Run locally before any model call and shown even without one. */
import { e1rm } from "@/domain/calc";
import { LIFTS, type Lift, type PRRecord, type Session, type SessionVitals, type WorkoutSet } from "@/domain/types";

export interface CheckFact {
  kind: "performance" | "recovery" | "consistency" | "load";
  severity: "info" | "watch";
  text: string;
  evidence: { metric: string; values: Array<number | string>; dates: string[] };
}

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const daysAgo = (iso: string, now: Date) => (now.getTime() - Date.parse(iso)) / 86_400_000;

export function runChecks(args: { now: Date; sessions: Session[]; sets: WorkoutSet[]; prs: PRRecord[]; vitals: SessionVitals[]; step: number }): CheckFact[] {
  const { now, sessions, sets, prs, vitals, step } = args;
  const facts: CheckFact[] = [];

  // 1. e1RM regression over 6 weeks per lift
  for (const lift of LIFTS as readonly Lift[]) {
    const dated = prs.filter((p) => p.lift === lift && p.date && p.e1rm !== null).sort((a, b) => a.date!.localeCompare(b.date!));
    const recent = dated.filter((p) => daysAgo(p.date!, now) <= 42);
    const earlier = dated.filter((p) => daysAgo(p.date!, now) > 42 && daysAgo(p.date!, now) <= 126);
    if (recent.length >= 2 && earlier.length >= 2) {
      const r = Math.max(...recent.map((p) => p.e1rm!));
      const e = Math.max(...earlier.map((p) => p.e1rm!));
      if (r < e - step) {
        facts.push({
          kind: "performance",
          severity: "watch",
          text: `${lift} best e1RM in the last 6 weeks (${r}) is below the previous 12 weeks' best (${e}).`,
          evidence: { metric: `${lift} e1RM`, values: [e, r], dates: [earlier.at(-1)!.date!, recent.at(-1)!.date!] },
        });
      }
    }
  }

  // 2. three or more missed (skipped) sessions in a row
  const ordered = sessions.filter((s) => s.status !== "beforeStart").sort((a, b) => a.ordinal - b.ordinal);
  let run = 0;
  let runStart: Session | null = null;
  for (const s of ordered) {
    if (s.status === "skipped") {
      run++;
      runStart ??= s;
      if (run === 3) {
        facts.push({ kind: "consistency", severity: "watch", text: "Three or more sessions in a row were skipped.", evidence: { metric: "skipped sessions", values: [run], dates: [runStart.plannedDate ?? runStart.date ?? ""] } });
      }
    } else if (s.status === "done" || s.status === "backfilled") {
      run = 0;
      runStart = null;
    }
  }

  // 3. resting HR 10 % above its 8-week median for 5 readings; 4. HRV 20 % below median
  const byDate = new Map(sessions.map((s) => [s.id, s.date ?? s.plannedDate ?? ""]));
  const withDates = vitals.map((v) => ({ v, date: byDate.get(v.sessionId) ?? "" })).filter((x) => x.date).sort((a, b) => a.date.localeCompare(b.date));
  const rhr = withDates.filter((x) => x.v.restingHr !== null && daysAgo(x.date, now) <= 56);
  const rhrMed = median(rhr.map((x) => x.v.restingHr!));
  if (rhrMed !== null) {
    const high = rhr.slice(-5).filter((x) => x.v.restingHr! > rhrMed * 1.1);
    if (high.length >= 5) facts.push({ kind: "recovery", severity: "watch", text: `Resting heart rate has been more than 10 % above its 8-week median (${rhrMed}) for the last five readings.`, evidence: { metric: "resting HR", values: high.map((x) => x.v.restingHr!), dates: high.map((x) => x.date) } });
  }
  const hrv = withDates.filter((x) => x.v.hrvRmssd !== null && daysAgo(x.date, now) <= 56);
  const hrvMed = median(hrv.map((x) => x.v.hrvRmssd!));
  if (hrvMed !== null) {
    const low = hrv.slice(-3).filter((x) => x.v.hrvRmssd! < hrvMed * 0.8);
    if (low.length >= 3) facts.push({ kind: "recovery", severity: "watch", text: `HRV has been more than 20 % below its 8-week median (${hrvMed} ms) for the last three readings.`, evidence: { metric: "HRV rMSSD", values: low.map((x) => x.v.hrvRmssd!), dates: low.map((x) => x.date) } });
  }

  // 5. main-lift rest averages doubling vs the previous 4 weeks
  const restOf = (from: number, to: number) => {
    const ids = new Set(sessions.filter((s) => s.date && daysAgo(s.date, now) > from && daysAgo(s.date, now) <= to).map((s) => s.id));
    const xs = sets.filter((x) => ids.has(x.sessionId) && x.blockType === "main" && x.actualRestSec !== null).map((x) => x.actualRestSec!);
    return xs.length >= 5 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const recentRest = restOf(0, 14);
  const priorRest = restOf(14, 42);
  if (recentRest !== null && priorRest !== null && recentRest >= priorRest * 2) {
    facts.push({ kind: "load", severity: "info", text: `Average rest on main-lift sets in the last two weeks (${Math.round(recentRest)} s) is at least double the previous four weeks (${Math.round(priorRest)} s).`, evidence: { metric: "avg main rest (s)", values: [Math.round(priorRest), Math.round(recentRest)], dates: [] } });
  }

  // 6. informational: PR count last 4 weeks
  const recentPRs = prs.filter((p) => p.date && daysAgo(p.date, now) <= 28);
  if (recentPRs.length > 0) {
    const best = recentPRs.map((p) => `${p.lift} ${p.weight}×${p.reps} (e1RM ${p.e1rm ?? e1rm(p.weight, p.reps, step) ?? "?"})`);
    facts.push({ kind: "performance", severity: "info", text: `${recentPRs.length} PR attempt${recentPRs.length === 1 ? "" : "s"} logged in the last four weeks.`, evidence: { metric: "PR attempts", values: best.slice(0, 10), dates: recentPRs.map((p) => p.date!).slice(0, 10) } });
  }

  return facts;
}
