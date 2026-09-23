import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { exportBackup, importBackup, setsToCsv } from "@/data/backup";
import { parseWorkbook, type WorkbookImport } from "@/data/workbookImport";
import { LIFTS, type LiftMap, type Settings } from "@/domain/types";
import { shareOrDownload } from "@/native/bridge";
import { AnalysisSettingsCard } from "../AnalysisSettingsCard";
import { HealthConnectCard } from "../HealthConnectCard";
import { repo, useCurrentTM, useSettings } from "../hooks";
import { Button, Card, NumberField, Toggle } from "../ui";

export function SettingsScreen() {
  const settings = useSettings();
  const tm = useCurrentTM();
  const [draftTM, setDraftTM] = useState<LiftMap<number> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [wb, setWb] = useState<WorkbookImport | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const wbInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tm && !draftTM) setDraftTM(tm);
  }, [tm, draftTM]);

  if (!settings || !draftTM) return <div className="screen">Loading…</div>;
  const save = (patch: Partial<Settings>) => repo.saveSettings(patch);

  const doBackup = async () => {
    const b = await exportBackup(repo.db);
    await shareOrDownload(`531log-backup-${b.exportedAt.slice(0, 10)}.json`, JSON.stringify(b, null, 1), "application/json", "5/3/1 Log backup");
  };
  const doCsv = async () => {
    const sessions = await repo.db.sessions.toArray();
    const byId = new Map(sessions.map((s) => [s.id, s]));
    const sets = await repo.db.sets.toArray();
    const rows = sets
      .filter((s) => s.completedAt || s.backfilled)
      .map((s) => ({ ...s, date: byId.get(s.sessionId)?.date ?? "", session: byId.get(s.sessionId)?.plannedLabel ?? "", exercise: s.exerciseName }));
    await shareOrDownload(`531log-sets-${new Date().toISOString().slice(0, 10)}.csv`, setsToCsv(rows), "text/csv", "5/3/1 Log sets");
  };
  const onBackupFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      if (!confirm("Restore replaces everything in the app with the backup. Continue?")) return;
      await importBackup(repo.db, JSON.parse(await f.text()));
      setMsg("Backup restored.");
      setDraftTM(null);
    } catch (e) {
      setMsg(`Restore failed: ${(e as Error).message}`);
    }
  };
  const onWorkbookFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setWb(parseWorkbook(await f.arrayBuffer()));
    } catch (e) {
      setMsg(`Could not read workbook: ${(e as Error).message}`);
    }
  };
  const applyWorkbook = async () => {
    if (!wb) return;
    if (wb.tm) await repo.setAllTM(wb.tm, "import");
    if (wb.rounding || wb.increases) await save({ ...(wb.rounding ? { roundingStep: wb.rounding } : {}), ...(wb.increases ? { cycleIncrease: wb.increases } : {}) });
    for (const l of LIFTS) if (wb.prs[l]?.length) await repo.importPRList(l, wb.prs[l]!);
    setWb(null);
    setDraftTM(null);
    setMsg("Workbook imported.");
  };

  return (
    <div className="screen">
      <h1>Settings</h1>
      <p className="small">
        <Link to="/templates">Browse the templates</Link>
      </p>
      {msg && <div className="banner">{msg}</div>}

      <Card>
        <h3>Training max</h3>
        <div className="grid2">
          {LIFTS.map((l) => (
            <NumberField key={l} label={l} value={draftTM[l]} step={settings.roundingStep} onChange={(v) => setDraftTM({ ...draftTM, [l]: v })} />
          ))}
        </div>
        <Button kind="primary" onClick={async () => { await repo.setAllTM(draftTM, "manual"); setMsg("Training max saved (history kept)."); }}>
          Save TM
        </Button>
        <p className="help">Saving adds a dated row; earlier programmes keep the weights they were generated with.</p>
      </Card>

      <Card>
        <h3>Progression</h3>
        <NumberField label="Rounding step (kg)" value={settings.roundingStep} step={0.5} min={0.5} onChange={(v) => save({ roundingStep: v })} />
        <div className="grid2">
          {LIFTS.map((l) => (
            <NumberField key={l} label={`${l} increase per cycle`} value={settings.cycleIncrease[l]} step={0.5} onChange={(v) => save({ cycleIncrease: { ...settings.cycleIncrease, [l]: v } })} />
          ))}
        </div>
        <p className="help">Book guidance: +2.5 kg upper body, +5 kg lower body per cycle. Yours to set.</p>
        <Toggle label="Deload after leaders (default)" checked={settings.includeDeloadAfterLeaders} onChange={(v) => save({ includeDeloadAfterLeaders: v })} />
        <Toggle label="TM test at the end (default)" checked={settings.includeTmTestAtEnd} onChange={(v) => save({ includeTmTestAtEnd: v })} />
        <Toggle label="Include assistance (default)" checked={settings.includeAssistance} onChange={(v) => save({ includeAssistance: v })} />
      </Card>

      <Card>
        <h3>Rest reference (seconds)</h3>
        <div className="grid2">
          {(["main", "supplemental", "assistance", "superset"] as const).map((k) => (
            <NumberField key={k} label={k} value={settings.defaultRestSec[k]} step={15} min={0} onChange={(v) => save({ defaultRestSec: { ...settings.defaultRestSec, [k]: v } })} />
          ))}
        </div>
        <label className="field">
          <span className="field-label">Alert when reference rest is reached</span>
          <select value={settings.restAlert} onChange={(e) => save({ restAlert: e.target.value as Settings["restAlert"] })}>
            <option value="vibrate">vibrate</option>
            <option value="sound">sound</option>
            <option value="both">both</option>
            <option value="none">none</option>
          </select>
        </label>
      </Card>

      <HealthConnectCard settings={settings} />
      <AnalysisSettingsCard settings={settings} />

      <Card>
        <h3>Backup and export</h3>
        <div className="stack">
          <Button onClick={doBackup}>Export backup (JSON)</Button>
          <Button onClick={doCsv}>Export sets (CSV)</Button>
          <Button onClick={() => backupInput.current?.click()}>Restore from backup…</Button>
          <input ref={backupInput} type="file" accept="application/json" hidden onChange={(e) => onBackupFile(e.target.files?.[0])} />
        </div>
        <p className="help">Backups contain your training data. Keep them outside any public repository.</p>
      </Card>

      <Card>
        <h3>Import from the 531 Forever workbook</h3>
        <Button onClick={() => wbInput.current?.click()}>Choose 531 Forever.xlsx…</Button>
        <input ref={wbInput} type="file" accept=".xlsx" hidden onChange={(e) => onWorkbookFile(e.target.files?.[0])} />
        {wb && (
          <div>
            <p className="small">
              TM: {wb.tm ? LIFTS.map((l) => `${l} ${wb.tm![l]}`).join(" · ") : "not found"}
              <br />
              Rounding: {wb.rounding ?? "not found"} · Increases: {wb.increases ? LIFTS.map((l) => `${l} ${wb.increases![l]}`).join(" · ") : "not found"}
              <br />
              PR lists: {LIFTS.map((l) => `${l} ${wb.prs[l]?.length ?? 0}`).join(" · ")}
            </p>
            <Button kind="primary" onClick={applyWorkbook}>
              Import
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
