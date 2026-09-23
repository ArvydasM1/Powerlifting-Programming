import { describe, expect, it } from "vitest";
import type { Session, WorkoutSet } from "@/domain/types";
import { buildWritePayload } from "./healthSync";

const session = { id: "s1", startedAt: "2026-09-23T10:00:00Z", finishedAt: "2026-09-23T10:40:00Z", plannedLabel: "Leader 1 · Week 1 · Squat day", notes: "" } as Session;
const set = (id: string, exerciseId: string, blockType: WorkoutSet["blockType"], min: number, reps: number, rest: number | null, backfilled = false): WorkoutSet =>
  ({ id, exerciseId, blockType, completedAt: `2026-09-23T10:${String(min).padStart(2, "0")}:00Z`, actualReps: reps, actualRestSec: rest, backfilled }) as WorkoutSet;

describe("buildWritePayload", () => {
  it("one strength session with a segment per logged set, typed and ordered", () => {
    const p = buildWritePayload(session, [set("a", "Squat", "main", 5, 5, null), set("b", "Squat", "main", 8, 5, 180), set("c", "db-row", "assistance", 9, 10, 60)])!;
    expect(p.clientId).toBe("s1");
    expect(p.segments.map((s) => s.type)).toEqual(["squat", "squat", "dumbbellRow"]);
    expect(p.segments.map((s) => s.reps)).toEqual([5, 5, 10]);
    expect(p.segments[1]!.startMs).toBeLessThan(p.segments[1]!.endMs);
    expect(p.segments[1]!.startMs).toBeGreaterThanOrEqual(p.segments[0]!.endMs);
  });
  it("skips sessions without a logged main-lift set or without timestamps", () => {
    expect(buildWritePayload(session, [set("c", "db-row", "assistance", 9, 10, 60)])).toBeNull();
    expect(buildWritePayload(session, [set("a", "Squat", "main", 5, 5, null, true)])).toBeNull();
    expect(buildWritePayload({ ...session, finishedAt: null } as Session, [set("a", "Squat", "main", 5, 5, null)])).toBeNull();
  });
});
