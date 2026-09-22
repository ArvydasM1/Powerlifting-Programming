/**
 * Krypteia — book layout (SPEC §A1).
 * Part 1: 4 days, all four lifts, 5s PRO + FSL 5×5, two cycles at the same TM.
 * Part 2: 3 days, Squat/Bench/Deadlift, 5s PRO + FSL 5×10, second cycle +1.
 * Part 3 (anchor): 3 days, 5/3/1 PR sets + FSL 5×5, +2.
 * Assistance supersets between every set; face pulls to finish.
 */
import type { Block, WeekTemplate } from "@/domain/template";
import type { Lift } from "@/domain/types";
import { PR_WAVE, assist, deload, fivesPro, fsl, main, phase, session, template, tmTest, week, type WaveKey } from "./dsl";

const SUPERSET_REST = 45;

function supersets(lift: Lift, mainAndSuppSets: number): Block[] {
  const each = Math.ceil(mainAndSuppSets / 2);
  const pair: Block[] =
    lift === "Press" || lift === "Bench"
      ? [
          assist("DB Squat", each, "10", { superset: true, restSec: SUPERSET_REST }),
          assist("DB Straight-Leg Deadlift", each, "10", { superset: true, restSec: SUPERSET_REST }),
        ]
      : [
          assist("Weighted Dips", each, "10", { superset: true, restSec: SUPERSET_REST }),
          assist("Weighted Pull-ups", each, "10", { superset: true, restSec: SUPERSET_REST }),
        ];
  if (lift === "Deadlift") pair.push(assist("Barbell Shrug", 3, "10", { superset: true, restSec: SUPERSET_REST }));
  pair.push(assist("Face Pull", 1, "100+", { label: "Face pulls 100–200 total" }));
  return pair;
}

const waves: WaveKey[] = ["A", "B", "C"];

function part1Weeks(labelOffset: number): WeekTemplate[] {
  return waves.map((w, i) =>
    week(`Week ${i + 1 + labelOffset}`, (["Press", "Squat", "Bench", "Deadlift"] as Lift[]).map((lift) =>
      session(`${lift} day`, [
        fivesPro(lift, w, { restSec: SUPERSET_REST }),
        fsl(lift, 5, "5", { restSec: SUPERSET_REST }),
        ...supersets(lift, 8),
      ]),
    )),
  );
}

function part2Weeks(labelOffset: number): WeekTemplate[] {
  return waves.map((w, i) =>
    week(`Week ${i + 1 + labelOffset}`, (["Squat", "Bench", "Deadlift"] as Lift[]).map((lift) =>
      session(`${lift} day`, [
        fivesPro(lift, w, { restSec: SUPERSET_REST }),
        fsl(lift, 5, "10", { restSec: SUPERSET_REST }),
        ...supersets(lift, 8),
      ]),
    )),
  );
}

function part3Weeks(labelOffset: number): WeekTemplate[] {
  return ([1, 2, 3] as const).map((n) =>
    week(`Week ${n + labelOffset}`, (["Squat", "Bench", "Deadlift"] as Lift[]).map((lift) =>
      session(`${lift} day`, [
        main(lift, PR_WAVE[n], { restSec: 90 }),
        fsl(lift, 5, "5", { restSec: SUPERSET_REST }),
        ...supersets(lift, 8),
      ]),
    )),
  );
}

export const krypteia = template({
  id: "krypteia",
  name: "Krypteia",
  description:
    "Hard, high-volume block with assistance supersetted between every set. Part 1 runs four days with all four lifts for two cycles at the same TM; Parts 2 and 3 drop the Press and run three days. Sessions should finish in under 45 minutes.",
  daysPerWeek: 4,
  phases: [
    phase("Part 1 · Cycle 1", "prep", 0, part1Weeks(0)),
    phase("Part 1 · Cycle 2", "prep", 0, part1Weeks(3)),
    phase("Part 2 · Cycle 1", "leader", 0, part2Weeks(6)),
    phase("Part 2 · Cycle 2", "leader", 1, part2Weeks(9)),
    deload(1),
    phase("Part 3 · Anchor", "anchor", 2, part3Weeks(12)),
    tmTest(3),
  ],
});
