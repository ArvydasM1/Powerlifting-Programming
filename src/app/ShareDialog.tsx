/** §14: share sheet wrapper with the health-data checkbox (unticked, never remembered). */
import { useState } from "react";
import { shareOrDownload } from "@/native/bridge";
import { Button, Card } from "./ui";

export interface ShareItem {
  label: string;
  filename: string;
  mime: string;
  /** builds the payload; receives whether health data may be included */
  build: (includeHealth: boolean) => Promise<string | Blob>;
  /** true if the payload can contain health data at all */
  health?: boolean;
}

export function ShareDialog({ title, items, onClose }: { title: string; items: ShareItem[]; onClose: () => void }) {
  const [includeHealth, setIncludeHealth] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const anyHealth = items.some((i) => i.health);

  const run = async (item: ShareItem) => {
    setBusy(item.label);
    setError(null);
    try {
      const payload = await item.build(includeHealth && !!item.health);
      if (typeof payload === "string") await shareOrDownload(item.filename, payload, item.mime, title);
      else await shareBlob(item.filename, payload, title);
      onClose();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <div className="row">
        <b>Share {title}</b>
        <Button kind="ghost" onClick={onClose}>
          close
        </Button>
      </div>
      {anyHealth && (
        <label className="toggle">
          <span>
            <span className="toggle-label">Include health data</span>
            <span className="help">Heart rate, HRV, sleep. Off by default.</span>
          </span>
          <input type="checkbox" checked={includeHealth} onChange={(e) => setIncludeHealth(e.target.checked)} />
        </label>
      )}
      <div className="stack" style={{ marginTop: 8 }}>
        {items.map((i) => (
          <Button key={i.label} onClick={() => run(i)} disabled={busy !== null}>
            {busy === i.label ? "…" : i.label}
          </Button>
        ))}
      </div>
      {error && <p className="error small">{error}</p>}
    </Card>
  );
}

async function shareBlob(filename: string, blob: Blob, title: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    await navigator.share({ title, files: [file] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
