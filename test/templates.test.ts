/**
 * Regression fixtures derived from the workbook (SPEC F2 acceptance, Appendix A).
 * TMs 145 / 95 / 57.5 / 162.5, rounding 2.5, increases 2.5 / 2.5 / 2.5 / 5.
 */
import { describe, expect, it } from "vitest";
import { expandProgram, scheduleDates, type ExpandInput } from "@/domain/expand";
import type { Session, WorkoutSet } from "@/domain/types";
import { TEMPLATES, getTemplate } from "../templates";

const WORKBOOK: Pick<ExpandInput, "baseTM" | "cycleIncrease" | "roundingStep" | "defaultRestSec" | "options" | "startAt"> = {
  baseTM: { Squat: 145, Bench: 95, Press: 57.5, Deadlift: 162.5 },
  cycleIncrease: { Squat: 2.5, Bench: 2.5, Press: 2.5, Deadlift: 5 },
  roundingStep: 2.5,
  defaultRestSec: { main: 180, supplemental: 90, assistance: 60, superset: 45 },
  options: { includeDeload: true, includeTmTest: true, includeAssistance: true },
  startAt: { phaseIndex: 0, weekIndex: 0, sessionIndex: 0 },
};

let counter = 0;
const newId = () => `id-${++counter}`;

function expand(templateId: string, overrides: Partial<ExpandInput> = {}) {
  const template = getTemplate(templateId)!;
  return expandProgram({ template, programId: "p1", newId, ...WORKBOOK, ...overrides });
}

function find(out: ReturnType<typeof expand>, phaseName: string, weekLabel: string, sessionLabelPart: string): Session {
  const s = out.sessions.find((x) => x.phaseName === phaseName && x.plannedLabel.includes(`· ${weekLabel} ·`) && x.plannedLabel.includes(sessionLabelPart));
  if (!s) throw new Error(`no session ${phaseName} / ${weekLabel} / ${sessionLabelPart}`);
  return s;
}

function weightsReps(out: ReturnType<typeof expand>, session: Session, lift: string, blockType?: WorkoutSet["blockType"]): string[] {
  return out.sets
    .filter((x) => x.sessionId === session.id && x.exerciseId === lift && (!blockType || x.blockType === blockType))
    .sort((a, b) => a.order - b.order)
    .map((x) => `${x.prescribedWeight}x${x.prescribedReps}`);
}

describe("templates validate", () => {
  it("all seven load", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["krypteia", "five-and-dime", "coffinworm", "fbbbb", "leviathan", "god-is-a-beast", "pervertor"]);
  });
  it("every template expands without error", () => {
    for (const t of TEMPLATES) expect(() => expand(t.id)).not.toThrow();
  });
});

describe("Five and Dime (sheet 'Five and Dime')", () => {
  const out = expand("five-and-dime");
  it("Leader 1 week 1", () => {
    const s1 = find(out, "Leader 1", "Week 1", "Session 1");
    expect(weightsReps(out, s1, "Squat")).toEqual(["122.5x5", "122.5x5", "122.5x5", "122.5x5", "122.5x5"]);
    expect(weightsReps(out, s1, "Bench")).toEqual(["62.5x5", "72.5x5", "80x10+"]);
    const s2 = find(out, "Leader 1", "Week 1", "Session 2");
    expect(weightsReps(out, s2, "Deadlift")).toEqual(["105x5", "122.5x5", "137.5x10+"]);
    expect(weightsReps(out, s2, "Press")).toEqual(["50x5", "50x5", "50x5", "50x5", "50x5"]);
  });
  it("Leader 2 adds one increment (week 1 squat 5×5 @85 = 125, week 4 deadlift 5×5 @95 = 160)", () => {
    const s1 = find(out, "Leader 2", "Week 1", "Session 1");
    expect(weightsReps(out, s1, "Squat")[0]).toBe("125x5");
    // (TM 97.5) × 0.65/0.75/0.85 — the workbook adds the increase to the weight instead (Appendix B)
    expect(weightsReps(out, s1, "Bench")).toEqual(["62.5x5", "72.5x5", "82.5x10+"]);
    const s12 = find(out, "Leader 2", "Week 4", "Session 3");
    expect(weightsReps(out, s12, "Deadlift")[0]).toBe("160x5");
  });
  it("Anchor is +2 with every five at 85 (week 1 squat 127.5, week 4 press dime 47.5/55/60)", () => {
    const s1 = find(out, "Anchor", "Week 1", "Session 1");
    expect(weightsReps(out, s1, "Squat")[0]).toBe("127.5x5");
    expect(weightsReps(out, s1, "Bench")).toEqual(["65x5", "75x5", "85x10+"]); // TM 100
    const s12 = find(out, "Anchor", "Week 4", "Session 3");
    expect(weightsReps(out, s12, "Press")).toEqual(["47.5x5", "52.5x5", "60x10+"]); // TM 62.5
    expect(weightsReps(out, s12, "Deadlift")[0]).toBe("147.5x5");
  });
});

