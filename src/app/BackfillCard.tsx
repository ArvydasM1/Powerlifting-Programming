/** F11: backfill sessions before the start point from the workbook or a CSV. */
import { useRef, useState } from "react";
import { parseCsv, planCsvBackfill, type CsvPlan } from "@/data/csvBackfill";
import { TEMPLATE_SHEETS, parseTemplateSheet, planWorkbookBackfill, type BackfillPlan } from "@/data/workbookBackfill";
import type { Program, Session } from "@/domain/types";
import { repo, useSettings } from "./hooks";
import { Button, Card } from "./ui";

export function BackfillCard({ program, sessions }: { program: Program; sessions: Session[] }) {
  const settings = useSettings();
  const wbInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const [wbPlan, setWbPlan] = useState<BackfillPlan | null>(null);
  const [csvPlan, setCsvPlan] = useState<{ plan: CsvPlan; errors: string[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const pending = sessions.filter((s) => s.status === "beforeStart" || s.status === "skipped");
  const sheet = TEMPLATE_SHEETS[program.templateId];

  const setsBySession = async () => {
    const m = new Map<string, Awaited<ReturnType<typeof repo.sessionSets>>>();
    for (const s of sessions) m.set(s.id, await repo.sessionSets(s.id));
    return m;
  };

  const onWorkbook = async (f: File | undefined) => {
    if (!f || !sheet || !settings) return;
    try {
      const sets = parseTemplateSheet(await f.arrayBuffer(), sheet);
      setWbPlan(planWorkbookBackfill(sets, sessions, await setsBySession(), settings.roundingStep));
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const onCsv = async (f: File | undefined) => {
    if (!f) return;
    const { rows, errors } = parseCsv(await f.text());
    setCsvPlan({ plan: planCsvBackfill(rows, sessions, await setsBySession(), await repo.db.exercises.toArray()), errors });
  };
  const allPrescribed = async () => {
    for (const s of pending) await repo.backfillAsPrescribed(s.id);
    setMsg(`${pending.length} sessions marked done as prescribed.`);
  };

  return (
    <Card>
      <h3>Backfill</h3>
      <p className="small muted">
        {pending.length} session{pending.length === 1 ? "" : "s"} before your start point or skipped. Backfilled sets count for PRs and the chart but not for rest or Health Connect.
      </p>
      {msg && <div className="banner small">{msg}</div>}
      <div className="stack">
        <Button onClick={allPrescribed} disabled={pending.length === 0}>
          Mark all done as prescribed
        </Button>
        <Button onClick={() => wbInput.current?.click()} disabled={!sheet}>
          {sheet ? `From workbook sheet "${sheet}"…` : "Workbook backfill not available for this template"}
        </Button>
        <input ref={wbInput} type="file" accept=".xlsx" hidden onChange={(e) => onWorkbook(e.target.files?.[0])} />
        <Button onClick={() => csvInput.current?.click()}>From CSV (date, exercise, weight, reps)…</Button>
        <input ref={csvInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => onCsv(e.target.files?.[0])} />
      </div>

      {wbPlan && (
        <div style={{ marginTop: 10 }}>
          <p className="small">
            {wbPlan.matches.length} sets matched · {wbPlan.unmatchedApp.length} app sets without a value · {wbPlan.unmatchedSheet.length} sheet values unused
          </p>
          <div className="row">
            <Button
              kind="primary"
              disabled={wbPlan.matches.length === 0}
              onClick={async () => {
                const n = await repo.applyBackfillMatches(wbPlan.matches, "backfillWorkbook");
                setWbPlan(null);
                setMsg(`${n} sets backfilled from the workbook.`);
              }}
            >
              Apply
            </Button>
            <Button kind="ghost" onClick={() => setWbPlan(null)}>
              cancel
            </Button>
          </div>
        </div>
      )}

      {csvPlan && (
        <div style={{ marginTop: 10 }}>
          <p className="small">
            {csvPlan.plan.matched.length} rows matched · {csvPlan.plan.extra.length} extra rows
            {csvPlan.plan.unknownExercises.length > 0 && ` · unknown exercises: ${csvPlan.plan.unknownExercises.join(", ")} (will be added)`}
          </p>
          {csvPlan.errors.map((e) => (
            <p key={e} className="error small">
              {e}
            </p>
          ))}
          <div className="row">
            <Button
              kind="primary"
              disabled={csvPlan.plan.matched.length + csvPlan.plan.extra.length === 0}
              onClick={async () => {
                const n = await repo.applyBackfillMatches(csvPlan.plan.matched.map((m) => ({ setId: m.setId, sessionId: m.sessionId, repsDone: m.row.reps, weight: m.row.weight })), "backfillCsv");
                for (const name of csvPlan.plan.unknownExercises) {
                  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                  await repo.db.exercises.put({ id, name, kind: "assistance", loadType: "dumbbell" });
                }
                await repo.addExtraBackfillSets(
                  program.id,
                  csvPlan.plan.extra.map((x) => ({ date: x.row.date, exerciseId: x.exerciseId ?? x.row.exercise.toLowerCase().replace(/[^a-z0-9]+/g, "-"), exerciseName: x.row.exercise, weight: x.row.weight, reps: x.row.reps })),
                );
                setCsvPlan(null);
                setMsg(`${n} sets matched and ${csvPlan.plan.extra.length} extra sets added from CSV.`);
              }}
            >
              Apply
            </Button>
            <Button kind="ghost" onClick={() => setCsvPlan(null)}>
              cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
