/** §15 Analysis screen: consent → run (or share/paste/import) → guarded report → proposals. */
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { PROMPT_LABELS, type PromptKind } from "@/analysis/prompt";
import { providerFor } from "@/analysis/providers";
import { acceptPasted, analysisSettings, guardedView, prepare, runLive } from "@/analysis/run";
import type { Report } from "@/analysis/schema";
import { runChecks } from "@/analysis/checks";
import type { AnalysisRun } from "@/domain/types";
import { shareOrDownload } from "@/native/bridge";
import { repo, useSettings } from "../hooks";
import { Button, Card, Toggle } from "../ui";

type Prepared = Awaited<ReturnType<typeof prepare>>;

export function AnalysisScreen() {
  const settings = useSettings();
  const nav = useNavigate();
  const [kind, setKind] = useState<PromptKind>("full");
  const [includeHealth, setIncludeHealth] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const runs = useLiveQuery(() => repo.db.analysisRuns.orderBy("date").reverse().limit(10).toArray(), []);
  const facts = useLiveQuery(async () => {
    const [sessions, sets, prs, vitals, s] = await Promise.all([repo.db.sessions.toArray(), repo.db.sets.toArray(), repo.db.prRecords.toArray(), repo.db.sessionVitals.toArray(), repo.getSettings()]);
    return runChecks({ now: new Date(), sessions, sets, prs, vitals, step: s.roundingStep });
  }, []);
  const [selected, setSelected] = useState<AnalysisRun | null>(null);
  useEffect(() => {
    if (!selected && runs && runs[0]) setSelected(runs[0]);
  }, [runs, selected]);

  if (!settings) return <div className="screen">Loading…</div>;
  const a = analysisSettings(settings);
  const provider = providerFor(a.provider, { anthropic: a.anthropicModel, gemini: a.geminiModel });
  const opts = { includeHealth, includeNotes };

  const doPrepare = async () => {
    setBusy(true);
    setMsg(null);
    try {
      setPrepared(await prepare(repo.db, a, kind, opts));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doRun = async () => {
    if (!prepared) return;
    setBusy(true);
    try {
      const run = await runLive(repo.db, a, kind, opts);
      setSelected(run);
      setPrepared(null);
      setMsg(run.status === "ok" ? "Report received." : `Run failed: ${run.error}`);
    } finally {
      setBusy(false);
    }
  };

  const doPaste = async () => {
    if (!prepared) return;
    const run = await acceptPasted(repo.db, a, kind, opts, prepared.hash, pasted);
    setSelected(run);
    setPasteOpen(false);
    setPasted("");
    setMsg(run.status === "ok" ? "Report accepted." : `Report rejected: ${run.error}`);
  };

  return (
    <div className="screen">
      <h1>Analysis</h1>
      <p className="muted small">
        Provider: <b>{provider.label}</b>. {provider.costNote} Change it in Settings.
      </p>

      <Card>
        <h3>Local checks</h3>
        {!facts || facts.length === 0 ? <p className="muted small">Nothing flagged by the rule-based checks.</p> : facts.map((f, i) => (
          <p key={i} className="small">
            <b>{f.severity}</b> · {f.text}
          </p>
        ))}
      </Card>

      <Card>
        <h3>Run</h3>
        <label className="field">
          <span className="field-label">Question</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as PromptKind)}>
            {(Object.keys(PROMPT_LABELS) as PromptKind[]).map((k) => (
              <option key={k} value={k}>
                {PROMPT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <Toggle label="Include health data" checked={includeHealth && a.provider !== "gemini-free"} onChange={setIncludeHealth} help={a.provider === "gemini-free" ? "Never sent on the Gemini free tier (Google may train on free-tier data)." : "Heart rate, HRV, sleep summaries. Off by default."} />
        <Toggle label="Include session notes" checked={includeNotes} onChange={setIncludeNotes} help="Free text you typed. Off by default." />
        {!prepared ? (
          <Button kind="primary" className="btn-block" onClick={doPrepare} disabled={busy}>
            {busy ? "Preparing…" : "Prepare analysis"}
          </Button>
        ) : (
          <div className="banner">
            <p className="small">
              <b>What will be sent:</b> settings, TM history, programmes, {prepared.bundle.sessions.length} recent sessions in full, {prepared.bundle.olderSessions.length} older sessions summarised, {prepared.bundle.prs.length} PR attempts
              {prepared.options.includeHealth ? ", health summaries" : ", no health data"}
              {prepared.options.includeNotes ? ", notes" : ", no notes"}. About <b>{prepared.estimate.inputTokens.toLocaleString()}</b> tokens ({prepared.estimate.note}); cost {prepared.estimate.costUsd === null ? "unknown" : `$${prepared.estimate.costUsd.toFixed(2)}`}.
            </p>
            {!prepared.ready.ok && <p className="error small">{prepared.ready.reason}</p>}
            <div className="stack">
              {(a.provider === "gemini-free" || a.provider === "anthropic-api") && (
                <Button kind="primary" onClick={doRun} disabled={busy || !prepared.ready.ok}>
                  {busy ? "Running…" : "Send and analyse"}
                </Button>
              )}
              {(a.provider === "share" || a.provider === "claude-code") && (
                <>
                  <Button kind="primary" onClick={() => shareOrDownload(`531log-analysis-${kind}-${new Date().toISOString().slice(0, 10)}.${a.provider === "share" ? "txt" : "json"}`, a.provider === "share" ? prepared.shareText : prepared.json, a.provider === "share" ? "text/plain" : "application/json", "Analysis bundle")}>
                    {a.provider === "share" ? "Share prompt + data" : "Export bundle for Claude Code"}
                  </Button>
                  <Button onClick={() => setPasteOpen(true)}>{a.provider === "share" ? "Paste report" : "Import report.json"}</Button>
                </>
              )}
              <Button kind="ghost" onClick={() => setPrepared(null)}>
                cancel
              </Button>
            </div>
            {pasteOpen && (
              <div className="stack" style={{ marginTop: 8 }}>
                <textarea rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste the JSON reply here" />
                <input type="file" accept="application/json,.json" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPasted(await f.text()); }} />
                <Button kind="primary" onClick={doPaste} disabled={!pasted.trim()}>
                  Validate and save
                </Button>
              </div>
            )}
          </div>
        )}
        {msg && <p className="small">{msg}</p>}
      </Card>

      {selected && <ReportView run={selected} step={settings.roundingStep} onStartProgram={(state) => nav("/start", { state })} />}

      {runs && runs.length > 0 && (
        <Card>
          <h3>Past runs</h3>
          <table>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} onClick={() => setSelected(r)} style={{ cursor: "pointer" }}>
                  <td>{r.date.slice(0, 16).replace("T", " ")}</td>
                  <td>{r.provider}{r.model ? ` · ${r.model}` : ""}</td>
                  <td>{r.status}</td>
                  <td className="num">{r.costUsd !== null ? `$${r.costUsd.toFixed(2)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function ReportView({ run, step, onStartProgram }: { run: AnalysisRun; step: number; onStartProgram: (state: unknown) => void }) {
  const report = run.report as Report | null;
  const view = useLiveQuery(async () => (report ? guardedView(repo.db, report, step) : null), [run.id]);
  const [accepted, setAccepted] = useState<string[]>(run.acceptedProposals);
  if (!report) {
    return (
      <Card>
        <h3>Run {run.date.slice(0, 10)}</h3>
        <p className="error small">{run.error ?? "No report"}</p>
      </Card>
    );
  }
  const accept = async (key: string) => {
    const next = [...accepted, key];
    setAccepted(next);
    await repo.db.analysisRuns.update(run.id, { acceptedProposals: next });
  };
  return (
    <>
      <Card>
        <h3>Performance · {run.date.slice(0, 10)}</h3>
        <p className="small" style={{ whiteSpace: "pre-wrap" }}>{report.performance.summary}</p>
        <table>
          <tbody>
            {report.performance.perLift.map((l) => (
              <tr key={l.lift}>
                <td>{l.lift}</td>
                <td>{l.trend}</td>
                <td className="num">{l.e1rmChange12w !== null ? `${l.e1rmChange12w > 0 ? "+" : ""}${l.e1rmChange12w}` : "—"}</td>
                <td className="small">{l.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          Adherence {report.performance.adherence.sessionsDone}/{report.performance.adherence.sessionsPlanned} sessions · {report.performance.adherence.skippedSets} skipped sets
        </p>
      </Card>
      <Card>
        <h3>Worth attention</h3>
        {view?.attention.length === 0 && <p className="muted small">Nothing flagged.</p>}
        {view?.attention.map((g, i) => (
          <div key={i} className="small" style={{ marginBottom: 8 }}>
            <b>{g.item.kind} · {g.item.severity}</b>
            {g.withheld ? <p className="muted">{g.withheld}</p> : <p>{g.displayText}</p>}
            {!g.withheld && g.item.evidence.map((e, j) => (
              <p key={j} className="muted">
                {e.metric}: {e.values.join(", ")} {e.dates.length ? `(${e.dates.join(", ")})` : ""}
              </p>
            ))}
            {!g.withheld && !accepted.includes(`note:${i}`) && (
              <Button kind="ghost" onClick={async () => { await repo.db.notes.add({ date: new Date().toISOString().slice(0, 10), text: g.displayText }); await accept(`note:${i}`); }}>
                Add note
              </Button>
            )}
          </div>
        ))}
      </Card>
      <Card>
        <h3>Exercise proposals</h3>
        {report.exerciseProposals.length === 0 && <p className="muted small">None.</p>}
        {report.exerciseProposals.map((p, i) => {
          const key = `ex:${i}`;
          return (
            <div key={i} className="small" style={{ marginBottom: 8 }}>
              <b>{p.newName ?? p.exerciseId}</b> · {p.category} · {p.suggestedSetsReps} · {p.forDays.join(", ")}
              <p className="muted">{p.reason}</p>
              {accepted.includes(key) ? (
                <span className="muted">accepted</span>
              ) : (
                <Button
                  kind="ghost"
                  onClick={async () => {
                    const name = p.newName ?? p.exerciseId ?? "Exercise";
                    const id = p.exerciseId ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                    if (!(await repo.db.exercises.get(id))) await repo.db.exercises.put({ id, name, kind: "assistance", category: p.category, loadType: "dumbbell" });
                    await accept(key);
                  }}
                >
                  Accept (add to catalogue)
                </Button>
              )}
            </div>
          );
        })}
      </Card>
      {report.programProposal && view?.tm && (
        <Card>
          <h3>Next programme</h3>
          <p className="small">
            <b>{report.programProposal.templateId}</b> from {report.programProposal.startDate}. {report.programProposal.reason}
          </p>
          <table>
            <tbody>
              {view.tm.map((t) => (
                <tr key={t.lift}>
                  <td>{t.lift}</td>
                  <td className="num">{t.clamped ? <s>{t.proposed}</s> : t.proposed}</td>
                  <td className="num">{t.used}{t.clamped ? " (current TM, proposal outside ±10 %)" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button
            kind="primary"
            onClick={() =>
              onStartProgram({
                templateId: report.programProposal!.templateId,
                tm: Object.fromEntries(view.tm!.map((t) => [t.lift, t.used])),
                options: report.programProposal!.options,
                startDate: report.programProposal!.startDate,
              })
            }
          >
            Start this programme…
          </Button>
        </Card>
      )}
    </>
  );
}
