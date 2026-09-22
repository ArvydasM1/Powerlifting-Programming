/**
 * Program expansion, §5.5 / §6.2 / §6.11: template + frozen base TM → sessions, groups, sets
 * with every weight resolved. Pure; the caller persists the result.
 */
import { DELOAD_SCHEME, TM_TEST_SCHEME, tmMapForPhase, weightFor } from "./calc";
import type { Block, Phase, Template } from "./template";
import { isTrainingPhase } from "./template";
import { LIFTS, type BlockType, type Lift, type LiftMap, type PhaseKind, type ProgramOptions, type ProgramPointer, type Session, type SetGroup, type WorkoutSet } from "./types";

export interface ExpandInput {
  template: Template;
  programId: string;
  baseTM: LiftMap<number>;
  cycleIncrease: LiftMap<number>;
  roundingStep: number;
  defaultRestSec: Record<BlockType | "superset", number>;
  options: ProgramOptions;
  startAt: ProgramPointer;
  /** id factory; defaults to crypto.randomUUID */
  newId?: () => string;
  /** exercise id lookup by name; defaults to a slug */
  exerciseIdFor?: (name: string) => string;
}

export interface ExpandOutput {
  sessions: Session[];
  groups: SetGroup[];
  sets: WorkoutSet[];
}

export function comparePointer(a: ProgramPointer, b: ProgramPointer): number {
  return a.phaseIndex - b.phaseIndex || a.weekIndex - b.weekIndex || a.sessionIndex - b.sessionIndex;
}

export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function phaseIncluded(p: Phase, options: ProgramOptions): boolean {
  if (p.kind !== "seventhWeek") return true;
  return p.protocol === "deload" ? options.includeDeload : options.includeTmTest;
}

/** Sessions of a seventh-week phase: one per lift. */
function seventhWeekSessionsFor(p: Extract<Phase, { kind: "seventhWeek" }>): Array<{ label: string; blocks: Block[] }> {
  const lifts = p.lifts ?? [...LIFTS];
  const scheme = p.protocol === "deload" ? DELOAD_SCHEME : TM_TEST_SCHEME;
  return lifts.map((lift) => ({
    label: `${p.protocol === "deload" ? "Deload" : "TM test"} · ${lift}`,
    blocks: [{ type: "main", lift, sets: scheme.map((s) => ({ pct: s.pct, reps: s.reps })), restSec: 180 }],
  }));
}

export function expandProgram(input: ExpandInput): ExpandOutput {
  const newId = input.newId ?? (() => crypto.randomUUID());
  const exerciseIdFor = input.exerciseIdFor ?? slug;
  const sessions: Session[] = [];
  const groups: SetGroup[] = [];
  const sets: WorkoutSet[] = [];
  let ordinal = 0;

  input.template.phases.forEach((p, phaseIndex) => {
    if (!phaseIncluded(p, input.options)) return;
    const tm = tmMapForPhase(input.baseTM, p.tmOffset, input.cycleIncrease);
    const kind: PhaseKind = p.kind;
    const weeks = isTrainingPhase(p) ? p.weeks : [{ label: p.name, sessions: seventhWeekSessionsFor(p) }];

    weeks.forEach((w, weekIndex) => {
      w.sessions.forEach((s, sessionIndex) => {
        const pointer = { phaseIndex, weekIndex, sessionIndex };
        const before = comparePointer(pointer, input.startAt) < 0;
        const sessionId = newId();
        const session: Session = {
          id: sessionId,
          programId: input.programId,
          phaseIndex,
          weekIndex,
          sessionIndex,
          ordinal: ordinal++,
          phaseName: p.name,
          phaseKind: kind,
          plannedLabel: `${p.name} · ${w.label} · ${s.label}`,
          tm,
          date: null,
          plannedDate: null,
          dateApproximate: false,
          startedAt: null,
          finishedAt: null,
          status: before ? "beforeStart" : "planned",
          notes: "",
          warmupTopSet: null,
        };
        sessions.push(session);

        // first pass: main blocks resolve weights; FSL/SSL need them
        const mainWeights: Partial<Record<Lift, number[]>> = {};
        for (const b of s.blocks) {
          if (b.type === "main") {
            mainWeights[b.lift] = b.sets.map((st) => weightFor(tm[b.lift], st.pct, input.roundingStep));
          }
        }

        let setOrder = 0;
        s.blocks.forEach((b, groupOrder) => {
          if (b.type === "assistance" && !input.options.includeAssistance) return;
          const groupId = newId();
          const restDefault = b.type === "assistance" && b.superset ? input.defaultRestSec.superset : input.defaultRestSec[b.type];
          const plannedRestSec = b.restSec ?? restDefault;

          if (b.type === "main") {
            const weights = mainWeights[b.lift]!;
            groups.push(group(groupId, sessionId, groupOrder, "main", b.label ?? `${b.lift}`, b.lift, b.lift, b.optional ?? false, false));
            b.sets.forEach((st, i) => {
              sets.push(
                set({
                  id: newId(),
                  sessionId,
                  groupId,
                  order: setOrder++,
                  groupOrder: i,
                  exerciseId: b.lift,
                  exerciseName: b.lift,
                  lift: b.lift,
                  blockType: "main",
                  prescribedWeight: weights[i]!,
                  prescribedReps: st.reps,
                  optional: (b.optional ?? false) || (st.optional ?? false),
                  plannedRestSec,
                  note: st.note,
                }),
              );
            });
          } else if (b.type === "supplemental") {
            let weight: number;
            if (b.scheme === "pct") {
              weight = weightFor(tm[b.lift], b.pct!, input.roundingStep);
            } else {
              const mw = mainWeights[b.lift];
              const idx = b.scheme === "FSL" ? 0 : 1;
              if (!mw || mw[idx] === undefined) {
                throw new Error(`${input.template.id}: ${b.scheme} for ${b.lift} in "${s.label}" needs a main block with ${idx + 1}+ sets`);
              }
              weight = mw[idx]!;
            }
            const label = b.label ?? `${b.lift} ${b.sets}×${b.reps} ${b.scheme === "pct" ? `@ ${Math.round(b.pct! * 100)}%` : b.scheme}`;
            groups.push(group(groupId, sessionId, groupOrder, "supplemental", label, b.lift, b.lift, b.optional ?? false, false));
            for (let i = 0; i < b.sets; i++) {
              sets.push(
                set({
                  id: newId(),
                  sessionId,
                  groupId,
                  order: setOrder++,
                  groupOrder: i,
                  exerciseId: b.lift,
                  exerciseName: b.lift,
                  lift: b.lift,
                  blockType: "supplemental",
                  prescribedWeight: weight,
                  prescribedReps: b.reps,
                  optional: b.optional ?? false,
                  plannedRestSec,
                }),
              );
            }
          } else {
            const exId = exerciseIdFor(b.exercise);
            groups.push(group(groupId, sessionId, groupOrder, "assistance", b.label ?? `${b.exercise} ${b.sets}×${b.reps}`, exId, b.exercise, true, b.superset ?? false));
            for (let i = 0; i < b.sets; i++) {
              sets.push(
                set({
                  id: newId(),
                  sessionId,
                  groupId,
                  order: setOrder++,
                  groupOrder: i,
                  exerciseId: exId,
                  exerciseName: b.exercise,
                  blockType: "assistance",
                  prescribedWeight: null,
                  prescribedReps: b.reps,
                  optional: true,
                  plannedRestSec,
                }),
              );
            }
          }
        });
      });
    });
  });

  return { sessions, groups, sets };
}

