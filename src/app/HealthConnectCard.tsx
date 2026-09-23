/** §12.5 Settings section; rendered only when the HealthConnect plugin is present. */
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_HC, runQueue } from "@/data/healthSync";
import type { Settings } from "@/domain/types";
import { healthConnect, healthConnectAvailable, type HcPermission } from "@/native/healthConnect";
import { repo } from "./hooks";
import { Button, Card, Toggle } from "./ui";

export function HealthConnectCard({ settings }: { settings: Settings }) {
  const hc = settings.healthConnect ?? DEFAULT_HC;
  const [status, setStatus] = useState<string>("checking");
  const [granted, setGranted] = useState<HcPermission[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [explain, setExplain] = useState(false);
  const queued = useLiveQuery(() => repo.db.syncQueue.where("status").equals("queued").count(), []);
  const failed = useLiveQuery(() => repo.db.syncQueue.where("status").equals("failed").count(), []);

  useEffect(() => {
    healthConnect.isAvailable().then((r) => setStatus(r.status));
    healthConnect.getGranted().then((r) => setGranted(r.granted));
  }, []);

  if (!healthConnectAvailable()) return null;
  const save = (patch: Partial<typeof hc>) => repo.saveSettings({ healthConnect: { ...hc, ...patch } });
  const needed = (): HcPermission[] => ["writeExercise", ...(hc.readHeartRate ? (["readHeartRate"] as HcPermission[]) : []), ...(hc.readReadiness ? (["readRestingHeartRate", "readHrv", "readSleep"] as HcPermission[]) : []), ...(hc.readWeight ? (["readWeight"] as HcPermission[]) : [])];

  return (
    <Card>
      <h3>Health Connect</h3>
      <p className="small muted">
        Status: {status} · granted: {granted.length ? granted.join(", ") : "none"} · queued {queued ?? 0} · failed {failed ?? 0}
      </p>
      {msg && <div className="banner small">{msg}</div>}
      <Toggle label="Sync finished sessions to Health Connect" checked={hc.enabled} onChange={(v) => (v ? setExplain(true) : save({ enabled: false }))} help="One exercise session per finished session, one segment per set with reps. No weights." />
      {explain && (
        <div className="banner small">
          <p>
            <b>What is written:</b> start and end time of each finished session and one segment per logged set (exercise type, reps). <b>What is read:</b> heart rate, resting heart rate, HRV and sleep for the window around each session, stored with that session on this phone only.
          </p>
          <div className="row">
            <Button
              kind="primary"
              onClick={async () => {
                setExplain(false);
                await save({ enabled: true });
                const r = await healthConnect.requestPermissions({ types: needed() });
                setGranted(r.granted);
                setMsg(r.granted.includes("writeExercise") ? "Health Connect connected." : "Write permission was not granted; sessions will stay queued.");
              }}
            >
              Continue to permissions
            </Button>
            <Button kind="ghost" onClick={() => setExplain(false)}>
              cancel
            </Button>
          </div>
        </div>
      )}
      <Toggle label="Read heart rate" checked={hc.readHeartRate} onChange={(v) => save({ readHeartRate: v })} />
      <Toggle label="Read readiness (resting HR, HRV, sleep)" checked={hc.readReadiness} onChange={(v) => save({ readReadiness: v })} />
      <Toggle label="Read body weight" checked={hc.readWeight} onChange={(v) => save({ readWeight: v })} />
      <label className="field">
        <span className="field-label">Preferred heart-rate source (package name, blank = most samples)</span>
        <input type="text" value={hc.preferredSource ?? ""} onChange={(e) => save({ preferredSource: e.target.value || null })} placeholder="e.g. com.google.android.apps.fitness" />
      </label>
      <div className="row">
        <Button
          onClick={async () => {
            const r = await healthConnect.requestPermissions({ types: needed() });
            setGranted(r.granted);
          }}
        >
          Request permissions
        </Button>
        <Button
          onClick={async () => {
            const r = await runQueue(repo.db, await repo.getSettings());
            setMsg(`Sync: ${r.done} done, ${r.waiting} waiting for data, ${r.failed} failed.`);
          }}
        >
          Sync now
        </Button>
      </div>
    </Card>
  );
}
