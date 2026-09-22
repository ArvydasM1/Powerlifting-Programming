import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { LIFTS, type LiftMap } from "@/domain/types";
import { repo, useActiveProgram, useSettings } from "../hooks";
import { Button, Card, NumberField } from "../ui";

const OUTCOME_TEXT: Record<string, string> = {
  skipped: "no test — one increment added",
  pass: "5+ reps at 100 % — one increment added",
  borderline: "3–4 reps — borderline, increment added; consider holding",
  fail: "under 3 reps — set to 85 % of the estimated max",
};

export function TmReviewScreen() {
  const nav = useNavigate();
  const settings = useSettings();
  const active = useActiveProgram();
  const program = useLiveQuery(async () => active ?? (await repo.db.programs.orderBy("createdAt").reverse().first()), [active?.id]);
  const proposal = useLiveQuery(() => (program ? repo.proposeEndOfProgramTM(program.id) : Promise.resolve(undefined)), [program?.id]);
  const [values, setValues] = useState<LiftMap<number> | null>(null);
  useEffect(() => {
    if (proposal && !values) {
      const v = {} as LiftMap<number>;
      for (const l of LIFTS) v[l] = proposal[l].value;
      setValues(v);
    }
  }, [proposal, values]);

  if (!program || !proposal || !values || !settings) return <div className="screen">Loading…</div>;

  const accept = async () => {
    await repo.setAllTM(values, "programEnd");
    if (program.status === "active") await repo.db.programs.update(program.id, { status: "completed" });
    nav("/start");
  };

  return (
    <div className="screen">
      <h1>Training max review</h1>
      <p className="muted small">{program.templateName} finished. Proposed TM for the next programme; edit before accepting.</p>
      {LIFTS.map((l) => (
        <Card key={l}>
          <div className="row">
            <b>{l}</b>
            <span className="muted small">anchor TM {proposal[l].anchorTM}{proposal[l].testReps !== null ? ` · test ${proposal[l].testReps} reps` : ""}</span>
          </div>
          <p className="small">{OUTCOME_TEXT[proposal[l].outcome]}</p>
          <NumberField label="New TM" value={values[l]} step={settings.roundingStep} onChange={(v) => setValues({ ...values, [l]: v })} />
        </Card>
      ))}
      <Button kind="primary" className="btn-block" onClick={accept}>
        Accept and finish programme
      </Button>
    </div>
  );
}
