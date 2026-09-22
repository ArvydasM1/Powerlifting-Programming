import { beforeEach, describe, expect, it } from "vitest";
import { AppDB } from "./db";
import { createRepo, type Clock } from "./repo";
import { getTemplate } from "../../templates";

class FakeClock implements Clock {
  t = new Date("2026-09-23T09:00:00Z");
  now() {
    return new Date(this.t);
  }
  advance(sec: number) {
    this.t = new Date(this.t.getTime() + sec * 1000);
  }
}

let n = 0;
function fresh() {
  const clock = new FakeClock();
  const db = new AppDB(`test-${++n}`);
  return { clock, repo: createRepo(db, clock) };
}

const TM = { Squat: 145, Bench: 95, Press: 57.5, Deadlift: 162.5 };

describe("repo", () => {
  let repo: ReturnType<typeof createRepo>;
  let clock: FakeClock;
  beforeEach(async () => {
    ({ repo, clock } = fresh());
    await repo.ensureSeeded();
    await repo.setAllTM(TM, "import", "2026-09-01");
  });

  it("seeds settings, catalogue and TM", async () => {
    expect((await repo.getSettings()).roundingStep).toBe(2.5);
    expect(await repo.db.exercises.count()).toBeGreaterThan(30);
    expect(await repo.currentTM()).toEqual(TM);
  });

  it("creates a programme, starts the next session, logs sets with rest and PR, finishes", async () => {
    const program = await repo.createProgram({
      template: getTemplate("five-and-dime")!,
      baseTM: TM,
      options: { includeDeload: true, includeTmTest: true, includeAssistance: true },
      anchorDate: "2026-09-23",
      trainingDays: [1, 3, 5],
    });
    expect(program.status).toBe("active");
    const next = (await repo.nextSession(program.id))!;
    expect(next.plannedLabel).toBe("Leader 1 · Week 1 · Session 1 · Squat + Bench");
    expect(next.plannedDate).toBe("2026-09-23");

    const sets = await repo.sessionSets(next.id);
    const squat = sets.filter((s) => s.exerciseId === "Squat");
    const bench = sets.filter((s) => s.exerciseId === "Bench");
    expect(squat).toHaveLength(5);
    expect(bench).toHaveLength(3);

    const first = await repo.logSet(squat[0]!.id);
    expect(first.actualReps).toBe(5);
    expect(first.actualWeight).toBe(122.5);
    expect(first.actualRestSec).toBeNull();
    clock.advance(100);
    const second = await repo.logSet(squat[1]!.id);
    expect(second.actualRestSec).toBe(100);

    // bench top set 80 x 10+ : 10 reps beats nothing in history -> PR
    clock.advance(120);
    await repo.logSet(bench[0]!.id);
    await repo.logSet(bench[1]!.id);
    const top = await repo.logSet(bench[2]!.id, { actualReps: 10 });
    expect(top.isRepPR).toBe(true);
    expect(top.isE1rmPR).toBe(true);
    expect((await repo.prHistory("Bench")).map((p) => [p.weight, p.reps, p.e1rm])).toEqual([[80, 10, 107.5]]);

    const session = (await repo.db.sessions.get(next.id))!;
    expect(session.status).toBe("inProgress");
    const r = await repo.finishSession(next.id);
    expect(r.programCompleted).toBe(false);
    const done = (await repo.db.sessions.get(next.id))!;
    expect(done.status).toBe("done");
    expect(done.finishedAt).not.toBeNull();
    const after = (await repo.nextSession(program.id))!;
    expect(after.plannedLabel).toContain("Session 2");
  });

  it("refuses a second active programme", async () => {
    const t = getTemplate("fbbbb")!;
    const args = { template: t, baseTM: TM, options: { includeDeload: true, includeTmTest: true, includeAssistance: false }, anchorDate: "2026-09-23", trainingDays: [1, 2, 4, 5] };
    await repo.createProgram(args);
    await expect(repo.createProgram(args)).rejects.toThrow(/already active/);
  });

  it("start part-way: earlier sessions are beforeStart with approximate dates; backfill as prescribed", async () => {
    const program = await repo.createProgram({
      template: getTemplate("five-and-dime")!,
      baseTM: TM,
      options: { includeDeload: true, includeTmTest: true, includeAssistance: true },
      startAt: { phaseIndex: 1, weekIndex: 0, sessionIndex: 0 }, // Leader 2 week 1
      anchorDate: "2026-09-23",
      trainingDays: [1, 3, 5],
    });
    const all = await repo.programSessions(program.id);
    const before = all.filter((s) => s.status === "beforeStart");
    expect(before).toHaveLength(12);
    expect(before.every((s) => s.dateApproximate && s.date)).toBe(true);
    expect((await repo.nextSession(program.id))!.plannedLabel).toContain("Leader 2 · Week 1");

    await repo.backfillAsPrescribed(before[0]!.id);
    const s = (await repo.db.sessions.get(before[0]!.id))!;
    expect(s.status).toBe("backfilled");
    const sets = await repo.sessionSets(s.id);
    const main = sets.filter((x) => x.blockType !== "assistance");
    expect(main.every((x) => x.backfilled && x.actualReps !== null && x.completedAt === null && x.actualRestSec === null)).toBe(true);
    expect((await repo.prHistory("Bench")).length).toBe(1); // the 10+ top set

    await repo.clearBackfill(s.id);
    expect((await repo.db.sessions.get(s.id))!.status).toBe("beforeStart");
    expect((await repo.prHistory("Bench")).length).toBe(0);
  });

  it("proposes end-of-programme TM from the TM test", async () => {
    const program = await repo.createProgram({
      template: getTemplate("five-and-dime")!,
      baseTM: TM,
      options: { includeDeload: false, includeTmTest: true, includeAssistance: false },
      anchorDate: "2026-09-23",
      trainingDays: [1, 3, 5],
    });
    const all = await repo.programSessions(program.id);
    const squatTest = all.find((s) => s.plannedLabel.includes("TM test · Squat"))!;
    const sets = await repo.sessionSets(squatTest.id);
    for (const s of sets) await repo.logSet(s.id, { actualReps: s.order === sets.length - 1 ? 2 : 5 });
    await repo.finishSession(squatTest.id);
    const p = await repo.proposeEndOfProgramTM(program.id);
    expect(p.Squat.anchorTM).toBe(150);
    expect(p.Squat.outcome).toBe("fail");
    expect(p.Bench.outcome).toBe("skipped");
    expect(p.Bench.value).toBe(102.5); // 100 + 2.5
  });
});
