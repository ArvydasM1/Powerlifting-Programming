/**
 * Pervertor (SPEC §A7). Three sessions a week; each lift walks A→B→C across a four-week
 * leader. The wave decides the supplemental: A → BBS 10×5 @ FSL, B → BBB 5×10 @ FSL, C → 5×5 @ SSL.
 * Anchor: heavy sessions (85×3, 75×5, 95×1, 100×1, 105×1 + optional Jokers) followed by a
 * widowmaker or 5×5, and light sessions (65/75/85×5 + SSL 5×5).
 */
import type { Block, MainSetTemplate, SessionTemplate, WeekTemplate } from "@/domain/template";
import type { Lift } from "@/domain/types";
import { ASSISTANCE_NOTE_ANCHOR, fivesPro, fsl, main, phase, session, ssl, supp, template, tmTest, week, deload, type WaveKey } from "./dsl";

function leaderSupp(lift: Lift, wave: WaveKey): Block {
  switch (wave) {
    case "A":
      return fsl(lift, 10, "5", { label: `${lift} BBS 10×5 @ FSL` });
    case "B":
      return fsl(lift, 5, "10", { label: `${lift} BBB 5×10 @ FSL` });
    case "C":
      return ssl(lift, 5, "5", { label: `${lift} 5×5 @ SSL` });
  }
}

const LEADER_ROTATION: Array<Array<[Lift, WaveKey]>> = [
  [["Squat", "A"], ["Bench", "A"], ["Deadlift", "A"]],
  [["Press", "A"], ["Squat", "B"], ["Bench", "B"]],
  [["Deadlift", "B"], ["Press", "B"], ["Squat", "C"]],
  [["Bench", "C"], ["Deadlift", "C"], ["Press", "C"]],
];

function leaderWeeks(): WeekTemplate[] {
  return LEADER_ROTATION.map((sessions, wi) =>
    week(`Week ${wi + 1}`, sessions.map(([lift, wave]) => session(`${lift} day (${wave} wave)`, [fivesPro(lift, wave), leaderSupp(lift, wave)]))),
  );
}

const HEAVY: MainSetTemplate[] = [
  { pct: 0.85, reps: "3" },
  { pct: 0.75, reps: "5" },
  { pct: 0.95, reps: "1" },
  { pct: 1.0, reps: "1" },
  { pct: 1.05, reps: "1" },
  { pct: 1.1, reps: "1", optional: true, note: "Joker" },
];

function heavy(lift: Lift, after: "wm85" | "wm75" | "5x5@85" | "5x5@75"): SessionTemplate {
  const tail: Block =
    after === "wm85"
      ? supp(lift, 0.85, 1, "20", { label: `${lift} widowmaker 1×20 @ 85%` })
      : after === "wm75"
        ? supp(lift, 0.75, 1, "20", { label: `${lift} widowmaker 1×20 @ 75%` })
        : after === "5x5@85"
          ? supp(lift, 0.85, 5, "5", { label: `${lift} 5×5 @ 85%` })
          : supp(lift, 0.75, 5, "5", { label: `${lift} 5×5 @ 75%` });
  return session(`${lift} heavy`, [main(lift, HEAVY, { restSec: 240 }), tail]);
}

function light(lift: Lift): SessionTemplate {
  return session(`${lift} light`, [fivesPro(lift, "A"), ssl(lift, 5, "5", { label: `${lift} 5×5 @ SSL` })]);
}

function anchorWeeks(): WeekTemplate[] {
  return [
    week("Week 1", [heavy("Squat", "wm85"), heavy("Bench", "wm75"), heavy("Deadlift", "wm75")]),
    week("Week 2", [heavy("Press", "wm75"), light("Squat"), light("Bench")]),
    week("Week 3", [light("Deadlift"), light("Press"), heavy("Squat", "5x5@85")]),
    week("Week 4", [heavy("Bench", "5x5@75"), heavy("Deadlift", "5x5@75"), heavy("Press", "5x5@75")]),
  ];
}

export const pervertor = template({
  id: "pervertor",
  name: "Pervertor",
  description:
    "A mix of Boring But Strong, Boring But Big and Second Set Last: the week's wave picks the supplemental. Three sessions a week with the lifts rotating. The anchor alternates heavy singles up to 105% with widowmakers and light 5s PRO days.",
  daysPerWeek: 3,
  assistanceNote: ASSISTANCE_NOTE_ANCHOR,
  phases: [
    phase("Leader 1", "leader", 0, leaderWeeks()),
    phase("Leader 2", "leader", 1, leaderWeeks()),
    deload(1),
    phase("Anchor", "anchor", 2, anchorWeeks()),
    tmTest(3),
  ],
});
