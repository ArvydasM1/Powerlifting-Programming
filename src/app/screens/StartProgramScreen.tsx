import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TEMPLATES } from "../../../templates";
import { baseTMFromCurrent, tmForPhase } from "@/domain/calc";
import { isTrainingPhase } from "@/domain/template";
import { LIFTS, type Lift, type LiftMap, type ProgramPointer } from "@/domain/types";
import { repo, useCurrentTM, useSettings } from "../hooks";
import { Button, Card, DAY_NAMES, NumberField, Toggle } from "../ui";

export function StartProgramScreen() {
  const nav = useNavigate();
  const settings = useSettings();
  const currentTM = useCurrentTM();
  /** §15.7: a proposal from the Analysis screen pre-fills this form; the lifter still confirms here */
  const prefill = (useLocation().state ?? null) as { templateId?: string; tm?: LiftMap<number>; options?: { includeDeload: boolean; includeTmTest: boolean; includeAssistance: boolean }; startDate?: string } | null;
  const [templateId, setTemplateId] = useState(prefill?.templateId && TEMPLATES.some((t) => t.id === prefill.templateId) ? prefill.templateId : TEMPLATES[0]!.id);
  const [opts, setOpts] = useState(prefill?.options ?? { includeDeload: true, includeTmTest: true, includeAssistance: true });
  const [startAt, setStartAt] = useState<ProgramPointer>({ phaseIndex: 0, weekIndex: 0, sessionIndex: 0 });
  const [tmNow, setTmNow] = useState<LiftMap<number>>(prefill?.tm ?? { Squat: 0, Bench: 0, Press: 0, Deadlift: 0 });
  const [anchorDate, setAnchorDate] = useState(prefill?.startDate ?? new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [error, setError] = useState<string | null>(null);

  const template = TEMPLATES.find((t) => t.id === templateId)!;
  const phases = template.phases;
  const phase = phases[startAt.phaseIndex]!;
  const weeks = isTrainingPhase(phase) ? phase.weeks : [];
  const sessions = weeks[startAt.weekIndex]?.sessions ?? [];
  const fresh = startAt.phaseIndex === 0 && startAt.weekIndex === 0 && startAt.sessionIndex === 0;

  useEffect(() => {
    if (settings && !prefill?.options) setOpts({ includeDeload: settings.includeDeloadAfterLeaders, includeTmTest: settings.includeTmTestAtEnd, includeAssistance: settings.includeAssistance });
  }, [settings, prefill?.options]);
  useEffect(() => {
    if (currentTM && !prefill?.tm) setTmNow(currentTM);
  }, [currentTM, prefill?.tm]);
  useEffect(() => {
    setStartAt({ phaseIndex: 0, weekIndex: 0, sessionIndex: 0 });
    const defaults: Record<number, number[]> = { 3: [1, 3, 5], 4: [1, 2, 4, 5] };
    setDays(defaults[template.daysPerWeek] ?? [1, 3, 5]);
  }, [templateId, template.daysPerWeek]);

  const baseTM = useMemo(() => {
    if (!settings) return tmNow;
    const out = {} as LiftMap<number>;
    for (const l of LIFTS) out[l] = fresh ? tmNow[l] : baseTMFromCurrent(tmNow[l], phase.tmOffset, settings.cycleIncrease[l]);
    return out;
  }, [tmNow, phase, settings, fresh]);

  const create = async () => {
    setError(null);
    try {
      if (LIFTS.some((l) => !(baseTM[l] > 0))) throw new Error("Enter a training max for every lift");
      if (days.length === 0) throw new Error("Pick at least one training day");
      await repo.createProgram({ template, baseTM, options: opts, startAt, anchorDate, trainingDays: days });
      if (currentTM && LIFTS.some((l) => currentTM[l] !== tmNow[l])) await repo.setAllTM(tmNow, "manual");
      nav("/");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!settings) return <div className="screen">Loading…</div>;

  return (
    <div className="screen">
      <h1>Start a programme</h1>
      <Card>
        <label className="field">
          <span className="field-label">Template</span>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.daysPerWeek} days/week
              </option>
            ))}
          </select>
        </label>
        <p className="muted small">{template.description}</p>
      </Card>

      <Card>
        <h3>Options</h3>
        <Toggle label="7th-week deload after the leaders" checked={opts.includeDeload} onChange={(v) => setOpts({ ...opts, includeDeload: v })} />
        <Toggle label="7th-week TM test at the end" checked={opts.includeTmTest} onChange={(v) => setOpts({ ...opts, includeTmTest: v })} />
        <Toggle label="Include assistance" checked={opts.includeAssistance} onChange={(v) => setOpts({ ...opts, includeAssistance: v })} help={template.assistanceNote} />
      </Card>

      <Card>
        <h3>Start at</h3>
        <div className="grid2">
          <label className="field">
            <span className="field-label">Phase</span>
            <select value={startAt.phaseIndex} onChange={(e) => setStartAt({ phaseIndex: Number(e.target.value), weekIndex: 0, sessionIndex: 0 })}>
              {phases.map((p, i) => isTrainingPhase(p) && (
                <option key={i} value={i}>
                  {p.name} (TM +{p.tmOffset})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Week</span>
            <select value={startAt.weekIndex} onChange={(e) => setStartAt({ ...startAt, weekIndex: Number(e.target.value), sessionIndex: 0 })}>
              {weeks.map((w, i) => (
                <option key={i} value={i}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="field-label">Session</span>
          <select value={startAt.sessionIndex} onChange={(e) => setStartAt({ ...startAt, sessionIndex: Number(e.target.value) })}>
            {sessions.map((s, i) => (
              <option key={i} value={i}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{fresh ? "First session date" : "Date of that session (your next one)"}</span>
          <input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
        </label>
        <div className="field">
          <span className="field-label">Training days</span>
          <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            {DAY_NAMES.map((d, i) => (
              <Button key={d} kind={days.includes(i) ? "primary" : "default"} onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort())}>
                {d}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <h3>{fresh ? "Training max" : `Training max you are lifting with now (${phase.name})`}</h3>
        <div className="grid2">
          {LIFTS.map((l: Lift) => (
            <NumberField key={l} label={l} value={tmNow[l]} step={settings.roundingStep} onChange={(v) => setTmNow({ ...tmNow, [l]: v })} />
          ))}
        </div>
        {!fresh && (
          <p className="muted small">
            Base TM = now − {phase.tmOffset} × increase: {LIFTS.map((l) => `${l} ${baseTM[l]}`).join(" · ")}. Anchor TM would be{" "}
            {LIFTS.map((l) => `${l} ${tmForPhase(baseTM[l], 2, settings.cycleIncrease[l])}`).join(" · ")}.
          </p>
        )}
      </Card>

      {error && <p className="error">{error}</p>}
      <Button kind="primary" className="btn-block" onClick={create}>
        Create programme
      </Button>
    </div>
  );
}
