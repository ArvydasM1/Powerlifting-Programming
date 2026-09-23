/** §12: TypeScript side of the HealthConnect plugin, with a stub when the plugin is absent. */
import { registerPlugin } from "@capacitor/core";
import { hasPlugin } from "./bridge";

export type HcPermission = "writeExercise" | "readHeartRate" | "readRestingHeartRate" | "readHrv" | "readSleep" | "readWeight";

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
  readHeartRate: (o) => (healthConnectAvailable() ? Native.readHeartRate(o) : Promise.resolve({ samples: [] })),
  readDaily: (o) => (healthConnectAvailable() ? Native.readDaily(o) : Promise.resolve({})),
};

/** Exercise id → Health Connect segment type key (§12.3). Unknown → weightlifting. */
export const SEGMENT_TYPES: Record<string, string> = {
  Squat: "squat",
  Bench: "benchPress",
  Deadlift: "deadlift",
  Press: "barbellShoulderPress",
  "pull-ups": "pullUp",
  "weighted-pull-ups": "pullUp",
  "chin-ups-pull-ups": "pullUp",
  lunges: "lunge",
  "db-row": "dumbbellRow",
  abs: "sitUp",
};

export const segmentTypeFor = (exerciseId: string) => SEGMENT_TYPES[exerciseId] ?? "weightlifting";
