import Dexie, { type EntityTable } from "dexie";
import type { AnalysisRun, Exercise, LifterNote, PRRecord, Program, Session, SessionVitals, SetGroup, Settings, SyncJob, TrainingMax, WorkoutSet } from "@/domain/types";

const V1_STORES = {
  settings: "id",
  trainingMax: "++id, lift, effectiveFrom, [lift+effectiveFrom]",
  exercises: "id, kind, name, category",
  programs: "id, status, templateId",
  sessions: "id, programId, [programId+ordinal], [programId+status], status, date, plannedDate",
  setGroups: "id, sessionId, [sessionId+order]",
  sets: "id, sessionId, [sessionId+order], groupId, exerciseId, lift, completedAt",
  prRecords: "++id, lift, date, setId, [lift+ordinal]",
  notes: "++id, date",
};

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
  sessionVitals!: EntityTable<SessionVitals, "sessionId">;
  syncQueue!: EntityTable<SyncJob, "id">;
  analysisRuns!: EntityTable<AnalysisRun, "id">;

  constructor(name = "fivethreeone") {
    super(name);
    this.version(1).stores(V1_STORES);
    this.version(2).stores({
      ...V1_STORES,
      sessionVitals: "sessionId, hrSource, readAt",
      syncQueue: "++id, sessionId, kind, status, [kind+status]",
      analysisRuns: "id, date, provider, status",
    });
  }
}

export const db = new AppDB();
