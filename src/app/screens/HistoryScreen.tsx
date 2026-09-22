import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { formatRest } from "@/domain/calc";
import { repo } from "../hooks";

export function HistoryScreen() {
  const rows = useLiveQuery(async () => {
    const sessions = (await repo.db.sessions.where("status").anyOf(["done", "backfilled"]).toArray()).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.ordinal - a.ordinal);
    return Promise.all(
      sessions.map(async (s) => {
        const sets = await repo.sessionSets(s.id);
        const rests = sets.map((x) => x.actualRestSec).filter((x): x is number => x !== null);
        const avgRest = rests.length ? Math.round(rests.reduce((a, b) => a + b, 0) / rests.length) : null;
        const duration = s.startedAt && s.finishedAt ? Math.floor((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 1000) : null;
        const prs = sets.filter((x) => x.isRepPR || x.isE1rmPR).length;
        return { s, avgRest, duration, prs, done: sets.filter((x) => x.completedAt || x.backfilled).length, total: sets.filter((x) => !x.optional).length };
      }),
    );
  }, []);

  return (
    <div className="screen">
      <h1>History</h1>
      {!rows ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No sessions yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Session</th>
              <th className="num">Sets</th>
              <th className="num">Time</th>
              <th className="num">Avg rest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, avgRest, duration, prs, done, total }) => (
              <tr key={s.id}>
                <td>
                  {s.date ?? "—"}
                  {s.dateApproximate ? " ~" : ""}
                </td>
                <td>
                  <Link to={`/session/${s.id}`}>{s.plannedLabel.split(" · ").slice(-1)[0]}</Link>
                  <div className="muted small">
                    {s.phaseName} {s.status === "backfilled" ? "· backfilled" : ""} {prs ? `· ${prs} PR` : ""}
                  </div>
                </td>
                <td className="num">
                  {done}/{total}
                </td>
                <td className="num">{duration !== null ? formatRest(duration) : "—"}</td>
                <td className="num">{avgRest !== null ? formatRest(avgRest) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted small">"Avg rest" is time since the previous logged set, so it includes the set itself.</p>
    </div>
  );
}