function group(
  id: string,
  sessionId: string,
  order: number,
  type: BlockType,
  label: string,
  exerciseId: string,
  exerciseName: string,
  optional: boolean,
  superset: boolean,
): SetGroup {
  const lift = (LIFTS as readonly string[]).includes(exerciseId) ? (exerciseId as Lift) : undefined;
  return { id, sessionId, order, type, label, exerciseId, exerciseName, lift, optional, superset };
}

function set(
  s: Pick<WorkoutSet, "id" | "sessionId" | "groupId" | "order" | "groupOrder" | "exerciseId" | "exerciseName" | "blockType" | "prescribedWeight" | "prescribedReps" | "optional" | "plannedRestSec"> &
    Partial<Pick<WorkoutSet, "lift" | "note">>,
): WorkoutSet {
  return {
    ...s,
    actualWeight: null,
    actualReps: null,
    isRepPR: false,
    isE1rmPR: false,
    actualRestSec: null,
    completedAt: null,
    backfilled: false,
    source: "logged",
  };
}

/** §6.11 dates: place sessions on training days around an anchor session. */
export function scheduleDates(
  sessions: Session[],
  args: { anchorOrdinal: number; anchorDate: string; trainingDays: number[] },
): Map<string, string> {
  const days = [...new Set(args.trainingDays)].sort((a, b) => a - b);
  if (days.length === 0) throw new Error("trainingDays must not be empty");
  const out = new Map<string, string>();
  const sorted = [...sessions].sort((a, b) => a.ordinal - b.ordinal);
  const anchorIdx = sorted.findIndex((s) => s.ordinal === args.anchorOrdinal);
  if (anchorIdx < 0) return out;

  const isTraining = (d: Date) => days.includes(d.getUTCDay());
  const step = (d: Date, dir: 1 | -1) => {
    const n = new Date(d);
    do n.setUTCDate(n.getUTCDate() + dir);
    while (!isTraining(n));
    return n;
  };
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  // anchor: first training day on/after anchorDate
  let d = new Date(`${args.anchorDate}T00:00:00Z`);
  while (!isTraining(d)) d.setUTCDate(d.getUTCDate() + 1);
  out.set(sorted[anchorIdx]!.id, iso(d));
  let f = new Date(d);
  for (let i = anchorIdx + 1; i < sorted.length; i++) {
    f = step(f, 1);
    out.set(sorted[i]!.id, iso(f));
  }
  let b = new Date(d);
  for (let i = anchorIdx - 1; i >= 0; i--) {
    b = step(b, -1);
    out.set(sorted[i]!.id, iso(b));
  }
  return out;
}
