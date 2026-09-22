import Dexie, { type EntityTable } from "dexie";
import type { Exercise, LifterNote, PRRecord, Program, Session, SetGroup, Settings, TrainingMax, WorkoutSet } from "@/domain/types";

export class AppDB extends Dexie {
  settings!: EntityTable<Settings, "id">;
  trainingMax!: EntityTable<TrainingMax, "id">;
  exercises!: EntityTable<Exercise, "id">;
  programs!: EntityTable<Program, "id">;
  sessions!: EntityTable<Session, "id">;
  setGroups!: EntityTable<SetGroup, "id">;
  sets!: EntityTable<WorkoutSet, "id">;
  prRecords!: EntityTable<PRRecord, "id">;
  notes!: EntityTable<LifterNote, "id">;

  constructor(name = "fivethreeone") {
    super(name);
    this.version(1).stores({
      settings: "id",
      trainingMax: "++id, lift, effectiveFrom, [lift+effectiveFrom]",
      exercises: "id, kind, name, category",
      programs: "id, status, templateId",
      sessions: "id, programId, [programId+ordinal], [programId+status], status, date, plannedDate",
      setGroups: "id, sessionId, [sessionId+order]",
      sets: "id, sessionId, [sessionId+order], groupId, exerciseId, lift, completedAt",
      prRecords: "++id, lift, date, setId, [lift+ordinal]",
      notes: "++id, date",
    });
  }
}

export const db = new AppDB();
