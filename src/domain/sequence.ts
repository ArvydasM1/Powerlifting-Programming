/**
 * Execution order of a session (§6.9 / Appendix A1): barbell sets in their planned order, with one set
 * from each superset assistance block slotted after every barbell set, rotating between superset blocks
 * (Krypteia: Press → DB squat → Press → DB SLDL → …). Assistance that is not a superset comes last, in
 * block order. Optional blocks the lifter has not opened contribute nothing.
 */
import type { SetGroup, WorkoutSet } from "./types";

export interface SequenceRow {
  set: WorkoutSet;
  group: SetGroup;
  /** true when this row starts a new stretch of the same block, so the UI can show a heading */
  first: boolean;
}

export function buildSequence(groups: SetGroup[], sets: WorkoutSet[], isOpen: (g: SetGroup) => boolean): SequenceRow[] {
  const byGroup = new Map(groups.map((g) => [g.id, g]));
  const ordered = [...sets].sort((a, b) => a.order - b.order);
  const barbell = ordered.filter((s) => s.blockType !== "assistance" && isOpen(byGroup.get(s.groupId)!));
  const superGroups = groups.filter((g) => g.type === "assistance" && g.superset && isOpen(g)).sort((a, b) => a.order - b.order);
  const tailGroups = groups.filter((g) => g.type === "assistance" && !g.superset && isOpen(g)).sort((a, b) => a.order - b.order);
  const queues = superGroups.map((g) => ordered.filter((s) => s.groupId === g.id));

  const out: WorkoutSet[] = [];
  barbell.forEach((s, i) => {
    out.push(s);
    if (queues.length === 0) return;
    // rotate across superset blocks; if that block is exhausted, try the others
    for (let k = 0; k < queues.length; k++) {
      const q = queues[(i + k) % queues.length]!;
      const next = q.shift();
      if (next) {
        out.push(next);
        break;
      }
    }
  });
  for (const q of queues) out.push(...q);
  for (const g of tailGroups) out.push(...ordered.filter((s) => s.groupId === g.id));

  return out.map((set, i) => {
    const group = byGroup.get(set.groupId)!;
    return { set, group, first: i === 0 || out[i - 1]!.groupId !== set.groupId };
  });
}
