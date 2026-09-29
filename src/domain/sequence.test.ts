import { describe, expect, it } from "vitest";
import type { SetGroup, WorkoutSet } from "./types";
import { buildSequence } from "./sequence";

const g = (id: string, order: number, type: SetGroup["type"], superset = false): SetGroup => ({ id, sessionId: "s", order, type, label: id, exerciseId: id, exerciseName: id, optional: type === "assistance", superset });
let n = 0;
const s = (groupId: string, blockType: WorkoutSet["blockType"], groupOrder: number): WorkoutSet => ({ id: `${groupId}${groupOrder}`, sessionId: "s", groupId, order: n++, groupOrder, exerciseId: groupId, exerciseName: groupId, blockType, prescribedWeight: null, prescribedReps: "5", actualWeight: null, actualReps: null, optional: blockType === "assistance", isRepPR: false, isE1rmPR: false, plannedRestSec: 60, actualRestSec: null, completedAt: null, backfilled: false, source: "logged" });

describe("buildSequence", () => {
  const groups = [g("press", 0, "main"), g("fsl", 1, "supplemental"), g("dbsq", 2, "assistance", true), g("sldl", 3, "assistance", true), g("facepull", 4, "assistance", false)];
  const sets = [
    ...[0, 1, 2].map((i) => s("press", "main", i)),
    ...[0, 1, 2, 3, 4].map((i) => s("fsl", "supplemental", i)),
    ...[0, 1, 2, 3].map((i) => s("dbsq", "assistance", i)),
    ...[0, 1, 2, 3].map((i) => s("sldl", "assistance", i)),
    ...[0, 1].map((i) => s("facepull", "assistance", i)),
  ];

  it("slots one superset set after each barbell set, rotating blocks, then the rest", () => {
    const ids = buildSequence(groups, sets, () => true).map((r) => r.set.id);
    expect(ids).toEqual(["press0", "dbsq0", "press1", "sldl0", "press2", "dbsq1", "fsl0", "sldl1", "fsl1", "dbsq2", "fsl2", "sldl2", "fsl3", "dbsq3", "fsl4", "sldl3", "facepull0", "facepull1"]);
  });
  it("leaves closed optional blocks out and keeps barbell order", () => {
    const ids = buildSequence(groups, sets, (x) => x.id !== "sldl" && x.id !== "facepull").map((r) => r.set.id);
    expect(ids).toEqual(["press0", "dbsq0", "press1", "dbsq1", "press2", "dbsq2", "fsl0", "dbsq3", "fsl1", "fsl2", "fsl3", "fsl4"]);
  });
  it("marks the first row of every stretch", () => {
    const rows = buildSequence(groups, sets, () => true);
    expect(rows.filter((r) => r.first).map((r) => r.set.id).slice(0, 4)).toEqual(["press0", "dbsq0", "press1", "sldl0"]);
  });
  it("without supersets it is simply the planned order", () => {
    const plain = [g("squat", 0, "main"), g("bbb", 1, "supplemental")];
    const ps = [s("squat", "main", 0), s("squat", "main", 1), s("bbb", "supplemental", 0)];
    expect(buildSequence(plain, ps, () => true).map((r) => r.set.id)).toEqual(["squat0", "squat1", "bbb0"]);
  });
});
