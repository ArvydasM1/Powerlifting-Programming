import { describe, expect, it } from "vitest";
import { buildBundle } from "@/analysis/bundle";
import { runChecks } from "@/analysis/checks";
import { DISCUSS_SUFFIX, guardAttention, guardTM } from "@/analysis/guard";
import { composePrompt, SYSTEM_PROMPT } from "@/analysis/prompt";
import { parseReportText, type Report } from "@/analysis/schema";
import { AppDB } from "@/data/db";
import { createRepo } from "@/data/repo";
import type { PRRecord, Session, SessionVitals } from "@/domain/types";
import { getTemplate } from "../templates";

const validReport: Report = {
  performance: {
    perLift: [{ lift: "Squat", trend: "up", e1rmChange12w: 5, bestRecent: { weight: 142.5, reps: 5, date: "2026-09-01" }, notes: "steady" }],
    adherence: { sessionsPlanned: 12, sessionsDone: 11, skippedSets: 3, avgRestByBlockType: { main: 170, supplemental: 90, assistance: null } },
    summary: "Good block.",
  },
  attention: [
    { kind: "recovery", severity: "discuss", evidence: [{ metric: "resting HR", values: [58, 64], dates: ["2026-09-01", "2026-09-10"] }], text: "Resting heart rate rose 10 % over two weeks." },
    { kind: "recovery", severity: "watch", evidence: [], text: "This pattern suggests atrial fibrillation." },
  ],
  exerciseProposals: [{ exerciseId: "face-pull", newName: null, category: "pull", reason: "shoulder health", suggestedSetsReps: "3×20", forDays: ["Press day"] }],
  programProposal: { templateId: "leviathan", reason: "time for heavier singles", tmProposal: { Squat: 150, Bench: 120, Press: 60, Deadlift: 170 }, options: { includeDeload: true, includeTmTest: true, includeAssistance: true }, startDate: "2026-10-01" },
};

describe("report schema", () => {
  it("accepts a valid report, also inside a code fence", () => {
    expect(parseReportText(JSON.stringify(validReport)).ok).toBe(true);
    expect(parseReportText("Here you go:\n```json\n" + JSON.stringify(validReport) + "\n```").ok).toBe(true);
  });
  it("rejects a wrong template id and junk", () => {
    const bad = { ...validReport, programProposal: { ...validReport.programProposal!, templateId: "smolov" } };
    expect(parseReportText(JSON.stringify(bad)).ok).toBe(false);
    expect(parseReportText("not json").ok).toBe(false);
  });
});

describe("guards", () => {
  it("withholds items naming a condition and suffixes discuss items", () => {
    const g = guardAttention(validReport.attention);
    expect(g[0]!.withheld).toBeNull();
    expect(g[0]!.displayText.endsWith(DISCUSS_SUFFIX)).toBe(true);
    expect(g[1]!.withheld).toMatch(/atrial fibrillation/);
    expect(g[1]!.displayText).toBe("");
  });
  it("clamps TM proposals outside ±10 %", () => {
    const g = guardTM(validReport.programProposal!.tmProposal, { Squat: 145, Bench: 95, Press: 57.5, Deadlift: 162.5 }, 2.5);
    expect(g.find((x) => x.lift === "Squat")).toMatchObject({ clamped: false, used: 150 });
    expect(g.find((x) => x.lift === "Bench")).toMatchObject({ clamped: true, used: 95 });
  });
});

describe("prompt", () => {
  it("is byte-stable and names every template", () => {
    expect(composePrompt("full", "{}").system).toBe(SYSTEM_PROMPT);
    for (const id of ["krypteia", "five-and-dime", "coffinworm", "fbbbb", "leviathan", "god-is-a-beast", "pervertor"]) expect(SYSTEM_PROMPT).toContain(id);
    expect(SYSTEM_PROMPT).toMatch(/Never name a medical condition/);
  });
});

describe("rule-based checks", () => {
  const now = new Date("2026-09-23T00:00:00Z");
  it("flags an e1RM regression and a resting-HR rise", () => {
    const prs: PRRecord[] = [
      { lift: "Squat", date: "2026-06-01", ordinal: 1, weight: 140, reps: 5, e1rm: 157.5, source: "logged", dateApproximate: false },
      { lift: "Squat", date: "2026-06-15", ordinal: 2, weight: 142.5, reps: 5, e1rm: 160, source: "logged", dateApproximate: false },
      { lift: "Squat", date: "2026-09-01", ordinal: 3, weight: 130, reps: 5, e1rm: 147.5, source: "logged", dateApproximate: false },
      { lift: "Squat", date: "2026-09-15", ordinal: 4, weight: 132.5, reps: 5, e1rm: 150, source: "logged", dateApproximate: false },
    ];
    // 11 readings: six at 55 (median 55) then five at 63 (> 10 % above median)
    const sessions = Array.from({ length: 11 }, (_, i) => ({ id: `s${i}`, date: `2026-09-${String(5 + i).padStart(2, "0")}`, plannedDate: null, ordinal: i, status: "done" }) as Session);
    const vitals = sessions.map((s, i) => ({ sessionId: s.id, restingHr: i < 6 ? 55 : 63, hrvRmssd: null, samples: [], perSet: [] }) as unknown as SessionVitals);
    const facts = runChecks({ now, sessions, sets: [], prs, vitals, step: 2.5 });
    expect(facts.some((f) => f.text.includes("Squat best e1RM"))).toBe(true);
    expect(facts.some((f) => f.text.includes("Resting heart rate"))).toBe(true);
  });
});

describe("bundle", () => {
  it("builds from the database, strips health when not included", async () => {
    const db = new AppDB(`bundle-${Date.now()}`);
    const repo = createRepo(db);
    await repo.ensureSeeded();
    await repo.setAllTM({ Squat: 145, Bench: 95, Press: 57.5, Deadlift: 162.5 }, "manual", "2026-09-01");
    const program = await repo.createProgram({ template: getTemplate("five-and-dime")!, baseTM: { Squat: 145, Bench: 95, Press: 57.5, Deadlift: 162.5 }, options: { includeDeload: false, includeTmTest: false, includeAssistance: false }, anchorDate: "2026-09-21", trainingDays: [1, 3, 5] });
    const next = (await repo.nextSession(program.id))!;
    const sets = await repo.sessionSets(next.id);
    await repo.logSet(sets[0]!.id);
    await repo.finishSession(next.id);
    await db.sessionVitals.put({ sessionId: next.id, hrSource: "ble:x", hrAvg: 120, hrMax: 150, samples: [], perSet: [], restingHr: 55, hrvRmssd: 40, sleepMinutes: 420, sleepStages: null, readAt: null, attempts: 0 });
    const withHealth = await buildBundle(db, { includeHealth: true, includeNotes: false });
    const without = await buildBundle(db, { includeHealth: false, includeNotes: false });
    expect(withHealth.bundle.vitals).toHaveLength(1);
    expect(without.bundle.vitals).toBeUndefined();
    expect(without.json).not.toContain("restingHr");
    expect(withHealth.bundle.sessions).toHaveLength(1);
    expect(withHealth.bundle.templates).toHaveLength(7);
    expect(withHealth.hash).not.toBe(without.hash);
  });
});
