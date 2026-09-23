/** F11 CSV backfill: `date, exercise, weight, reps[, order]` rows matched to planned sets by date. */
import type { Exercise, Session, WorkoutSet } from "@/domain/types";

export interface CsvRow {
  line: number;
  date: string;
  exercise: string;
  weight: number | null;
  reps: number;
  order: number | null;
}

export function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  const errors: string[] = [];
  const rows: CsvRow[] = [];
  if (lines.length === 0) return { rows, errors: ["empty file"] };
  const header = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const idx = (n: string) => header.indexOf(n);
  const iDate = idx("date");
  const iEx = idx("exercise");
  const iW = idx("weight");
  const iR = idx("reps");
  const iO = idx("order");
  if (iDate < 0 || iEx < 0 || iR < 0) return { rows, errors: ["header must contain date, exercise, reps (weight and order optional)"] };
  lines.slice(1).forEach((l, i) => {
    const c = splitCsvLine(l);
    const date = (c[iDate] ?? "").trim();
    const exercise = (c[iEx] ?? "").trim();
    const reps = Number(c[iR]);
    const weight = iW >= 0 && (c[iW] ?? "").trim() !== "" ? Number(c[iW]) : null;
    const order = iO >= 0 && (c[iO] ?? "").trim() !== "" ? Number(c[iO]) : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !exercise || !Number.isFinite(reps)) {
      errors.push(`line ${i + 2}: needs ISO date, exercise and numeric reps`);
      return;
    }
    rows.push({ line: i + 2, date, exercise, weight: weight !== null && Number.isFinite(weight) ? weight : null, reps, order });
  });
  return { rows, errors };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export interface CsvPlan {
  matched: Array<{ row: CsvRow; setId: string; sessionId: string }>;
  extra: Array<{ row: CsvRow; exerciseId: string | null }>;
  unknownExercises: string[];
}

/** Match rows to sets of the session(s) on that date, in order; leftovers become extra sets. */
export function planCsvBackfill(rows: CsvRow[], sessions: Session[], setsBySession: Map<string, WorkoutSet[]>, exercises: Exercise[]): CsvPlan {
  const byName = new Map(exercises.map((e) => [e.name.toLowerCase(), e]));
  const matched: CsvPlan["matched"] = [];
  const extra: CsvPlan["extra"] = [];
  const unknown = new Set<string>();
  const used = new Set<string>();
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || (a.order ?? a.line) - (b.order ?? b.line));
  for (const row of sorted) {
    const ex = byName.get(row.exercise.toLowerCase());
    const daySessions = sessions.filter((s) => (s.date ?? s.plannedDate) === row.date && (s.status === "beforeStart" || s.status === "skipped" || s.status === "planned"));
    let hit: WorkoutSet | undefined;
    for (const s of daySessions) {
      hit = (setsBySession.get(s.id) ?? [])
        .filter((x) => !used.has(x.id) && x.exerciseName.toLowerCase() === row.exercise.toLowerCase())
        .sort((a, b) => a.order - b.order)[0];
      if (hit) break;
    }
    if (hit) {
      used.add(hit.id);
      matched.push({ row, setId: hit.id, sessionId: hit.sessionId });
    } else {
      if (!ex) unknown.add(row.exercise);
      extra.push({ row, exerciseId: ex?.id ?? null });
    }
  }
  return { matched, extra, unknownExercises: [...unknown] };
}
