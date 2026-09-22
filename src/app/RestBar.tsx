/**
 * F10: passive rest timer. Counts up from the last "done" tap, drawn from timestamps on every
 * render so it cannot stall. The planned rest is a reference mark and a one-off alert.
 */
import { useEffect, useRef, useState } from "react";
import { formatRest } from "@/domain/calc";
import { restAlert } from "@/native/bridge";
import type { Settings, WorkoutSet } from "@/domain/types";

export function RestBar({ lastCompletedAt, nextSet, settings, elapsedSession }: { lastCompletedAt: string | null; nextSet: WorkoutSet | null; settings: Settings; elapsedSession: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  const scheduledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!lastCompletedAt || !nextSet) {
      void restAlert.cancel();
      scheduledFor.current = null;
      return;
    }
    if (scheduledFor.current === lastCompletedAt) return;
    scheduledFor.current = lastCompletedAt;
    void restAlert.schedule(Date.parse(lastCompletedAt) + nextSet.plannedRestSec * 1000, settings.restAlert);
  }, [lastCompletedAt, nextSet, settings.restAlert]);

  useEffect(() => () => void restAlert.cancel(), []);

  const elapsed = lastCompletedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(lastCompletedAt)) / 1000)) : null;
  const planned = nextSet?.plannedRestSec ?? 0;
  const pct = elapsed === null || planned === 0 ? 0 : Math.min(100, (elapsed / planned) * 100);
  const over = elapsed !== null && planned > 0 && elapsed >= planned;

  return (
    <div className="restbar">
      <div className="row">
        <div className={`time ${over ? "over" : ""}`}>{elapsed === null ? "—:——" : formatRest(elapsed)}</div>
        <div className="muted small">
          {elapsedSession !== null && <span>session {formatRest(elapsedSession)}</span>}
        </div>
      </div>
      <div className="bar">
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="next">
        {nextSet ? (
          <>
            next: <b>{nextSet.exerciseName}</b> {nextSet.prescribedWeight !== null ? `${nextSet.prescribedWeight} × ` : ""}
            {nextSet.prescribedReps} · rest {formatRest(planned)}
          </>
        ) : (
          "all sets done"
        )}
      </div>
    </div>
  );
}