describe("Coffinworm (sheet 'Coffinworm')", () => {
  const out = expand("coffinworm");
  it("Leader 1 week 1 squat day", () => {
    const s = find(out, "Leader 1", "Week 1", "Squat day");
    expect(weightsReps(out, s, "Squat")).toEqual(["102.5x5", "115x5", "130x5", "115x5", "130x3-5", "145x1-3"]);
    expect(weightsReps(out, s, "Bench")).toEqual(["67.5x5", "67.5x5", "67.5x5", "67.5x5", "67.5x5"]);
  });
  it("Leader 1 week 3 press day", () => {
    const s = find(out, "Leader 1", "Week 3", "Press day");
    expect(weightsReps(out, s, "Press")).toEqual(["37.5x5", "42.5x5", "50x5", "50x5", "50x5", "50x3-5"]);
  });
  it("Anchor week 3 has PR set at 85 % with +2 (squat 127.5)", () => {
    const s = find(out, "Anchor", "Week 3", "Squat day");
    expect(weightsReps(out, s, "Squat")).toEqual(["97.5x5", "112.5x5", "127.5xPR"]); // TM 150
  });
});

describe("FBBBB (sheet 'FBBBB')", () => {
  const out = expand("fbbbb");
  it("Leader 1 week 1", () => {
    const s1 = find(out, "Leader 1", "Week 1", "Deadlift + Bench BBB");
    expect(weightsReps(out, s1, "Deadlift")).toEqual(["105x5", "122.5x5", "137.5x5"]);
    expect(weightsReps(out, s1, "Bench")).toEqual(["47.5x10", "47.5x10", "47.5x10", "47.5x10", "47.5x10"]);
    const s2 = find(out, "Leader 1", "Week 1", "Squat BBB + Press");
    expect(weightsReps(out, s2, "Squat")[0]).toBe("72.5x10");
    expect(weightsReps(out, s2, "Press")).toEqual(["37.5x5", "42.5x5", "50x5"]);
  });
  it("Anchor week 1 5×5 at 65 % (workbook had no increase; spec applies +2: squat TM 150 → 97.5)", () => {
    const s = find(out, "Anchor", "Week 1", "Squat + Bench 5×5");
    expect(weightsReps(out, s, "Squat")).toEqual(["97.5x5", "97.5x5", "97.5x5", "97.5x5", "97.5x5"]);
  });
});

describe("Leviathan (sheet 'Leviathan')", () => {
  const out = expand("leviathan");
  it("Leader 1 week 1 press day: TM single then 5×5 @ SSL", () => {
    const s = find(out, "Leader 1", "Week 1", "Press day");
    expect(weightsReps(out, s, "Press", "main")).toEqual(["40x3", "45x3", "52.5x3", "57.5x1"]);
    expect(weightsReps(out, s, "Press", "supplemental")).toEqual(["45x5", "45x5", "45x5", "45x5", "45x5"]);
  });
  it("Leader 1 week 2 squat day widowmaker at FSL", () => {
    const s = find(out, "Leader 1", "Week 2", "Squat day");
    expect(weightsReps(out, s, "Squat", "supplemental")).toEqual(["102.5x20"]);
  });
  it("Leader 2 week 1 press +1: 42.5/47.5/55/60", () => {
    const s = find(out, "Leader 2", "Week 1", "Press day");
    expect(weightsReps(out, s, "Press", "main")).toEqual(["42.5x3", "47.5x3", "55x3", "60x1"]);
  });
  it("Anchor week 1 press: single then 1+ at 85 % of +2 TM (55)", () => {
    const s = find(out, "Anchor", "Week 1", "Press day");
    expect(weightsReps(out, s, "Press", "main")).toEqual(["45x3", "50x3", "57.5x3", "62.5x1", "52.5x1+"]); // 62.5 × 0.85 = 53.125 → 52.5
    expect(weightsReps(out, s, "Press", "supplemental")).toEqual([]);
  });
});

