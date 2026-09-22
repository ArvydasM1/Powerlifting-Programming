/** Seed exercise catalogue, §5.3. Assistance names match the templates and the workbook. */
import type { Exercise } from "@/domain/types";
import { slug } from "@/domain/expand";

const MAIN: Exercise[] = [
  { id: "Squat", name: "Squat", kind: "main", loadType: "barbell" },
  { id: "Bench", name: "Bench", kind: "main", loadType: "barbell" },
  { id: "Press", name: "Press", kind: "main", loadType: "barbell" },
  { id: "Deadlift", name: "Deadlift", kind: "main", loadType: "barbell" },
];

type Row = [name: string, category: Exercise["category"], load: Exercise["loadType"], lastWeight?: number];

const ASSISTANCE: Row[] = [
  // push
  ["Dips", "push", "bodyweight"],
  ["Weighted Dips", "push", "bodyweight"],
  ["Push-ups", "push", "bodyweight"],
  ["Dumbbell Press", "push", "dumbbell", 44],
  ["DB Incline Press", "push", "dumbbell", 40],
  ["Triceps Extension", "push", "dumbbell", 17.5],
  ["Full Range Plate Raise", "push", "barbell"],
  // pull
  ["Chin-ups/Pull-ups", "pull", "bodyweight"],
  ["Pull-ups", "pull", "bodyweight"],
  ["Weighted Pull-ups", "pull", "bodyweight"],
  ["Inverted Rows", "pull", "bodyweight"],
  ["Rows", "pull", "barbell"],
  ["DB Row", "pull", "dumbbell", 25],
  ["Curls", "pull", "dumbbell"],
  ["DB Curls", "pull", "dumbbell", 24],
  ["Band Pull-aparts", "pull", "band"],
  ["Face Pull", "pull", "band"],
  ["Rear Laterals", "pull", "dumbbell"],
  ["Upright Rows", "pull", "barbell", 40],
  ["Shrugs", "pull", "barbell", 77.5],
  ["Barbell Shrug", "pull", "barbell"],
  // single leg / core
  ["Back Raises", "singleLegCore", "bodyweight"],
  ["Glute Ham Raise", "singleLegCore", "bodyweight"],
  ["Straight Leg Deadlift", "singleLegCore", "barbell", 20],
  ["DB Straight-Leg Deadlift", "singleLegCore", "dumbbell", 40],
  ["DB SLDL", "singleLegCore", "dumbbell", 40],
  ["Good Morning", "singleLegCore", "barbell"],
  ["Abs", "singleLegCore", "bodyweight"],
  ["Ab Wheel", "singleLegCore", "bodyweight"],
  ["Hanging Leg Raises", "singleLegCore", "bodyweight"],
  ["Lunges", "singleLegCore", "dumbbell", 35],
  ["Single Leg Movements", "singleLegCore", "bodyweight"],
  ["Farmer Walk", "singleLegCore", "dumbbell"],
  ["DB Squat", "singleLegCore", "dumbbell"],
  ["DB Goblet Squat", "singleLegCore", "dumbbell", 25],
  ["Neck", "singleLegCore", "band"],
];

export const CATALOGUE: Exercise[] = [
  ...MAIN,
  ...ASSISTANCE.map(([name, category, loadType, lastWeight]) => ({
    id: slug(name),
    name,
    kind: "assistance" as const,
    category,
    loadType,
    ...(lastWeight !== undefined ? { lastWeight } : {}),
  })),
];
