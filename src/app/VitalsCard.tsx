/** §12.9 session detail: heart-rate trace with set markers and readiness values. */
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SessionVitals, WorkoutSet } from "@/domain/types";
import { Card } from "./ui";

export function VitalsCard({ vitals, sets }: { vitals: SessionVitals; sets: WorkoutSet[] }) {
  const start = vitals.samples[0]?.[0] ?? 0;
  const data = vitals.samples.map(([t, bpm]) => ({ t: Math.round((t - start) / 1000), bpm }));
  const marks = sets.filter((s) => s.completedAt).map((s) => Math.round((Date.parse(s.completedAt!) - start) / 1000));
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <Card>
      <div className="row">
        <b>Heart rate</b>
        <span className="muted small">
          avg {vitals.hrAvg ?? "—"} · max {vitals.hrMax ?? "—"} · {vitals.hrSource ?? ""}
        </span>
      </div>
      {data.length > 1 ? (
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#333" />
              <XAxis dataKey="t" tickFormatter={fmt} tick={{ fontSize: 10 }} type="number" domain={["dataMin", "dataMax"]} />
              <YAxis domain={["dataMin - 5", "dataMax + 5"]} tick={{ fontSize: 10 }} width={30} />
              <Tooltip labelFormatter={(v) => fmt(Number(v))} contentStyle={{ background: "#1c1c1e", border: "1px solid #333" }} />
              {marks.map((m, i) => (
                <ReferenceLine key={i} x={m} stroke="#9a9a9f" strokeDasharray="2 2" />
              ))}
              <Line type="monotone" dataKey="bpm" stroke="#ef4444" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="muted small">No heart rate samples for this session.</p>
      )}
      {(vitals.restingHr !== null || vitals.hrvRmssd !== null || vitals.sleepMinutes !== null) && (
        <p className="small">
          Readiness: resting HR {vitals.restingHr ?? "—"} · HRV {vitals.hrvRmssd ?? "—"} ms · sleep {vitals.sleepMinutes !== null ? `${Math.floor(vitals.sleepMinutes / 60)}h ${vitals.sleepMinutes % 60}m` : "—"}
        </p>
      )}
    </Card>
  );
}
