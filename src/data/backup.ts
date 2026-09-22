/** F9 backup / restore. One versioned export shape shared with sharing and the analysis bundle (§14.3). */
import type { AppDB } from "./db";

export const SCHEMA_VERSION = 1;

export interface Backup {
  schemaVersion: number;
  exportedAt: string;
  settings: unknown[];
  trainingMax: unknown[];
  exercises: unknown[];
  programs: unknown[];
  sessions: unknown[];
  setGroups: unknown[];
  sets: unknown[];
  prRecords: unknown[];
  notes: unknown[];
}

const TABLES = ["settings", "trainingMax", "exercises", "programs", "sessions", "setGroups", "sets", "prRecords", "notes"] as const;

export async function exportBackup(db: AppDB): Promise<Backup> {
  const out: Partial<Backup> = { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
  for (const t of TABLES) out[t] = await db[t].toArray();
  return out as Backup;
}

export async function importBackup(db: AppDB, data: unknown): Promise<void> {
  const b = data as Partial<Backup>;
  if (!b || typeof b !== "object" || b.schemaVersion !== SCHEMA_VERSION) throw new Error("Not a backup file for this app version");
  await db.transaction("rw", TABLES.map((t) => db[t]), async () => {
    for (const t of TABLES) {
      const table = db[t] as unknown as { clear(): Promise<void>; bulkPut(rows: unknown[]): Promise<unknown> };
      await table.clear();
      const rows = (b[t] ?? []) as unknown[];
      if (rows.length) await table.bulkPut(rows);
    }
  });
}

export function setsToCsv(rows: Array<Record<string, unknown>>): string {
  const cols = ["date", "session", "exercise", "blockType", "prescribedWeight", "prescribedReps", "actualWeight", "actualReps", "plannedRestSec", "actualRestSec", "isRepPR", "isE1rmPR", "backfilled"];
  const esc = (v: unknown) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
