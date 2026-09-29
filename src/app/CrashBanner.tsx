/** Shows the last native crash (CrashLog plugin) and the last JS error on launch, so they can be copied. */
import { useEffect, useState } from "react";
import { registerPlugin } from "@capacitor/core";
import { hasPlugin } from "@/native/bridge";
import { Button, Card } from "./ui";

interface CrashLogPlugin {
  read(): Promise<{ text: string | null }>;
  clear(): Promise<void>;
}
const CrashLog = registerPlugin<CrashLogPlugin>("CrashLog");

export const LAST_JS_ERROR_KEY = "531log.lastJsError";

export function recordJsError(kind: string, err: unknown) {
  try {
    const e = err as { message?: string; stack?: string };
    localStorage.setItem(LAST_JS_ERROR_KEY, `${new Date().toISOString()} ${kind}: ${e?.message ?? String(err)}\n${e?.stack ?? ""}`);
  } catch {
    /* ignore */
  }
}

export function CrashBanner() {
  const [native, setNative] = useState<string | null>(null);
  const [js, setJs] = useState<string | null>(null);
  useEffect(() => {
    if (hasPlugin("CrashLog")) CrashLog.read().then((r) => setNative(r.text)).catch(() => {});
    try {
      setJs(localStorage.getItem(LAST_JS_ERROR_KEY));
    } catch {
      /* ignore */
    }
  }, []);
  if (!native && !js) return null;
  const text = [native ? `NATIVE CRASH\n${native}` : "", js ? `JS ERROR\n${js}` : ""].filter(Boolean).join("\n\n");
  return (
    <Card>
      <b>The app hit an error last time</b>
      <p className="small muted">Copy this and send it to the developer.</p>
      <textarea readOnly rows={8} value={text} style={{ fontFamily: "monospace", fontSize: 11 }} onFocus={(e) => e.target.select()} />
      <Button
        kind="ghost"
        onClick={async () => {
          if (hasPlugin("CrashLog")) await CrashLog.clear().catch(() => {});
          try {
            localStorage.removeItem(LAST_JS_ERROR_KEY);
          } catch {
            /* ignore */
          }
          setNative(null);
          setJs(null);
        }}
      >
        Dismiss
      </Button>
    </Card>
  );
}
