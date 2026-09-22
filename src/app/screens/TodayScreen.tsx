import { Link, useNavigate } from "react-router-dom";
import { LIFTS } from "@/domain/types";
import { repo, useActiveProgram, useCurrentTM, useNextSession, useSessionData } from "../hooks";
import { Button, Card } from "../ui";

export function TodayScreen() {
  const program = useActiveProgram();
  const tm = useCurrentTM();
  const next = useNextSession(program?.id);
  const preview = useSessionData(next?.id);
  const nav = useNavigate();

  return (
    <div className="screen">
      <h1>Today</h1>
      {tm && (
        <div className="tm-strip">
          {LIFTS.map((l) => (
            <div key={l}>
              <b>{tm[l] || "—"}</b>
              <span>{l} TM</span>
            </div>
          ))}
        </div>
      )}
      {program === undefined || (program && next === undefined) ? (
        <p>Loading…</p>
      ) : !program ? (
        <Card>
          <p>No active programme.</p>
          <Button kind="primary" onClick={() => nav("/start")}>
            Start a programme
          </Button>
        </Card>
      ) : !next ? (
        <Card>
          <p>All sessions of {program.templateName} are done.</p>
          <Button kind="primary" onClick={() => nav("/tm-review")}>
            Review training maxes
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="muted small">{program.templateName}</div>
          <h2 style={{ marginTop: 4 }}>{next.plannedLabel}</h2>
          <div className="muted small">
            {next.plannedDate ? `planned ${next.plannedDate}` : ""} · TM {LIFTS.map((l) => `${l[0]} ${next.tm[l]}`).join(" · ")}
          </div>
          {preview && (
            <ul style={{ paddingLeft: 18, margin: "8px 0" }}>
              {preview.groups.map((g) => {
                const gs = preview.sets.filter((s) => s.groupId === g.id);
                const w = gs.filter((s) => s.prescribedWeight !== null).map((s) => `${s.prescribedWeight}×${s.prescribedReps}`);
                return (
                  <li key={g.id} className={g.optional ? "muted" : ""}>
                    <b>{g.label}</b>
                    {w.length > 0 && <span className="small"> — {g.type === "main" ? w.join(", ") : `${gs.length} × ${gs[0]?.prescribedReps} @ ${gs[0]?.prescribedWeight}`}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          <Button kind="primary" className="btn-block" onClick={async () => { if (next.status === "planned") await repo.startSession(next.id); nav(`/session/${next.id}`); }}>
            {next.status === "inProgress" ? "Continue session" : "Start session"}
          </Button>
        </Card>
      )}
      {program && (
        <p className="small">
          <Link to="/program">Programme grid</Link> · <Link to="/progress">Progress</Link>
        </p>
      )}
    </div>
  );
}
