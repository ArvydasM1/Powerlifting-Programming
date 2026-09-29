import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app/App";
import { recordJsError } from "./app/CrashBanner";
import { ErrorBoundary } from "./app/ErrorBoundary";
import "./app/styles.css";

registerSW({ immediate: true });

// Surface uncaught errors on screen too; the phone has no console we can read.
window.addEventListener("unhandledrejection", (ev) => {
  console.error("Unhandled rejection", ev.reason);
  recordJsError("unhandled rejection", ev.reason);
});
window.addEventListener("error", (ev) => {
  recordJsError("error", ev.error ?? ev.message);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
);
