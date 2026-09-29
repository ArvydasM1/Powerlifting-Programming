/** Recovery mode: no normal screens, just export, diagnostics and reset. */
import { useEffect, useState } from "react";
import { exportBackup } from "@/data/backup";
import { db } from "@/data/db";
import { shareOrDownload } from "@/native/bridge";
import { LAST_JS_ERROR_KEY } from "./CrashBanner";
import { forceRecoveryNextStart, markHealthy, readCrumbs } from "./diagnostics";

export function RecoveryScreen({ reason, onTryNormal }: { reason: string; onTryNormal: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [counts, setCounts] = useState<string>("");
  const [jsError, setJsError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const [p, s, st, pr] = await Promise.all([db.programs.count(), db.sessions.count(), db.sets.count(), db.prRecords.count()]);
        setCounts(`${p} programme(s), ${s} sessions, ${st} sets, ${pr} PR records`);
      } catch (e) {
        setCounts(`database could not be opened: ${(e as Error).message}`);
      }
      try {
        setJsError(localStorage.getItem(LAST_JS_ERROR_KEY));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const doExport = async () => {
    setMsg(null);
    try {
      const b = await exportBackup(db);
      await shareOrDownload(`531log-backup-${b.exportedAt.slice(0, 10)}.json`, JSON.stringify(b, null, 1), "application/json", "5/3/1 Log backup");
      setMsg("Backup exported. Keep it somewhere safe; Settings → Restore from backup reads it back.");
    } catch (e) {
      setMsg(`Export failed: ${(e as Error).message}`);
    }
  };

  const doReset = async () => {
    if (!confirm("Delete all app data on this phone? Export a backup first.")) return;
    try {
      await db.delete();
      localStorage.clear();
      await markHealthy();
      window.location.reload();
    } catch (e) {
      setMsg(`Reset failed: ${(e as Error).message}`);
    }
  };

  const crumbs = readCrumbs();

  return (
    <div className="screen">
      <h1>Recovery mode</h1>
      <p className="small">{reason}</p>
      <p className="small muted">Data on this phone: {counts || "…"}</p>
      {msg && <div className="banner small">{msg}</div>}
      <div className="stack">
        <button className="btn btn-primary" onClick={doExport}>
          Export backup (JSON)
        </button>
        <button
          className="btn"
          onClick={async () => {
            forceRecoveryNextStart(false);
            await markHealthy();
            onTryNormal();
          }}
        >
          Try the normal app
        </button>
        <button className="btn btn-danger" onClick={doReset}>
          Reset all app data
        </button>
      </div>
      <h3>Last steps before the crash</h3>
      <textarea readOnly rows={8} value={[...crumbs].reverse().join("\n") || "(none recorded)"} style={{ fontFamily: "monospace", fontSize: 11 }} onFocus={(e) => e.target.select()} />
      {jsError && (
        <>
          <h3>Last JavaScript error</h3>
          <textarea readOnly rows={6} value={jsError} style={{ fontFamily: "monospace", fontSize: 11 }} onFocus={(e) => e.target.select()} />
        </>
      )}
      <p className="help">Copy the text above and send it to the developer.</p>
    </div>
  );
}
