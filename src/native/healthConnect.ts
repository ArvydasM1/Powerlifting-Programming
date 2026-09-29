/** §12: TypeScript side of the HealthConnect plugin, with a stub when the plugin is absent. */
import { registerPlugin } from "@capacitor/core";
import { hasPlugin } from "./bridge";

export type HcPermission = "writeExercise" | "writeHeartRate" | "readHeartRate" | "readRestingHeartRate" | "readHrv" | "readSleep" | "readWeight";

export interface HcSegment {
  startMs: number;
  endMs: number;
  type: string;
  reps: number;
}

export interface HealthConnectPlugin {
  isAvailable(): Promise<{ available: boolean; status: "available" | "updateRequired" | "unavailable" }>;
  getGranted(): Promise<{ granted: HcPermission[] }>;
  requestHealthPermissions(options: { types: HcPermission[] }): Promise<{ granted: HcPermission[] }>;
  writeSession(options: { clientId: string; startMs: number; endMs: number; title?: string; notes?: string; segments: HcSegment[] }): Promise<void>;
  deleteSession(options: { clientId: string }): Promise<void>;
  /** Live (BLE) samples for a session window; replaces this app's earlier heart-rate records in that window. */
  writeHeartRate(options: { startMs: number; endMs: number; samples: Array<{ ts: number; bpm: number }> }): Promise<void>;
  deleteHeartRate(options: { startMs: number; endMs: number }): Promise<void>;
  readHeartRate(options: { startMs: number; endMs: number }): Promise<{ samples: Array<{ ts: number; bpm: number; source: string }> }>;
  readDaily(options: { startMs: number; endMs: number }): Promise<{ restingHr?: number; hrvRmssd?: number; sleepMinutes?: number; sleepStages?: Record<string, number>; weightKg?: number }>;
}

const Native = registerPlugin<HealthConnectPlugin>("HealthConnect");

export const healthConnectAvailable = () => hasPlugin("HealthConnect");

export const healthConnect: HealthConnectPlugin = {
  isAvailable: () => (healthConnectAvailable() ? Native.isAvailable() : Promise.resolve({ available: false, status: "unavailable" })),
  getGranted: () => (healthConnectAvailable() ? Native.getGranted() : Promise.resolve({ granted: [] })),
  requestHealthPermissions: (o) => (healthConnectAvailable() ? Native.requestHealthPermissions(o) : Promise.resolve({ granted: [] })),
  writeSession: (o) => (healthConnectAvailable() ? Native.writeSession(o) : Promise.reject(new Error("Health Connect not available"))),
  deleteSession: (o) => (healthConnectAvailable() ? Native.deleteSession(o) : Promise.reject(new Error("Health Connect not available"))),
  writeHeartRate: (o) => (healthConnectAvailable() ? Native.writeHeartRate(o) : Promise.reject(new Error("Health Connect not available"))),
  deleteHeartRate: (o) => (healthConnectAvailable() ? Native.deleteHeartRate(o) : Promise.reject(new Error("Health Connect not available"))),
  readHeartRate: (o) => (healthConnectAvailable() ? Native.readHeartRate(o) : Promise.resolve({ samples: [] })),
  readDaily: (o) => (healthConnectAvailable() ? Native.readDaily(o) : Promise.resolve({})),
};

/** Own package: Health Connect reports it as the source of records this app wrote. */
export const OWN_PACKAGE = "com.arvydas.fivethreeone";

/**
 * Exercise id (catalogue slug) → Health Connect segment type key (§12.3), the closest of the
 * ExerciseSegment constants. Unknown → weightlifting. Keys are resolved to constants natively.
 */
export const SEGMENT_TYPES: Record<string, string> = {
  Squat: "squat",
  Bench: "benchPress",
  Deadlift: "deadlift",
  Press: "barbellShoulderPress",
  // push
  dips: "weightlifting",
  "weighted-dips": "weightlifting",
  "push-ups": "weightlifting",
  "dumbbell-press": "benchPress",
  "db-incline-press": "benchPress",
  "triceps-extension": "dumbbellTricepsExtensionTwoArm",
  "full-range-plate-raise": "frontRaise",
  // pull
  "chin-ups-pull-ups": "pullUp",
  "pull-ups": "pullUp",
  "weighted-pull-ups": "pullUp",
  "inverted-rows": "weightlifting",
  rows: "weightlifting",
  "db-row": "dumbbellRow",
  curls: "armCurl",
  "db-curls": "armCurl",
  "band-pull-aparts": "weightlifting",
  "face-pull": "weightlifting",
  "rear-laterals": "dumbbellLateralRaise",
  "upright-rows": "weightlifting",
  shrugs: "weightlifting",
  "barbell-shrug": "weightlifting",
  // single leg / core
  "back-raises": "backExtension",
  "glute-ham-raise": "legCurl",
  "straight-leg-deadlift": "deadlift",
  "db-straight-leg-deadlift": "deadlift",
  "db-sldl": "deadlift",
  "good-morning": "backExtension",
  abs: "sitUp",
  "ab-wheel": "plank",
  "hanging-leg-raises": "legRaise",
  lunges: "lunge",
  "single-leg-movements": "lunge",
  "farmer-walk": "walking",
  "db-squat": "squat",
  "db-goblet-squat": "squat",
  neck: "weightlifting",
};

export const segmentTypeFor = (exerciseId: string) => SEGMENT_TYPES[exerciseId] ?? "weightlifting";
