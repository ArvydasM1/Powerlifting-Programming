import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app/App";
import { recordJsError } from "./app/CrashBanner";
import { crumb, failedStarts, markHealthy, recoveryForced } from "./app/diagnostics";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { RecoveryScreen } from "./app/RecoveryScreen";
import "./app/styles.css";

crumb("boot");
registerSW({ immediate: true });

// Surface uncaught errors on screen too; the phone has no console we can read.
window.addEventListener("unhandledrejection", (ev) => {
  console.error("Unhandled rejection", ev.reason);
  recordJsError("unhandled rejection", ev.reason);
});
window.addEventListener("error", (ev) => {
  recordJsError("error", ev.error ?? ev.message);
});

const RECOVERY_AFTER = 2;

function Root() {
  const [mode, setMode] = useState<"checking" | "normal" | "recovery">("checking");
  const [reason, setReason] = useState("");
  useEffect(() => {
    (async () => {
      const forced = recoveryForced();
      const n = await failedStarts();
      crumb(`startInfo failed=${n} forced=${forced}`);
      if (forced || n >= RECOVERY_AFTER) {
        setReason(forced ? "Recovery was requested from Settings." : `The app failed to start ${n} times in a row, so it opened here instead of the normal screens.`);
        setMode("recovery");
        return;
      }
      setMode("normal");
      // The app counts as healthy once it has stayed up for a while.
      setTimeout(() => {
        crumb("healthy");
        void markHealthy();
      }, 8000);
    })();
  }, []);
  if (mode === "checking") return <div className="screen">Starting…</div>;
  if (mode === "recovery") return <RecoveryScreen reason={reason} onTryNormal={() => setMode("normal")} />;
  return (
    <HashRouter>
      <App />
    </HashRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
);
