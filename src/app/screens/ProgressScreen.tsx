import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { shareFileName, svgToPngBlob } from "@/data/share";
import { LIFTS, type Lift } from "@/domain/types";
import { repo } from "../hooks";
import { ShareDialog } from "../ShareDialog";
import { Button, Card } from "../ui";

export function ProgressScreen() {
  const [lift, setLift] = useState<Lift>("Squat");
  const [share, setShare] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const prs = useLiveQuery(() => repo.prHistory(lift), [lift]);
  const tms = useLiveQuery(() => repo.db.trainingMax.where("lift").equals(lift).sortBy("effectiveFrom"), [lift]);

  const rows = (prs ?? []).slice().sort((a, b) => (a.date && b.date ? a.date.localeCompare(b.date) || a.ordinal - b.ordinal : a.ordinal - b.ordinal));
  const data = rows.map((r, i) => ({ i: i + 1, label: r.date ?? `#${r.ordinal}`, e1rm: r.e1rm, weight: r.weight, reps: r.reps }));

  return (
    <div className="screen">
      <h1>Progress</h1>
      <div className="tabs">
        {LIFTS.map((l) => (
          <button key={l} className={`btn ${l === lift ? "active" : ""}`} onClick={() => setLift(l)}>
            {l}
          </button>
        ))}
      </div>
      <Card>
        <h3>Estimated 1RM</h3>
        {data.length === 0 ? (
          <p className="muted">No PR attempts yet.</p>
        ) : (
          <div style={{ width: "100%", height: 220 }} ref={chartRef}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#333" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis domain={["dataMin - 5", "dataMax + 5"]} tick={{ fontSize: 10 }} width={36} />
                <Tooltip contentStyle={{ background: "#1c1c1e", border: "1px solid #333" }} />
                <Line type="monotone" dataKey="e1rm" stroke="#f97316" dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {tms && tms.length > 0 && (
          <p className="muted small">TM history: {tms.map((t) => `${t.effectiveFrom} ${t.value}`).join(" → ")}</p>
        )}
        {share ? (
          <ShareDialog
            title={`${lift} progress`}
            onClose={() => setShare(false)}
            items={[
              {
                label: "Chart as image",
                filename: shareFileName(lift, new Date().toISOString().slice(0, 10), "e1rm", "png"),
                mime: "image/png",
                build: async () => {
                  const svg = chartRef.current?.querySelector("svg");
                  if (!svg) throw new Error("No chart to share");
                  return svgToPngBlob(svg as SVGSVGElement);
                },
              },
              {
                label: "PR table as CSV",
                filename: shareFileName(lift, new Date().toISOString().slice(0, 10), "prs", "csv"),
                mime: "text/csv",
                build: async () => ["ordinal,date,weight,reps,e1rm", ...rows.map((r) => `${r.ordinal},${r.date ?? ""},${r.weight},${r.reps},${r.e1rm ?? ""}`)].join("\n"),
              },
            ]}
          />
        ) : (
          <Button onClick={() => setShare(true)} disabled={data.length === 0}>
            Share…
          </Button>
        )}
      </Card>
      <Card>
        <h3>PR attempts</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th className="num">Weight</th>
              <th className="num">Reps</th>
              <th className="num">e1RM</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .slice()
              .reverse()
              .map((r) => (
                <tr key={r.id}>
                  <td>{r.ordinal}</td>
                  <td>
                    {r.date ?? "—"}
                    {r.dateApproximate && r.date ? " ~" : ""}
                    {r.source === "import" ? " (import)" : ""}
                  </td>
                  <td className="num">{r.weight}</td>
                  <td className="num">{r.reps}</td>
                  <td className="num">{r.e1rm ?? "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