describe("God is a Beast (sheet 'God is a Beast')", () => {
  const out = expand("god-is-a-beast");
  it("Leader 1 week 1: squat double wave, bench 10×5 @65", () => {
    const sq = find(out, "Leader 1", "Week 1", "Squat day");
    expect(weightsReps(out, sq, "Squat")).toEqual(["102.5x5", "115x5", "130x5", "110x5", "122.5x5", "137.5x5"]);
    const b = find(out, "Leader 1", "Week 1", "Bench day");
    expect(weightsReps(out, b, "Bench")).toHaveLength(10);
    expect(weightsReps(out, b, "Bench")[0]).toBe("62.5x5");
  });
  it("Leader 1 week 5 squat ends with 145×1-3", () => {
    const sq = find(out, "Leader 1", "Week 5", "Squat day");
    expect(weightsReps(out, sq, "Squat")).toEqual(["102.5x5", "115x5", "130x5", "115x5", "130x5", "145x1-3"]);
  });
  it("Leader 2 week 6 bench wave with +1 (97.5 top)", () => {
    const b = find(out, "Leader 2", "Week 6", "Bench day");
    expect(weightsReps(out, b, "Bench").at(-1)).toBe("97.5x1-3");
  });
  it("Anchor week 3 press wave with +2 (62.5×1-3+)", () => {
    const s = find(out, "Anchor", "Week 3", "Deadlift 5×5 + Press wave");
    expect(weightsReps(out, s, "Press")).toEqual(["45x3", "50x3", "57.5x3+", "50x3", "57.5x3", "62.5x1-3+"]);
    expect(weightsReps(out, s, "Deadlift")[0]).toBe("130x5");
  });
});

describe("Pervertor (sheet 'Pervertor')", () => {
  const out = expand("pervertor");
  it("Leader 1 week 1 squat A wave + BBS 10×5 @ FSL", () => {
    const s = find(out, "Leader 1", "Week 1", "Squat day");
    expect(weightsReps(out, s, "Squat", "main")).toEqual(["95x5", "110x5", "122.5x5"]);
    expect(weightsReps(out, s, "Squat", "supplemental")).toHaveLength(10);
    expect(weightsReps(out, s, "Squat", "supplemental")[0]).toBe("95x5");
  });
  it("Leader 1 week 2 squat B wave + BBB 5×10 @ FSL", () => {
    const s = find(out, "Leader 1", "Week 2", "Squat day");
    expect(weightsReps(out, s, "Squat", "supplemental")).toEqual(["102.5x10", "102.5x10", "102.5x10", "102.5x10", "102.5x10"]);
  });
  it("Leader 2 week 3 squat C wave + 5×5 @ SSL (+1 TM: 125)", () => {
    const s = find(out, "Leader 2", "Week 3", "Squat day");
    expect(weightsReps(out, s, "Squat", "main")).toEqual(["110x5", "125x5", "140x5"]); // TM 147.5 × 0.75 = 110.625 → 110
    expect(weightsReps(out, s, "Squat", "supplemental")[0]).toBe("125x5");
  });
  it("Anchor week 1 squat heavy + widowmaker @85 (+2 TM 150)", () => {
    const s = find(out, "Anchor", "Week 1", "Squat heavy");
    expect(weightsReps(out, s, "Squat", "main")).toEqual(["127.5x3", "112.5x5", "142.5x1", "150x1", "157.5x1", "165x1"]);
    expect(weightsReps(out, s, "Squat", "supplemental")).toEqual(["127.5x20"]);
  });
});

