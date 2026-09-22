/**
 * Full Body Boring But Big (SPEC §A4). Four blocks a week, each pairing a main lift
 * (5s PRO) with another lift's BBB 5×10 @ 50%. The anchor pairs 5s PRO lifts and
 * then 5×5 at the week's first-set percentage.
 */
import type { WeekTemplate } from "@/domain/template";
import { ASSISTANCE_NOTE_LEADER, WAVE, deload, fivesPro, phase, session, supp, template, tmTest, week, type WaveKey } from "./dsl";

const waves: WaveKey[] = ["A", "B", "C"];

function leaderWeeks(): WeekTemplate[] {
  return waves.map((w, i) =>
    week(`Week ${i + 1}`, [
      session("Deadlift + Bench BBB", [fivesPro("Deadlift", w), supp("Bench", 0.5, 5, "10", { label: "Bench BBB 5×10 @ 50%" })]),
      session("Squat BBB + Press", [supp("Squat", 0.5, 5, "10", { label: "Squat BBB 5×10 @ 50%" }), fivesPro("Press", w)]),
      session("Squat + Press BBB", [fivesPro("Squat", w), supp("Press", 0.5, 5, "10", { label: "Press BBB 5×10 @ 50%" })]),
      session("Deadlift BBB + Bench", [supp("Deadlift", 0.5, 5, "10", { label: "Deadlift BBB 5×10 @ 50%" }), fivesPro("Bench", w)]),
    ]),
  );
}

function anchorWeeks(): WeekTemplate[] {
  return waves.map((w, i) => {
    const first = WAVE[w][0];
    const pctLabel = `${Math.round(first * 100)}%`;
    return week(`Week ${i + 1}`, [
      session("Squat + Bench", [fivesPro("Squat", w), fivesPro("Bench", w)]),
      session("Deadlift + Press", [fivesPro("Deadlift", w), fivesPro("Press", w)]),
      session("Squat + Bench 5×5", [
        supp("Squat", first, 5, "5", { label: `Squat 5×5 @ ${pctLabel}` }),
        supp("Bench", first, 5, "5", { label: `Bench 5×5 @ ${pctLabel}` }),
      ]),
      session("Deadlift + Press 5×5", [
        supp("Deadlift", first, 5, "5", { label: `Deadlift 5×5 @ ${pctLabel}` }),
        supp("Press", first, 5, "5", { label: `Press 5×5 @ ${pctLabel}` }),
      ]),
    ]);
  });
}

export const fbbbb = template({
  id: "fbbbb",
  name: "Full Body Boring But Big",
  description:
    "Every session pairs a main lift on 5s PRO with a different lift's 5×10 at 50%. Sub-maximal volume for lifters who recover well. BBB is always a leader; the anchor drops the 5×10 for paired 5s PRO and 5×5 work.",
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
