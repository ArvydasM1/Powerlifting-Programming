/**
 * God is a Beast (SPEC §A6). Six-week leaders: two lifts do a double 5-rep wave while
 * the other two do 10×5 volume, swapping every week. Three-week anchor: 3-rep double
 * waves with PR sets and 5×5 volume, swapping halves within each week.
 */
import type { MainSetTemplate, WeekTemplate } from "@/domain/template";
import type { Lift } from "@/domain/types";
import { ASSISTANCE_NOTE_LEADER, deload, main, phase, session, sets, supp, template, tmTest, week } from "./dsl";

const LEADER_WAVES: MainSetTemplate[][] = [
  sets([0.7, 0.8, 0.9, 0.75, 0.85, 0.95], "5"),
  sets([0.65, 0.75, 0.85, 0.7, 0.8, 0.9], "5"),
  [...sets([0.7, 0.8, 0.9, 0.8, 0.9], "5"), { pct: 1.0, reps: "1-3" }],
];
const LEADER_VOLUME_PCT = [0.65, 0.7, 0.75];

function leaderWeeks(): WeekTemplate[] {
  // week n (1-based): wave index = floor((n-1)/2); odd weeks Squat/Deadlift wave, even weeks Bench/Press wave
  return Array.from({ length: 6 }, (_, i) => {
    const n = i + 1;
    const idx = Math.floor(i / 2);
    const wave = LEADER_WAVES[idx]!;
    const vol = LEADER_VOLUME_PCT[idx]!;
    const waveLifts: Lift[] = n % 2 === 1 ? ["Squat", "Deadlift"] : ["Bench", "Press"];
    return week(`Week ${n}`, (["Squat", "Bench", "Deadlift", "Press"] as Lift[]).map((lift) =>
      session(`${lift} day`, [
        waveLifts.includes(lift)
          ? main(lift, wave, { restSec: 150 })
          : supp(lift, vol, 10, "5", { label: `${lift} 10×5 @ ${Math.round(vol * 100)}%` }),
      ]),
    ));
  });
}

const ANCHOR_WAVES: MainSetTemplate[][] = [
  sets([0.7, 0.8, 0.9, 0.75, 0.85, 0.95], ["3", "3", "3+", "3", "3", "3+"]),
  sets([0.65, 0.75, 0.85, 0.7, 0.8, 0.9], ["3", "3", "3", "3", "3", "3+"]),
  sets([0.7, 0.8, 0.9, 0.8, 0.9, 1.0], ["3", "3", "3+", "3", "3", "1-3+"]),
];
const ANCHOR_VOLUME_PCT = [0.65, 0.7, 0.75];

function anchorWeeks(): WeekTemplate[] {
  return ANCHOR_WAVES.map((wave, i) => {
    const vol = ANCHOR_VOLUME_PCT[i]!;
    const v = (lift: Lift) => supp(lift, vol, 5, "5", { label: `${lift} 5×5 @ ${Math.round(vol * 100)}%` });
    return week(`Week ${i + 1}`, [
      session("Squat wave + Bench 5×5", [main("Squat", wave, { restSec: 180 }), v("Bench")]),
      session("Deadlift 5×5 + Press wave", [v("Deadlift"), main("Press", wave, { restSec: 180 })]),
      session("Squat 5×5 + Bench wave", [v("Squat"), main("Bench", wave, { restSec: 180 })]),
      session("Deadlift wave + Press 5×5", [main("Deadlift", wave, { restSec: 180 }), v("Press")]),
    ]);
  });
}

export const godIsABeast = template({
  id: "god-is-a-beast",
  name: "God is a Beast",
  description:
    "Six-week leaders alternating double 5-rep waves with 10×5 volume weeks per lift, run twice, then a three-week anchor with 3-rep waves, PR sets and 5×5. Increase the TM only after each full six weeks. Long, and the anchor is heavier than the leader.",
  daysPerWeek: 4,
  assistanceNote: ASSISTANCE_NOTE_LEADER,
  phases: [
    phase("Leader 1", "leader", 0, leaderWeeks()),
    phase("Leader 2", "leader", 1, leaderWeeks()),
    deload(1),
    phase("Anchor", "anchor", 2, anchorWeeks()),
    tmTest(3),
  ],
});
