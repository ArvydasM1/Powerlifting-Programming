import { describe, expect, it } from "vitest";
import type { WorkoutSet } from "./types";
import { downsample1Hz, minBetween, nearest, parseHeartRateMeasurement, perSetRecovery, summarise } from "./vitals";

const t0 = Date.parse("2026-09-23T10:00:00Z");
const samples: Array<[number, number]> = Array.from({ length: 300 }, (_, i) => [t0 + i * 1000, 100 + Math.round(40 * Math.sin(i / 20))]);

function set(id: string, sec: number): WorkoutSet {
  return { id, completedAt: new Date(t0 + sec * 1000).toISOString() } as WorkoutSet;
}

describe("vitals", () => {
  it("summarises", () => {
    const s = summarise(samples);
    expect(s.hrMax).toBe(140);
    expect(s.hrAvg).toBeGreaterThan(90);
    expect(summarise([])).toEqual({ hrAvg: null, hrMax: null });
  });
  it("nearest and min", () => {
    expect(nearest(samples, t0 + 10_500)).toBe(samples[10]![1]);
    expect(nearest(samples, t0 + 10 * 60_000)).toBeNull();
    expect(minBetween(samples, t0, t0 + 299_000)).toBe(60);
  });
  it("per-set recovery uses the gap to the next set", () => {
    const r = perSetRecovery(samples, [set("a", 30), set("b", 120), set("c", 200)], null);
    expect(r).toHaveLength(3);
    expect(r[0]!.setId).toBe("a");
    expect(r[0]!.hrAtDone).toBe(samples[30]![1]);
    expect(r[0]!.hrMinBeforeNext).toBe(minBetween(samples, t0 + 30_000, t0 + 120_000));
    expect(r[0]!.recoveryBpm).toBe(r[0]!.hrAtDone! - r[0]!.hrMinBeforeNext!);
  });
  it("parses 8- and 16-bit heart rate measurements", () => {
    expect(parseHeartRateMeasurement(new DataView(new Uint8Array([0x00, 72]).buffer))).toBe(72);
    expect(parseHeartRateMeasurement(new DataView(new Uint8Array([0x01, 0x2c, 0x01]).buffer))).toBe(300);
  });
  it("downsamples to 1 Hz", () => {
    const dense: Array<[number, number]> = [
      [t0, 70],
      [t0 + 200, 71],
      [t0 + 900, 72],
      [t0 + 1000, 73],
    ];
    expect(downsample1Hz(dense)).toEqual([
      [t0 + 900, 72],
      [t0 + 1000, 73],
    ]);
  });
});
