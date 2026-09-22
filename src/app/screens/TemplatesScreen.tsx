import { useState } from "react";
import { TEMPLATES } from "../../../templates";
import { isTrainingPhase } from "@/domain/template";
import { Button, Card } from "../ui";

export function TemplatesScreen() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="screen">
      <h1>Templates</h1>
      {TEMPLATES.map((t) => (
        <Card key={t.id}>
          <div className="row">
            <b>{t.name}</b>
            <span className="muted small">{t.daysPerWeek} days/week</span>
          </div>
          <p className="muted small">{t.description}</p>
          <table>
            <tbody>
              {t.phases.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td className="num">TM +{p.tmOffset}</td>
                  <td className="num">{isTrainingPhase(p) ? `${p.weeks.length} wk` : "optional"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button kind="ghost" onClick={() => setOpen(open === t.id ? null : t.id)}>
            {open === t.id ? "hide weeks" : "show weeks"}
          </Button>
          {open === t.id &&
            t.phases.filter(isTrainingPhase).map((p) => (
              <div key={p.name}>
                <h3>{p.name}</h3>
                {p.weeks.map((w) => (
                  <div key={w.label} className="small">
                    <b>{w.label}</b>
                    <ul style={{ margin: "2px 0 8px", paddingLeft: 18 }}>
                      {w.sessions.map((s) => (
                        <li key={s.label}>
                          {s.label}:{" "}
                          {s.blocks
                            .map((b) =>
                              b.type === "main"
                                ? `${b.lift} ${b.sets.map((x) => `${Math.round(x.pct * 100)}×${x.reps}`).join("/")}`
                                : b.type === "supplemental"
                                  ? (b.label ?? `${b.lift} ${b.sets}×${b.reps} ${b.scheme === "pct" ? `@${Math.round((b.pct ?? 0) * 100)}%` : b.scheme}`)
                                  : `${b.exercise} ${b.sets}×${b.reps}`,
                            )
                            .join(" · ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
        </Card>
      ))}
    </div>
  );
}
