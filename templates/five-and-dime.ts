/**
 * Five and Dime (SPEC §A2). 3 sessions/week, 2 lifts per session:
 * one lift "Dime" (three-set wave, top set 10+) and one lift "Five" (5×5 at a fixed %).
 */
import type { Block, WeekTemplate } from "@/domain/template";
import type { Lift } from "@/domain/types";
import { ASSISTANCE_NOTE_LEADER, WAVE, deload, main, phase, sets, session, supp, template, tmTest, week, type WaveKey } from "./dsl";

type Part = { lift: Lift; kind: "five"; pct: number } | { lift: Lift; kind: "dime"; wave: WaveKey };

const five = (lift: Lift, pct: number): Part => ({ lift, kind: "five", pct });
const dime = (lift: Lift, wave: WaveKey): Part => ({ lift, kind: "dime", wave });

/** Leader layout; `fivePct` overrides every Five block (anchor uses 0.85 throughout). */
function layout(fivePct?: number): Part[][][] {
  const p = (x: number) => fivePct ?? x;
  return [
    [
      [five("Squat", p(0.85)), dime("Bench", "A")],
      [dime("Deadlift", "A"), five("Press", p(0.85))],
      [dime("Squat", "A"), five("Bench", p(0.85))],
    ],
    [
      [five("Deadlift", p(0.85)), dime("Press", "B")],
      [five("Squat", p(0.9)), dime("Bench", "B")],
      [dime("Deadlift", "B"), five("Press", p(0.9))],
    ],
    [
      [dime("Squat", "B"), five("Bench", p(0.9))],
      [five("Deadlift", p(0.9)), dime("Press", "B")],
      [five("Squat", p(0.95)), dime("Bench", "C")],
    ],
    [
      [dime("Deadlift", "B"), five("Press", p(0.95))],
      [dime("Squat", "C"), five("Bench", p(0.95))],
      [five("Deadlift", p(0.95)), dime("Press", "C")],
    ],
  ];
}

function toBlock(part: Part): Block {
  if (part.kind === "five") return supp(part.lift, part.pct, 5, "5", { label: `${part.lift} 5×5 @ ${Math.round(part.pct * 100)}%` });
  return main(part.lift, sets(WAVE[part.wave], ["5", "5", "10+"]), { label: `${part.lift} dime` });
}

function weeks(fivePct?: number): WeekTemplate[] {
  return layout(fivePct).map((sessions, wi) =>
    week(`Week ${wi + 1}`, sessions.map((parts, si) => session(`Session ${si + 1} · ${parts.map((p) => p.lift).join(" + ")}`, parts.map(toBlock)))),
  );
}

export const fiveAndDime = template({
  id: "five-and-dime",
  name: "Five and Dime",
  description:
    "Three sessions a week, two lifts each: one lift does a three-set wave with a 10+ top set, the other does 5×5 at a fixed percentage that climbs through the leader. The anchor keeps every 5×5 at 85%.",
  daysPerWeek: 3,
  assistanceNote: ASSISTANCE_NOTE_LEADER,
  phases: [
    phase("Leader 1", "leader", 0, weeks()),
    phase("Leader 2", "leader", 1, weeks()),
    deload(1),
    phase("Anchor", "anchor", 2, weeks(0.85)),
    tmTest(3),
  ],
});
