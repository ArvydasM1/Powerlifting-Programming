import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv, planCsvBackfill } from "@/data/csvBackfill";
import { parseTemplateSheet, planWorkbookBackfill } from "@/data/workbookBackfill";
import { AppDB } from "@/data/db";
import { createRepo } from "@/data/repo";
import { getTemplate } from "../templates";

const WORKBOOK = "531 Forever.xlsx";
const TM = { Squat: 145, Bench: 95, Press: 57.5, Deadlift: 162.5 };

describe("CSV backfill", () => {
  it("parses rows and reports bad lines", () => {
    const { rows, errors } = parseCsv('date,exercise,weight,reps\n2026-09-21,Squat,122.5,5\n2026-09-21,"DB Row",25,10\nbad,Squat,1,1\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]!.exercise).toBe("DB Row");
    expect(errors).toHaveLength(1);
  });

  it("matches rows to that date's sets and flags unknown exercises", async () => {
    const db = new AppDB(`csv-${Date.now()}`);
    const repo = createRepo(db);
    await repo.ensureSeeded();
    const program = await repo.createProgram({
      template: getTemplate("five-and-dime")!,
      baseTM: TM,
      options: { includeDeload: false, includeTmTest: false, includeAssistance: false },
      startAt: { phaseIndex: 0, weekIndex: 1, sessionIndex: 0 },
      anchorDate: "2026-09-28",
      trainingDays: [1, 3, 5],
    });
    const sessions = await repo.programSessions(program.id);
    const first = sessions[0]!; // beforeStart, Squat 5×5 + Bench dime
    const setsBySession = new Map<string, Awaited<ReturnType<typeof repo.sessionSets>>>();
    for (const s of sessions) setsBySession.set(s.id, await repo.sessionSets(s.id));
    const { rows } = parseCsv(`date,exercise,weight,reps\n${first.date},Squat,122.5,5\n${first.date},Squat,122.5,5\n${first.date},Bench,80,12\n${first.date},Kettlebell Swing,24,20\n`);
    const plan = planCsvBackfill(rows, sessions, setsBySession, await db.exercises.toArray());
    expect(plan.matched).toHaveLength(3);
    expect(plan.extra).toHaveLength(1);
    expect(plan.unknownExercises).toEqual(["Kettlebell Swing"]);
    const n = await repo.applyBackfillMatches(plan.matched.map((m) => ({ setId: m.setId, sessionId: m.sessionId, repsDone: m.row.reps, weight: m.row.weight })), "backfillCsv");
    expect(n).toBe(3);
    expect((await db.sessions.get(first.id))!.status).toBe("backfilled");
    const benchSets = (await repo.sessionSets(first.id)).filter((x) => x.exerciseId === "Bench").sort((a, b) => a.order - b.order);
    expect(benchSets[0]!.actualReps).toBe(12); // rows match in set order, so the Bench row landed on the first bench set
    expect(benchSets[2]!.actualReps).toBeNull(); // the 10+ set stays unlogged
    await repo.addExtraBackfillSets(program.id, [{ date: "2026-09-01", exerciseId: "kettlebell-swing", exerciseName: "Kettlebell Swing", weight: 24, reps: 20 }]);
    expect((await db.sessions.where("date").equals("2026-09-01").toArray())[0]!.status).toBe("backfilled");
  });
});

describe.skipIf(!existsSync(WORKBOOK))("workbook backfill (needs the local workbook)", () => {
  const ab = existsSync(WORKBOOK) ? new Uint8Array(readFileSync(WORKBOOK)) : new Uint8Array(0);

  it("reads Five and Dime sets with recovered rep ranges", () => {
    const sets = parseTemplateSheet(ab, "Five and Dime");
    const l1w1 = sets.filter((s) => s.phase === "Leader 1" && s.weekIndex === 0);
    expect(l1w1.filter((s) => s.lift === "Squat" && s.pct === 0.85 && s.reps === "5")).toHaveLength(5); // the 5×5; the dime top set is 10+
    expect(l1w1.find((s) => s.lift === "Bench" && s.pct === 0.85)?.reps).toBe("10+");
    const cw = parseTemplateSheet(ab, "Coffinworm");
    expect(cw.find((s) => s.phase === "Leader 1" && s.weekIndex === 0 && s.lift === "Squat" && s.pct === 1)?.reps).toBe("1-3");
  });

  it("matches the sheet to app sets for Five and Dime Leader 1", async () => {
    const db = new AppDB(`wb-${Date.now()}`);
    const repo = createRepo(db);
    await repo.ensureSeeded();
    const program = await repo.createProgram({
      template: getTemplate("five-and-dime")!,
      baseTM: TM,
      options: { includeDeload: true, includeTmTest: true, includeAssistance: false },
      startAt: { phaseIndex: 1, weekIndex: 0, sessionIndex: 0 },
      anchorDate: "2026-09-28",
      trainingDays: [1, 3, 5],
    });
    const sessions = await repo.programSessions(program.id);
    const setsBySession = new Map<string, Awaited<ReturnType<typeof repo.sessionSets>>>();
    for (const s of sessions) setsBySession.set(s.id, await repo.sessionSets(s.id));
    const plan = planWorkbookBackfill(parseTemplateSheet(ab, "Five and Dime"), sessions, setsBySession, 2.5);
    const leader1App = sessions.filter((s) => s.phaseName === "Leader 1").flatMap((s) => setsBySession.get(s.id)!);
    expect(plan.matches.length).toBe(leader1App.length); // every Leader 1 set has a Reps Done cell in the sheet
    expect(plan.unmatchedApp.filter((u) => u.session.phaseName === "Leader 1")).toHaveLength(0);
    const n = await repo.applyBackfillMatches(plan.matches, "backfillWorkbook");
    expect(n).toBe(plan.matches.length);
    // sheet D11: bench 85% 10+ done 10 in week 1 session 1
    const s1 = sessions[0]!;
    const bench = (await repo.sessionSets(s1.id)).find((x) => x.exerciseId === "Bench" && x.prescribedReps === "10+")!;
    expect(bench.actualReps).toBe(10);
    expect(bench.source).toBe("backfillWorkbook");
  });
});
