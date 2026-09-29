import { describe, expect, it } from "vitest";
import type { Session, WorkoutSet } from "@/domain/types";
import { buildWritePayload, sessionSummary } from "./healthSync";

const session = { id: "s1", startedAt: "2026-09-23T10:00:00Z", finishedAt: "2026-09-23T10:40:00Z", plannedLabel: "Leader 1 · Week 1 · Squat day", notes: "" } as Session;
const set = (id: string, exerciseId: string, blockType: WorkoutSet["blockType"], min: number, reps: number, rest: number | null, backfilled = false, weight: number | null = null): WorkoutSet =>
  ({ id, exerciseId, exerciseName: exerciseId, groupId: exerciseId + blockType, blockType, completedAt: `2026-09-23T10:${String(min).padStart(2, "0")}:00Z`, actualReps: reps, actualWeight: weight, actualRestSec: rest, backfilled }) as WorkoutSet;

describe("sessionSummary", () => {
  it("lists weights × reps per block, compressing identical sets", () => {
    const sets = [
      set("a", "Press", "main", 1, 5, null, false, 40),
      set("b", "Press", "main", 2, 5, 60, false, 45),
      set("c", "Press", "main", 3, 5, 60, false, 52.5),
      ...[4, 5, 6, 7, 8].map((m) => set(`f${m}`, "Press", "supplemental", m, 5, 60, false, 40)),
      set("x", "DB Squat", "assistance", 9, 10, 60, false, null),
      set("y", "DB Squat", "assistance", 10, 10, 60, false, null),
    ];
    expect(sessionSummary(sets)).toBe("Press: 40×5, 45×5, 52.5×5\nPress (supplemental): 5 × 5 @ 40\nDB Squat: 2 × 10");
  });
  it("ignores unlogged and backfilled sets", () => {
    expect(sessionSummary([set("a", "Squat", "main", 5, 5, null, true, 100), { ...set("b", "Squat", "main", 6, 5, null, false, 100), completedAt: null }])).toBe("");
  });
});

describe("buildWritePayload", () => {
  it("one strength session with a segment per logged set, typed and ordered", () => {
    const p = buildWritePayload(session, [set("a", "Squat", "main", 5, 5, null), set("b", "Squat", "main", 8, 5, 180), set("c", "db-row", "assistance", 9, 10, 60)])!;
    expect(p.clientId).toBe("s1");
    expect(p.segments.map((s) => s.type)).toEqual(["squat", "squat", "dumbbellRow"]);
    expect(p.segments.map((s) => s.reps)).toEqual([5, 5, 10]);
    expect(p.segments[1]!.startMs).toBeLessThan(p.segments[1]!.endMs);
    expect(p.segments[1]!.startMs).toBeGreaterThanOrEqual(p.segments[0]!.endMs);
    expect(p.notes).toBe("Squat: 2 × 5\ndb-row: 10");
  });
  it("puts the summary before the lifter's own notes", () => {
    const p = buildWritePayload({ ...session, notes: "felt heavy" } as Session, [set("a", "Squat", "main", 5, 5, null, false, 100)])!;
    expect(p.notes).toBe("Squat: 100×5\n\nfelt heavy");
  });
  it("skips sessions without a logged main-lift set or without timestamps", () => {
    expect(buildWritePayload(session, [set("c", "db-row", "assistance", 9, 10, 60)])).toBeNull();
    expect(buildWritePayload(session, [set("a", "Squat", "main", 5, 5, null, true)])).toBeNull();
    expect(buildWritePayload({ ...session, finishedAt: null } as Session, [set("a", "Squat", "main", 5, 5, null)])).toBeNull();
  });
});
