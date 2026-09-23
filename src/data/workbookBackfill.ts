/**
 * F11 workbook backfill: read the "Reps Done" cells of a template sheet and match them to
 * the app's sets by phase, week, lift, percentage and rep target.
 */
import * as XLSX from "xlsx";
import { weightFor } from "@/domain/calc";
import { LIFTS, type Lift, type Session, type WorkoutSet } from "@/domain/types";

export interface SheetSet {
  phase: string; // "Leader 1" | "Leader 2" | "Anchor"
  weekIndex: number;
  lift: Lift;
  pct: number;
  reps: string;
  repsDone: number | null;
  cell: string;
}

export const TEMPLATE_SHEETS: Record<string, string> = {
  "five-and-dime": "Five and Dime",
  coffinworm: "Coffinworm",
  fbbbb: "FBBBB",
  leviathan: "Leviathan",
  "god-is-a-beast": "God is a Beast",
  pervertor: "Pervertor",
};

const PHASE_MARKERS: Record<string, string> = { "LEADER 1": "Leader 1", "LEADER 2": "Leader 2", ANCHOR: "Anchor" };

/** "3-5" typed into Excel became a date; the formatted text (`w`) still shows "3-5". Fall back to month-day. */
function repTargetFromCell(cell: { v?: unknown; w?: string; t?: string } | undefined): string | null {
  if (!cell || cell.v === null || cell.v === undefined || cell.v === "") return null;
  if (cell.t === "d") {
    if (cell.w && /^\d+-\d+$/.test(cell.w.trim())) return cell.w.trim();
    const d = cell.v instanceof Date ? cell.v : new Date(cell.v as string);
    return `${d.getMonth() + 1}-${d.getDate()}`;
  }
  if (typeof cell.v === "number") return String(cell.v);
  const s = String(cell.v).trim();
  return s.length ? s : null;
}

function resolvePct(ws: XLSX.WorkSheet, addr: string, depth = 0): { lift: Lift; pct: number } | null {
  if (depth > 5) return null;
  const cell = ws[addr];
  const f: string | undefined = cell?.f;
  if (!f) return null;
  const m = /TRM(Squat|Bench|Press|Deadlift)(?:\s*\*\s*([\d.]+))?/.exec(f);
  if (m) return { lift: m[1] as Lift, pct: m[2] ? Number(m[2]) : 1 };
  const ref = /^\$?([A-Z]+)\$?(\d+)$/.exec(f.trim());
  if (ref) return resolvePct(ws, `${ref[1]}${ref[2]}`, depth + 1);
  return null;
}

export function parseTemplateSheet(buffer: ArrayBuffer | Uint8Array, sheetName: string): SheetSet[] {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1:A1");
  const out: SheetSet[] = [];
  let phase: string | null = null;
  let blocks: number[] = []; // lift column index per week block

  for (let r = range.s.r; r <= range.e.r; r++) {
    const a = ws[XLSX.utils.encode_cell({ c: 0, r })]?.v;
    if (typeof a === "string") {
      const marker = PHASE_MARKERS[a.trim().toUpperCase()];
      if (marker) {
        phase = marker;
        blocks = [];
        continue;
      }
      if (/^7th WEEK/i.test(a.trim())) {
        phase = null;
        continue;
      }
      if (/^Week 1$/i.test(a.trim())) {
        blocks = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const v = ws[XLSX.utils.encode_cell({ c, r })]?.v;
          if (typeof v === "string" && /^Week \d+$/i.test(v.trim())) blocks.push(c);
        }
        continue;
      }
    }
    if (!phase || blocks.length === 0) continue;
    const ph = phase;
    blocks.forEach((c, weekIndex) => {
      const wAddr = XLSX.utils.encode_cell({ c: c + 1, r });
      const p = resolvePct(ws, wAddr);
      if (!p) return;
      const reps = repTargetFromCell(ws[XLSX.utils.encode_cell({ c: c + 2, r })]);
      if (!reps) return;
      const doneV = ws[XLSX.utils.encode_cell({ c: c + 3, r })]?.v;
      const repsDone = typeof doneV === "number" && Number.isFinite(doneV) ? doneV : null;
      out.push({ phase: ph, weekIndex, lift: p.lift, pct: p.pct, reps, repsDone, cell: wAddr });
    });
  }
  return out;
}

export interface BackfillMatch {
  setId: string;
  sessionId: string;
  repsDone: number;
  weight: number;
}

export interface BackfillPlan {
  matches: BackfillMatch[];
  unmatchedSheet: SheetSet[];
  unmatchedApp: Array<{ set: WorkoutSet; session: Session }>;
}

/** Pair sheet sets with app sets. Only sessions before the start point (or skipped) are considered. */
export function planWorkbookBackfill(sheetSets: SheetSet[], sessions: Session[], setsBySession: Map<string, WorkoutSet[]>, roundingStep: number): BackfillPlan {
  const pool = sheetSets.filter((s) => s.repsDone !== null);
  const used = new Set<SheetSet>();
  const matches: BackfillMatch[] = [];
  const unmatchedApp: BackfillPlan["unmatchedApp"] = [];

  const candidates = sessions.filter((s) => s.status === "beforeStart" || s.status === "skipped").sort((a, b) => a.ordinal - b.ordinal);
  for (const session of candidates) {
    const sets = (setsBySession.get(session.id) ?? []).filter((x) => x.blockType !== "assistance").sort((a, b) => a.order - b.order);
    for (const set of sets) {
      if (!set.lift) continue;
      const found = pool.find(
        (sh) =>
          !used.has(sh) &&
          sh.phase === session.phaseName &&
          sh.weekIndex === session.weekIndex &&
          sh.lift === set.lift &&
          sh.reps === set.prescribedReps &&
          weightFor(session.tm[sh.lift], sh.pct, roundingStep) === set.prescribedWeight,
      );
      if (found) {
        used.add(found);
        matches.push({ setId: set.id, sessionId: session.id, repsDone: found.repsDone!, weight: set.prescribedWeight ?? 0 });
      } else if (!set.optional) {
        unmatchedApp.push({ set, session });
      }
    }
  }
  return { matches, unmatchedSheet: pool.filter((s) => !used.has(s)), unmatchedApp };
}

export const isMainLift = (name: string): name is Lift => (LIFTS as readonly string[]).includes(name);
