import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { runQueue } from "@/data/healthSync";
import { repo } from "./hooks";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ProgramScreen } from "./screens/ProgramScreen";
import { ProgressScreen } from "./screens/ProgressScreen";
import { SessionScreen } from "./screens/SessionScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StartProgramScreen } from "./screens/StartProgramScreen";
import { TemplatesScreen } from "./screens/TemplatesScreen";
import { TmReviewScreen } from "./screens/TmReviewScreen";
import { TodayScreen } from "./screens/TodayScreen";

export function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    repo.ensureSeeded().then(async () => {
      setReady(true);
      // §12.4: drain the Health Connect queue on launch (no-op unless enabled and available)
      void runQueue(repo.db, await repo.getSettings());
    });
  }, []);
  if (!ready) return <div className="screen">Loading…</div>;
  return (
    <>
      <Routes>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/start" element={<StartProgramScreen />} />
        <Route path="/session/:id" element={<SessionScreen />} />
        <Route path="/program" element={<ProgramScreen />} />
        <Route path="/progress" element={<ProgressScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/templates" element={<TemplatesScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/tm-review" element={<TmReviewScreen />} />
      </Routes>
      <nav className="nav">
        <NavLink to="/" end>
          <span>▶</span>Today
        </NavLink>
        <NavLink to="/program">
          <span>▦</span>Programme
        </NavLink>
        <NavLink to="/progress">
          <span>↗</span>Progress
        </NavLink>
        <NavLink to="/history">
          <span>☰</span>History
        </NavLink>
        <NavLink to="/templates">
          <span>▤</span>Templates
        </NavLink>
        <NavLink to="/settings">
          <span>⚙</span>Settings
        </NavLink>
      </nav>
    </>
  );
}
