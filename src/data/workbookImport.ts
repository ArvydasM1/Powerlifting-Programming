/** F8: read Parameters and Progress from the 531 Forever workbook. Runs in the browser with SheetJS. */
import * as XLSX from "xlsx";
import { LIFTS, type Lift, type LiftMap } from "@/domain/types";

export interface WorkbookImport {
  tm: LiftMap<number> | null;
  rounding: number | null;
  increases: LiftMap<number> | null;
  prs: Partial<LiftMap<Array<{ weight: number; reps: number }>>>;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseWorkbook(buffer: ArrayBuffer): WorkbookImport {
  const wb = XLSX.read(buffer, { type: "array" });
  const out: WorkbookImport = { tm: null, rounding: null, increases: null, prs: {} };

  const params = wb.Sheets["Parameters"];
  if (params) {
    const cell = (a: string) => num(params[a]?.v);
    // A2:D2 headers Squat Bench Press Deadlift; A3:D3 TMs; B5 rounding; A9:D9 increases
    const order: Lift[] = ["Squat", "Bench", "Press", "Deadlift"];
    const cols = ["A", "B", "C", "D"];
    const tm = {} as LiftMap<number>;
    const inc = {} as LiftMap<number>;
    let okTm = true;
    let okInc = true;
    order.forEach((lift, i) => {
      const t = cell(`${cols[i]}3`);
      const n = cell(`${cols[i]}9`);
      if (t === null) okTm = false;
      else tm[lift] = t;
      if (n === null) okInc = false;
      else inc[lift] = n;
    });
    if (okTm) out.tm = tm;
    if (okInc) out.increases = inc;
    out.rounding = cell("B5");
  }

  const progress = wb.Sheets["Progress"];
  if (progress) {
    const range = XLSX.utils.decode_range(progress["!ref"] ?? "A1:A1");
    let current: Lift | null = null;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const g = progress[XLSX.utils.encode_cell({ c: 6, r })]?.v; // column G
      if (typeof g === "string" && (LIFTS as readonly string[]).includes(g)) {
        current = g as Lift;
        out.prs[current] = [];
        continue;
      }
      if (!current) continue;
      const weight = num(progress[XLSX.utils.encode_cell({ c: 7, r })]?.v);
      const reps = num(progress[XLSX.utils.encode_cell({ c: 8, r })]?.v);
      if (weight !== null && reps !== null && weight > 0 && reps > 0) out.prs[current]!.push({ weight, reps });
    }
  }
  return out;
}