describe("Krypteia (book layout, §A1)", () => {
  const out = expand("krypteia");
  it("Part 1 both cycles at the same TM, Part 2 cycle 2 at +1, anchor at +2", () => {
    const c1 = find(out, "Part 1 · Cycle 1", "Week 1", "Squat day");
    const c2 = find(out, "Part 1 · Cycle 2", "Week 4", "Squat day");
    expect(weightsReps(out, c1, "Squat", "main")).toEqual(["95x5", "110x5", "122.5x5"]);
    expect(weightsReps(out, c2, "Squat", "main")).toEqual(weightsReps(out, c1, "Squat", "main"));
    const p2 = find(out, "Part 2 · Cycle 2", "Week 10", "Squat day");
    expect(weightsReps(out, p2, "Squat", "main")).toEqual(["95x5", "110x5", "125x5"]);
    expect(weightsReps(out, p2, "Squat", "supplemental")).toHaveLength(5);
    expect(weightsReps(out, p2, "Squat", "supplemental")[0]).toBe("95x10");
    const a = find(out, "Part 3 · Anchor", "Week 13", "Bench day");
    expect(weightsReps(out, a, "Bench", "main")).toEqual(["65x5", "75x5", "85x5+"]);
  });
  it("Press only trains in Part 1", () => {
    const pressSessions = out.sessions.filter((s) => s.plannedLabel.endsWith("Press day"));
    expect(pressSessions.every((s) => s.phaseName.startsWith("Part 1"))).toBe(true);
  });
  it("assistance is supersetted and optional", () => {
    const s = find(out, "Part 1 · Cycle 1", "Week 1", "Deadlift day");
    const groups = out.groups.filter((g) => g.sessionId === s.id && g.type === "assistance");
    expect(groups.map((g) => g.exerciseName)).toEqual(["Weighted Dips", "Weighted Pull-ups", "Barbell Shrug", "Face Pull"]);
    expect(out.sets.filter((x) => x.sessionId === s.id && x.blockType === "assistance").every((x) => x.optional)).toBe(true);
  });
});

describe("options and 7th week", () => {
  it("excludes deload / TM test / assistance when switched off", () => {
    const out = expand("five-and-dime", { options: { includeDeload: false, includeTmTest: false, includeAssistance: false } });
    expect(out.sessions.some((s) => s.phaseKind === "seventhWeek")).toBe(false);
  });
  it("generates a TM test at +3 with 100 % × 5 last", () => {
    const out = expand("five-and-dime");
    const t = out.sessions.find((s) => s.plannedLabel.includes("TM test · Squat"))!;
    const w = weightsReps(out, t, "Squat");
    expect(w.at(-1)).toBe("152.5x5"); // 145 + 3 × 2.5
    expect(w).toHaveLength(6);
  });
  it("deload uses the last leader's TM", () => {
    const out = expand("five-and-dime");
    const d = out.sessions.find((s) => s.plannedLabel.includes("Deload · Deadlift"))!;
    expect(weightsReps(out, d, "Deadlift")).toEqual(["117.5x5", "135x3-5", "150x1", "167.5x1"]); // 162.5 + 5
  });
});

describe("start part-way (§6.11)", () => {
  it("marks earlier sessions beforeStart and schedules dates around the anchor", () => {
    const out = expand("five-and-dime", { startAt: { phaseIndex: 3, weekIndex: 1, sessionIndex: 0 } }); // Anchor week 2
    const anchor = out.sessions.find((s) => s.phaseName === "Anchor" && s.weekIndex === 1 && s.sessionIndex === 0)!;
    const before = out.sessions.filter((s) => s.ordinal < anchor.ordinal);
    expect(before.every((s) => s.status === "beforeStart")).toBe(true);
    expect(out.sessions.filter((s) => s.ordinal >= anchor.ordinal).every((s) => s.status === "planned")).toBe(true);
    const dates = scheduleDates(out.sessions, { anchorOrdinal: anchor.ordinal, anchorDate: "2026-09-23", trainingDays: [1, 3, 5] });
    expect(dates.get(anchor.id)).toBe("2026-09-23"); // Wednesday
    const prev = out.sessions.find((s) => s.ordinal === anchor.ordinal - 1)!;
    expect(dates.get(prev.id)).toBe("2026-09-21"); // Monday
    const next = out.sessions.find((s) => s.ordinal === anchor.ordinal + 1)!;
    expect(dates.get(next.id)).toBe("2026-09-25"); // Friday
  });
});
