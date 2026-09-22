/**
 * Coffinworm (SPEC §A3). 4 sessions/week: main lift + optional secondary lift 5×5 @ 70%.
 */
import type { MainSetTemplate, WeekTemplate } from "@/domain/template";
import type { Lift } from "@/domain/types";
import { ASSISTANCE_NOTE_ANCHOR, deload, main, phase, session, supp, template, tmTest, week } from "./dsl";

const ORDER: Array<[Lift, Lift]> = [
  ["Squat", "Bench"],
  ["Press", "Deadlift"],
  ["Bench", "Squat"],
  ["Deadlift", "Press"],
];

const LEADER_HEAVY: MainSetTemplate[] = [
  { pct: 0.7, reps: "5" },
  { pct: 0.8, reps: "5" },
  { pct: 0.9, reps: "5" },
  { pct: 0.8, reps: "5" },
  { pct: 0.9, reps: "3-5" },
  { pct: 1.0, reps: "1-3" },
];
const LEADER_WEEK3: MainSetTemplate[] = [
  { pct: 0.65, reps: "5" },
  { pct: 0.75, reps: "5" },
  { pct: 0.85, reps: "5" },
  { pct: 0.85, reps: "5" },
  { pct: 0.85, reps: "5" },
  { pct: 0.85, reps: "3-5" },
];
const ANCHOR_HEAVY: MainSetTemplate[] = [
  { pct: 0.7, reps: "5" },
  { pct: 0.8, reps: "5" },
  { pct: 0.9, reps: "5" },
  { pct: 0.8, reps: "5" },
  { pct: 0.9, reps: "3-5" },
  { pct: 1.0, reps: "PR" },
  { pct: 1.05, reps: "1-3", optional: true, note: "Joker" },
  { pct: 1.1, reps: "1-3", optional: true, note: "Joker" },
];
const ANCHOR_WEEK3: MainSetTemplate[] = [
  { pct: 0.65, reps: "5" },
  { pct: 0.75, reps: "5" },
  { pct: 0.85, reps: "PR" },
];

function weeks(schemes: MainSetTemplate[][]): WeekTemplate[] {
  return schemes.map((scheme, wi) =>
    week(`Week ${wi + 1}`, ORDER.map(([lift, secondary]) =>
      session(`${lift} day`, [
        main(lift, scheme, { restSec: 180 }),
        supp(secondary, 0.7, 5, "5", { optional: true, label: `${secondary}? 5×5 @ 70%` }),
      ]),
    )),
  );
}

export const coffinworm = template({
  id: "coffinworm",
  name: "Coffinworm",
  description:
    "Four heavy sessions a week, one main lift each, working up to 3–5 reps at 90% and 1–3 at the TM, with an optional 5×5 at 70% on a second lift. Week 3 is a semi-deload. The anchor adds PR sets and optional Jokers.",
  daysPerWeek: 4,
  assistanceNote: ASSISTANCE_NOTE_ANCHOR,
  phases: [
    phase("Leader 1", "leader", 0, weeks([LEADER_HEAVY, LEADER_HEAVY, LEADER_WEEK3])),
    phase("Leader 2", "leader", 1, weeks([LEADER_HEAVY, LEADER_HEAVY, LEADER_WEEK3])),
    deload(1),
    phase("Anchor", "anchor", 2, weeks([ANCHOR_HEAVY, ANCHOR_HEAVY, ANCHOR_WEEK3])),
    tmTest(3),
  ],
});
