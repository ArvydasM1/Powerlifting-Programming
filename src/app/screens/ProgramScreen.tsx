import { Link, useNavigate } from "react-router-dom";
import { LIFTS } from "@/domain/types";
import { repo, useActiveProgram, useProgramSessions } from "../hooks";
import { Button, Card } from "../ui";

export function ProgramScreen() {
  const program = useActiveProgram();
  const sessions = useProgramSessions(program?.id);
  const nav = useNavigate();
  if (program === undefined) return <div className="screen">Loading…</div>;
  if (!program)
    return (
      <div className="screen">
        <h1>Programme</h1>
        <p>
          No active programme. <Link to="/start">Start one</Link>.
        </p>
      </div>
    );
  const phases = new Map<number, { name: string; tm: string; weeks: Map<number, typeof sessions> }>();
  for (const s of sessions ?? []) {
    if (!phases.has(s.phaseIndex)) phases.set(s.phaseIndex, { name: s.phaseName, tm: LIFTS.map((l) => `${l[0]} ${s.tm[l]}`).join(" · "), weeks: new Map() });
    const ph = phases.get(s.phaseIndex)!;
    if (!ph.weeks.has(s.weekIndex)) ph.weeks.set(s.weekIndex, []);
    ph.weeks.get(s.weekIndex)!.push(s);
  }
  const cur = program.currentPointer;
  const done = (sessions ?? []).filter((s) => s.status === "done" || s.status === "backfilled").length;
  const total = (sessions ?? []).length;

  return (
    <div className="screen">
      <h1>{program.templateName}</h1>
      <p className="muted small">
        started {program.startDate} · {done}/{total} sessions done
      </p>
      {[...phases.entries()].map(([pi, ph]) => (
        <div className="phase" key={pi}>
          <div className="row">
            <b>{ph.name}</b>
            <span className="muted small">{ph.tm}</span>
          </div>
          {[...ph.weeks.entries()].map(([wi, ss]) => (
            <div className="weekrow" key={wi}>
              <span className="wl">{ss![0]!.plannedLabel.split(" · ")[1]}</span>
              {ss!.map((s) => {
                const isCur = s.phaseIndex === cur.phaseIndex && s.weekIndex === cur.weekIndex && s.sessionIndex === cur.sessionIndex;
                return (
                  <div key={s.id} className={`cell ${s.status} ${isCur ? "current" : ""}`} onClick={() => nav(`/session/${s.id}`)}>
                    {s.plannedLabel.split(" · ").slice(2).join(" ")}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
      <Card>
        <Button kind="danger" onClick={async () => { if (confirm("Abandon this programme? Logged sessions are kept.")) { await repo.abandonProgram(program.id); nav("/"); } }}>
          Abandon programme
        </Button>
      </Card>
    </div>
  );
}
