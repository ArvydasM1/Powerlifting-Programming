import { describe, expect, it } from "vitest";
import {
  baseTMFromCurrent,
  e1rm,
  isE1rmPR,
  isRepPR,
  parseRepTarget,
  proposeNextTM,
  repTargetMet,
  restBefore,
  roundToStep,
  tmForPhase,
  warmupSets,
  weightFor,
} from "./calc";

describe("roundToStep (MROUND)", () => {
  it("matches Excel MROUND for workbook cases", () => {
    // Parameters: rounding 2.5, TMs 145/95/57.5/162.5
    expect(roundToStep(145 * 0.65, 2.5)).toBe(95);
    expect(roundToStep(145 * 0.75, 2.5)).toBe(110);
    expect(roundToStep(145 * 0.85, 2.5)).toBe(122.5);
    expect(roundToStep(95 * 0.75, 2.5)).toBe(72.5); // 71.25 -> half away from zero
    expect(roundToStep(57.5 * 0.65, 2.5)).toBe(37.5);
    expect(roundToStep(162.5 * 0.85, 2.5)).toBe(137.5);
    expect(roundToStep(162.5 * 0.95, 2.5)).toBe(155);
  });
  it("rounds half away from zero", () => {
    expect(roundToStep(1.25, 2.5)).toBe(2.5);
    expect(roundToStep(-1.25, 2.5)).toBe(-2.5);
  });
});

describe("TM per phase", () => {
  it("adds offset × increase", () => {
    expect(tmForPhase(145, 2, 2.5)).toBe(150);
    expect(tmForPhase(162.5, 3, 5)).toBe(177.5);
  });
  it("derives base TM from the current TM (F2 acceptance)", () => {
    // Five and Dime at Anchor (offset 2), current squat TM 150, increase 2.5 -> base 145
    expect(baseTMFromCurrent(150, 2, 2.5)).toBe(145);
  });
  it("weightFor uses phase TM and rounding", () => {
    expect(weightFor(tmForPhase(145, 1, 2.5), 0.85, 2.5)).toBe(125); // Five and Dime Leader 2 wk1 squat
  });
});

describe("rep targets", () => {
  it("parses every form in the workbook", () => {
    expect(parseRepTarget("5")).toMatchObject({ min: 5, max: null, amrap: false, pr: false });
    expect(parseRepTarget("10+")).toMatchObject({ min: 10, max: null, amrap: true });
    expect(parseRepTarget("1+")).toMatchObject({ min: 1, amrap: true });
    expect(parseRepTarget("3-5")).toMatchObject({ min: 3, max: 5, amrap: false });
    expect(parseRepTarget("1-3+")).toMatchObject({ min: 1, max: null, amrap: true });
    expect(parseRepTarget("PR")).toMatchObject({ min: 0, amrap: true, pr: true });
  });
  it("rejects dates and junk", () => {
    expect(() => parseRepTarget("2024-03-05")).toThrow();
    expect(() => parseRepTarget("5-3")).toThrow();
    expect(() => parseRepTarget("")).toThrow();
  });
  it("evaluates success", () => {
    expect(repTargetMet(parseRepTarget("5"), 4)).toBe(false);
    expect(repTargetMet(parseRepTarget("5"), 5)).toBe(true);
    expect(repTargetMet(parseRepTarget("3-5"), 3)).toBe(true);
    expect(repTargetMet(parseRepTarget("3-5"), 2)).toBe(false);
    expect(repTargetMet(parseRepTarget("10+"), 9)).toBe(false);
    expect(repTargetMet(parseRepTarget("PR"), 1)).toBe(true);
  });
});

describe("e1RM", () => {
  it("matches the Progress sheet", () => {
    expect(e1rm(180, 1, 2.5)).toBe(180);
    expect(e1rm(130, 5, 2.5)).toBe(147.5);
    expect(e1rm(122.5, 7, 2.5)).toBe(147.5);
    expect(e1rm(142.5, 5, 2.5)).toBe(160);
    expect(e1rm(180, 2, 2.5)).toBe(185);
    expect(e1rm(130, 10, 2.5)).toBe(172.5);
    expect(e1rm(82.5, 8, 2.5)).toBe(102.5);
    expect(e1rm(47.5, 8, 2.5)).toBe(60);
  });
  it("is null outside 1..12 reps", () => {
    expect(e1rm(100, 0, 2.5)).toBeNull();
    expect(e1rm(100, 13, 2.5)).toBeNull();
  });
});

describe("warm-up calculator", () => {
  it("matches the workbook Warm-up Calc block", () => {
    const w = warmupSets(170, 2.5).map((s) => s.weight);
    expect(w).toEqual([67.5, 85, 102.5, 120, 135, 152.5]);
  });
});

describe("proposeNextTM", () => {
  it("adds one increment when skipped or passed", () => {
    expect(proposeNextTM({ anchorTM: 150, cycleIncrease: 2.5, step: 2.5, testReps: null })).toEqual({
      value: 152.5,
      outcome: "skipped",
    });
    expect(proposeNextTM({ anchorTM: 150, cycleIncrease: 2.5, step: 2.5, testReps: 6 }).outcome).toBe("pass");
    expect(proposeNextTM({ anchorTM: 150, cycleIncrease: 2.5, step: 2.5, testReps: 3 }).outcome).toBe("borderline");
  });
  it("drops to 85 % of e1RM on a fail", () => {
    const r = proposeNextTM({ anchorTM: 150, cycleIncrease: 2.5, step: 2.5, testReps: 2 });
    expect(r.outcome).toBe("fail");
    expect(r.value).toBe(roundToStep((e1rm(152.5, 2, 2.5) ?? 0) * 0.85, 2.5));
  });
});

describe("PR detection", () => {
  const history = [
    { weight: 130, reps: 5 },
    { weight: 145, reps: 1 },
  ];
  it("rep PR beats best reps at >= weight", () => {
    expect(isRepPR(history, 130, 6)).toBe(true);
    expect(isRepPR(history, 130, 5)).toBe(false);
    expect(isRepPR(history, 120, 5)).toBe(false); // 130x5 already at higher weight
    expect(isRepPR(history, 150, 1)).toBe(true);
  });
  it("e1RM PR beats best estimated max", () => {
    expect(isE1rmPR(history, 135, 5, 2.5)).toBe(true);
    expect(isE1rmPR(history, 100, 3, 2.5)).toBe(false);
  });
});

describe("rest", () => {
  it("is the gap between done taps", () => {
    expect(restBefore("2026-09-22T10:00:00Z", "2026-09-22T10:01:40Z")).toBe(100);
    expect(restBefore(null, "2026-09-22T10:01:40Z")).toBeNull();
  });
});
