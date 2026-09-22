/**
 * Leviathan (SPEC §A5). Every session works up to a TM single: 70×3, 80×3, 90×3, 100×1.
 * Leader supplemental per lift: Press SSL 5×5, Squat 1×20 widowmaker @ FSL, Bench FSL 5×10, Deadlift FSL 10×5.
 * Anchor: four lifts a week, TM single then one PR set at 85/90/95%.
 */
import type { Block, MainSetTemplate, WeekTemplate } from "@/domain/template";
import type { Lift } from "@/domain/types";
import { ASSISTANCE_NOTE_LEADER, deload, fsl, main, phase, session, ssl, template, tmTest, week } from "./dsl";

const TM_SINGLE: MainSetTemplate[] = [
  { pct: 0.7, reps: "3" },
  { pct: 0.8, reps: "3" },
  { pct: 0.9, reps: "3" },
  { pct: 1.0, reps: "1" },
];

function leaderSupp(lift: Lift): Block {
  switch (lift) {
    case "Press":
      return ssl(lift, 5, "5", { label: "Press 5×5 @ 80% (SSL)" });
    case "Squat":
      return fsl(lift, 1, "20", { label: "Squat widowmaker 1×20 @ 70%" });
    case "Bench":
      return fsl(lift, 5, "10", { label: "Bench 5×10 @ 70%" });
    case "Deadlift":
      return fsl(lift, 10, "5", { label: "Deadlift 10×5 @ 70%" });
  }
}

const ROTATION: Lift[][] = [
  ["Press", "Deadlift", "Bench"],
  ["Squat", "Press", "Deadlift"],
  ["Bench", "Squat", "Press"],
  ["Deadlift", "Bench", "Squat"],
];

function leaderWeeks(): WeekTemplate[] {
  return ROTATION.map((lifts, wi) =>
    week(`Week ${wi + 1}`, lifts.map((lift) => session(`${lift} day`, [main(lift, TM_SINGLE, { restSec: 240 }), leaderSupp(lift)]))),
  );
}

function anchorWeeks(): WeekTemplate[] {
  const prPct = [0.85, 0.9, 0.95];
  return prPct.map((pct, wi) =>
    week(`Week ${wi + 1}`, (["Press", "Deadlift", "Bench", "Squat"] as Lift[]).map((lift) =>
      session(`${lift} day`, [main(lift, [...TM_SINGLE, { pct, reps: "1+", note: "PR set" }], { restSec: 240 })]),
    )),
  );
}

export const leviathan = template({
  id: "leviathan",
  name: "Leviathan",
  description:
    "Work up to a single at the TM every session, then supplemental volume that differs per lift. Three sessions a week in the leader with the lifts rotating; the anchor does all four lifts weekly with a PR set after the single and no supplemental.",
  daysPerWeek: 3,
  assistanceNote: ASSISTANCE_NOTE_LEADER,
  phases: [
    phase("Leader 1", "leader", 0, leaderWeeks()),
    phase("Leader 2", "leader", 1, leaderWeeks()),
    deload(1),
    phase("Anchor", "anchor", 2, anchorWeeks()),
    tmTest(3),
  ],
});
