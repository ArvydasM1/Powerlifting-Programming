import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { parseRepTarget, warmupSets, formatRest } from "@/domain/calc";
import type { SetGroup, WorkoutSet } from "@/domain/types";
import { keepAwake } from "@/native/bridge";
import { sessionText, shareFileName, textToPngBlob } from "@/data/share";
import { onSessionFinished, runQueue } from "@/data/healthSync";
import { recomputePerSet } from "@/data/vitalsStore";
import { heartRate } from "@/native/heartRate";
import { HeartRateButton, useLiveHeartRate } from "../HeartRateControl";
import { repo, useSessionData, useSessionVitals, useSettings } from "../hooks";
import { RestBar } from "../RestBar";
import { ShareDialog } from "../ShareDialog";
import { Button, Card, Stepper } from "../ui";
import { VitalsCard } from "../VitalsCard";

export function SessionScreen() {
  const { id } = useParams();
  const nav = useNavigate();
  const data = useSessionData(id);
  const settings = useSettings();
  const [editing, setEditing] = useState<string | null>(null);
  const [showWarmup, setShowWarmup] = useState(false);
  const [openOptional, setOpenOptional] = useState<Record<string, boolean>>({});
  const [share, setShare] = useState(false);
  const vitals = useSessionVitals(id);
  const [, tick] = useState(0);

  const live = data?.session.status === "inProgress" || data?.session.status === "planned";
  const hr = useLiveHeartRate(id, !!live);
  useEffect(() => {
    if (!live) return;
    void keepAwake.on();
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      clearInterval(t);
      void keepAwake.off();
    };
  }, [live]);

  const lastCompletedAt = useMemo(() => {
    if (!data) return null;
    return data.sets.filter((s) => s.completedAt).map((s) => s.completedAt!).sort().at(-1) ?? null;
  }, [data]);

  const nextSet = useMemo(() => {
    if (!data) return null;
    return data.sets.find((s) => !s.completedAt && !s.optional) ?? data.sets.find((s) => !s.completedAt) ?? null;
  }, [data]);

  if (!data || !settings) return <div className="screen">Loading…</div>;
  const { session, groups, sets } = data;
  const readOnly = !live;
  const topSet = session.warmupTopSet ?? Math.max(0, ...sets.filter((s) => s.blockType === "main" && s.prescribedWeight !== null).map((s) => s.prescribedWeight!));
  const elapsedSession = session.startedAt && live ? Math.floor((Date.now() - Date.parse(session.startedAt)) / 1000) : null;

  const onDone = async (s: WorkoutSet) => {
    if (readOnly) return;
    if (s.completedAt) {
      setEditing(editing === s.id ? null : s.id);
      return;
    }
    const target = parseRepTarget(s.prescribedReps);
    const needsWeight = s.blockType === "assistance" && s.actualWeight === null;
    await repo.logSet(s.id, needsWeight ? { actualWeight: (await repo.db.exercises.get(s.exerciseId))?.lastWeight ?? 0 } : {});
    if (target.amrap || target.max !== null || needsWeight) setEditing(s.id);
    else setEditing(null);
  };

  const finish = async () => {
    const r = await repo.finishSession(session.id);
    await hr.flush();
    await recomputePerSet(repo.db, session.id);
    await onSessionFinished(repo.db, settings, session.id);
    void runQueue(repo.db, settings);
    if (heartRate.state !== "idle") await heartRate.disconnect().catch(() => {});
    nav(r.programCompleted ? "/tm-review" : "/");
  };
  const perSet = new Map((vitals?.perSet ?? []).map((p) => [p.setId, p]));

  const groupSets = (g: SetGroup) => sets.filter((s) => s.groupId === g.id);

  return (
    <div className="screen">
      {live && <RestBar lastCompletedAt={lastCompletedAt} nextSet={nextSet} settings={settings} elapsedSession={elapsedSession} bpm={hr.bpm} />}
      <div className="row">
        <div>
          <h1 style={{ marginBottom: 2 }}>{session.plannedLabel.split(" · ").slice(-1)[0]}</h1>
          <div className="muted small">
            {session.phaseName} · {session.plannedLabel.split(" · ")[1]} · {session.date ?? session.plannedDate ?? ""}
            {session.status === "backfilled" && " · backfilled"}
            {session.status === "done" && session.finishedAt && session.startedAt && ` · ${formatRest(Math.floor((Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 1000))}`}
          </div>
        </div>
        <div className="row" style={{ gap: 4 }}>
          {live && <HeartRateButton state={hr.state} />}
          <Button kind="ghost" onClick={() => setShowWarmup(!showWarmup)}>
            Warm-up
          </Button>
        </div>
      </div>

      {showWarmup && (
        <Card>
          <div className="row">
            <b>Warm-up to {topSet}</b>
            <Stepper value={topSet} step={settings.roundingStep} onChange={(v) => repo.db.sessions.update(session.id, { warmupTopSet: v })} />
          </div>
          <table>
            <tbody>
              {warmupSets(topSet, settings.roundingStep).map((w) => (
                <tr key={w.pct}>
                  <td>{Math.round(w.pct * 100)}%</td>
                  <td className="num">{w.weight}</td>
                  <td className="num">× {w.reps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {groups.map((g) => {
        const gs = groupSets(g);
        const collapsed = g.optional && !openOptional[g.id] && gs.every((s) => !s.completedAt);
        const doneReps = gs.reduce((a, s) => a + (s.actualReps ?? 0), 0);
        const targetReps = gs.reduce((a, s) => a + parseRepTarget(s.prescribedReps).min, 0);
        return (
          <div className="group" key={g.id}>
            <div className="group-title">
              <b>
                {g.label}
                {g.superset && <span className="muted small"> · superset</span>}
              </b>
              {g.type === "assistance" && (
                <span className="muted small">
                  {doneReps}/{targetReps} reps
                </span>
              )}
              {g.optional && (
                <Button kind="ghost" onClick={() => setOpenOptional({ ...openOptional, [g.id]: !openOptional[g.id] })}>
                  {collapsed ? "show" : "hide"}
                </Button>
              )}
            </div>
            {!collapsed &&
              gs.map((s) => (
                <div key={s.id}>
                  <div className={`setrow ${s.completedAt || s.backfilled ? "done" : ""} ${s.optional ? "optional" : ""}`}>
                    <div className="main">
                      <div className="presc">
                        {s.prescribedWeight !== null ? `${s.prescribedWeight} × ` : ""}
                        {s.prescribedReps}
                        {s.note && <span className="muted small"> · {s.note}</span>}
                        {s.isRepPR && <span className="pr">PR</span>}
                        {!s.isRepPR && s.isE1rmPR && <span className="pr">e1RM PR</span>}
                      </div>
                      {(s.completedAt || s.backfilled) && (
                        <div className="actual">
                          did {s.actualWeight ?? "—"} × {s.actualReps ?? "—"}
                          {s.actualRestSec !== null && ` · ${formatRest(s.actualRestSec)} since last set`}
                          {perSet.get(s.id)?.hrAtDone != null && ` · ♥ ${perSet.get(s.id)!.hrAtDone} → ${perSet.get(s.id)!.hrMinBeforeNext ?? "—"}`}
                        </div>
                      )}
                    </div>
                    {!readOnly && (
                      <button className="donebtn" onClick={() => onDone(s)} aria-label={s.completedAt ? "edit set" : "mark set done"}>
                        {s.completedAt ? "✓" : ""}
                      </button>
                    )}
                  </div>
                  {editing === s.id && !readOnly && (
                    <div className="editor">
                      <label>
                        weight
                        <Stepper value={s.actualWeight ?? s.prescribedWeight ?? 0} step={settings.roundingStep} onChange={(v) => repo.updateSetValues(s.id, { actualWeight: v })} />
                      </label>
                      <label>
                        reps
                        <Stepper value={s.actualReps ?? 0} step={1} onChange={(v) => repo.updateSetValues(s.id, { actualReps: v })} />
                      </label>
                      <Button kind="ghost" onClick={() => setEditing(null)}>
                        ok
                      </Button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        );
      })}

      {!readOnly && (
        <div className="stack" style={{ marginTop: 20 }}>
          <Button kind="primary" className="btn-block" onClick={finish}>
            Finish session
          </Button>
          <div className="row">
            <Button onClick={() => repo.undoLastSet(session.id)}>Undo last set</Button>
            <Button kind="danger" onClick={async () => { await repo.skipSession(session.id); nav("/"); }}>
              Skip session
            </Button>
          </div>
        </div>
      )}
      {vitals && !live && <VitalsCard vitals={vitals} sets={sets} />}
      <label className="field" style={{ marginTop: 16 }}>
        <span className="field-label">Notes</span>
        <textarea rows={2} defaultValue={session.notes} onBlur={(e) => repo.updateSessionNotes(session.id, e.target.value)} />
      </label>
      {session.status === "beforeStart" && (
        <Card>
          <p className="muted small">This session is before your start point.</p>
          <Button onClick={() => repo.backfillAsPrescribed(session.id)}>Mark done as prescribed</Button>
        </Card>
      )}
      {session.status === "backfilled" && (
        <Button kind="ghost" onClick={() => repo.clearBackfill(session.id)}>
          Clear backfill
        </Button>
      )}
      {readOnly && (session.status === "done" || session.status === "backfilled") && (
        share ? (
          <ShareDialog
            title="session"
            onClose={() => setShare(false)}
            items={[
              {
                label: "Text summary",
                filename: shareFileName(session.phaseName, session.date ?? "undated", "session", "txt"),
                mime: "text/plain",
                health: true,
                build: async (h) => sessionText(session, groups, sets, vitals ?? null, { includeHealth: h }),
              },
              {
                label: "Image card",
                filename: shareFileName(session.phaseName, session.date ?? "undated", "session", "png"),
                mime: "image/png",
                health: true,
                build: async (h) => textToPngBlob(session.plannedLabel.split(" · ").slice(-1)[0] ?? "Session", sessionText(session, groups, sets, vitals ?? null, { includeHealth: h })),
              },
            ]}
          />
        ) : (
          <Button onClick={() => setShare(true)}>Share…</Button>
        )
      )}
    </div>
  );
}
