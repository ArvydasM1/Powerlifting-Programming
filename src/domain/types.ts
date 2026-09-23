/**
 * Domain model, §5 of SPEC.md.
 * Everything here is plain data so it can be stored in IndexedDB and exported as JSON.
 */

export const LIFTS = ["Squat", "Bench", "Press", "Deadlift"] as const;
export type Lift = (typeof LIFTS)[number];

export type LiftMap<T> = Record<Lift, T>;

export type ExerciseKind = "main" | "assistance";
export type AssistanceCategory = "push" | "pull" | "singleLegCore";
export type LoadType = "barbell" | "dumbbell" | "bodyweight" | "band";

export interface Exercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  category?: AssistanceCategory;
  loadType: LoadType;
  /** last weight used, remembered for assistance defaults */
  lastWeight?: number;
}

export type BlockType = "main" | "supplemental" | "assistance";

/** §5.1 */
export interface Settings {
  id: "settings";
  roundingStep: number;
  unit: "kg";
  cycleIncrease: LiftMap<number>;
  includeDeloadAfterLeaders: boolean;
  includeTmTestAtEnd: boolean;
  includeAssistance: boolean;
  e1rmFormula: "wendler";
  defaultRestSec: Record<BlockType | "superset", number>;
  restAlert: "vibrate" | "sound" | "both" | "none";
}

export type TrainingMaxSource = "manual" | "tmTest" | "cycleIncrease" | "programEnd" | "import";

/** §5.2 — one row per change; TM at date D = latest row with effectiveFrom <= D */
export interface TrainingMax {
  id?: number;
  lift: Lift;
  value: number;
  effectiveFrom: string; // ISO date
  source: TrainingMaxSource;
}

export type ProgramStatus = "planned" | "active" | "completed" | "abandoned";

export interface ProgramOptions {
  includeDeload: boolean;
  includeTmTest: boolean;
  includeAssistance: boolean;
}

export interface ProgramPointer {
  phaseIndex: number;
  weekIndex: number;
  sessionIndex: number;
}

/** §5.5 */
export interface Program {
  id: string;
  templateId: string;
  templateName: string;
  startDate: string; // ISO date of the programme's first session (may be back-dated)
  baseTM: LiftMap<number>;
  options: ProgramOptions;
  status: ProgramStatus;
  currentPointer: ProgramPointer;
  startAt: ProgramPointer;
  sessionsPerWeek: number;
  /** 0 = Sunday … 6 = Saturday */
  trainingDays: number[];
  createdAt: string;
}

export type SessionStatus = "planned" | "inProgress" | "done" | "skipped" | "beforeStart" | "backfilled";

/** §5.6 */
export interface Session {
  id: string;
  programId: string;
  phaseIndex: number;
  weekIndex: number;
  sessionIndex: number;
  /** running order across the whole programme, 0-based */
  ordinal: number;
  phaseName: string;
  phaseKind: PhaseKind;
  plannedLabel: string;
  /** TM in force for this session, per lift (frozen) */
  tm: LiftMap<number>;
  date: string | null;
  /** proposed calendar date from the schedule (§6.11); informational for planned sessions */
  plannedDate: string | null;
  dateApproximate: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  status: SessionStatus;
  notes: string;
  warmupTopSet: number | null;
}

export type PhaseKind = "prep" | "leader" | "anchor" | "seventhWeek";
export type SeventhWeekProtocol = "deload" | "tmTest";

export interface SetGroup {
  id: string;
  sessionId: string;
  order: number;
  type: BlockType;
  label: string;
  exerciseId: string;
  exerciseName: string;
  lift?: Lift;
  optional: boolean;
  superset: boolean;
  note?: string;
}

export type SetSource = "logged" | "backfillPrescribed" | "backfillWorkbook" | "backfillCsv";

/** §5.7 */
export interface WorkoutSet {
  id: string;
  sessionId: string;
  groupId: string;
  order: number; // order within the session
  groupOrder: number; // order within the group
  exerciseId: string;
  exerciseName: string;
  lift?: Lift;
  blockType: BlockType;
  prescribedWeight: number | null;
  prescribedReps: string;
  actualWeight: number | null;
  actualReps: number | null;
  optional: boolean;
  isRepPR: boolean;
  isE1rmPR: boolean;
  plannedRestSec: number;
  actualRestSec: number | null;
  completedAt: string | null;
  backfilled: boolean;
  source: SetSource;
  note?: string;
}

/** §5.8 — derived view plus imported rows */
export interface PRRecord {
  id?: number;
  lift: Lift;
  date: string | null;
  ordinal: number;
  weight: number;
  reps: number;
  e1rm: number | null;
  source: "logged" | "import" | "backfill";
  dateApproximate: boolean;
  setId?: string;
}

export interface LifterNote {
  id?: number;
  date: string;
  text: string;
}

/** §12.9 / §13: per-session wearable data. One row per session. */
export interface SessionVitals {
  sessionId: string;
  /** "ble:<device>" for live capture, package name for Health Connect */
  hrSource: string | null;
  hrAvg: number | null;
  hrMax: number | null;
  /** 1 Hz (BLE) or as delivered (Health Connect): [epochMs, bpm] */
  samples: Array<[number, number]>;
  perSet: Array<{ setId: string; hrAtDone: number | null; hrMinBeforeNext: number | null; recoveryBpm: number | null }>;
  restingHr: number | null;
  hrvRmssd: number | null;
  sleepMinutes: number | null;
  sleepStages: Record<string, number> | null;
  readAt: string | null;
  /** read attempts for the Health Connect job (§12.9 retry for 48 h) */
  attempts: number;
}

/** §12.4: Health Connect write/read jobs */
export interface SyncJob {
  id?: number;
  sessionId: string;
  kind: "write" | "delete" | "read";
  status: "queued" | "done" | "failed";
  createdAt: string;
  lastTriedAt: string | null;
  error: string | null;
}

/** §15.7: one AI analysis run */
export interface AnalysisRun {
  id: string;
  date: string;
  provider: "share" | "gemini-free" | "claude-code" | "anthropic-api";
  model: string | null;
  promptKind: "full" | "nextProgram" | "reviewBlock";
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  bundleHash: string;
  includedHealth: boolean;
  includedNotes: boolean;
  report: unknown;
  status: "ok" | "invalid" | "pending";
  error: string | null;
  acceptedProposals: string[];
}
