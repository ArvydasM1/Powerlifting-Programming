/** §15.2 provider selection and key entry. Keys go to secure storage, never to exports. */
import { useEffect, useState } from "react";
import { clearKey, hasKey, hasPassphrase, needsPassphrase, setKey, setPassphrase, type KeyName } from "@/analysis/keys";
import { CLAUDE_MODELS, PROVIDER_ORDER, providerFor, type ProviderId } from "@/analysis/providers";
import { analysisSettings } from "@/analysis/run";
import type { Settings } from "@/domain/types";
import { repo } from "./hooks";
import { Button, Card } from "./ui";

export function AnalysisSettingsCard({ settings }: { settings: Settings }) {
  const a = analysisSettings(settings);
  const [pass, setPass] = useState("");
  const [keys, setKeys] = useState<Record<KeyName, boolean>>({ anthropic: false, gemini: false });
  const [entry, setEntry] = useState<Record<KeyName, string>>({ anthropic: "", gemini: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = async () => setKeys({ anthropic: await hasKey("anthropic"), gemini: await hasKey("gemini") });
  useEffect(() => {
    void refresh();
  }, []);
  const save = (patch: Partial<typeof a>) => repo.saveSettings({ analysis: { ...a, ...patch } });

  const saveKey = async (name: KeyName) => {
    try {
      if (needsPassphrase() && !hasPassphrase()) {
        if (!pass) throw new Error("Enter a passphrase first");
        setPassphrase(pass);
      }
      await setKey(name, entry[name].trim());
      setEntry({ ...entry, [name]: "" });
      await refresh();
      setMsg(`${name} key saved.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <Card>
      <h3>AI analysis</h3>
      <label className="field">
        <span className="field-label">Provider</span>
        <select value={a.provider} onChange={(e) => save({ provider: e.target.value as ProviderId })}>
          {PROVIDER_ORDER.map((id) => {
            const p = providerFor(id, { anthropic: a.anthropicModel, gemini: a.geminiModel });
            return (
              <option key={id} value={id}>
                {p.label}
              </option>
            );
          })}
        </select>
        <span className="help">{providerFor(a.provider, { anthropic: a.anthropicModel, gemini: a.geminiModel }).costNote}</span>
      </label>
      {msg && <div className="banner small">{msg}</div>}
      {needsPassphrase() && (
        <label className="field">
          <span className="field-label">Passphrase (browser build only; unlocks keys for this session)</span>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} onBlur={() => pass && setPassphrase(pass)} autoComplete="off" />
        </label>
      )}
      <label className="field">
        <span className="field-label">Claude model (API provider)</span>
        <select value={a.anthropicModel} onChange={(e) => save({ anthropicModel: e.target.value })}>
          {CLAUDE_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <KeyRow name="anthropic" label="Anthropic API key" present={keys.anthropic} value={entry.anthropic} onChange={(v) => setEntry({ ...entry, anthropic: v })} onSave={() => saveKey("anthropic")} onClear={async () => { await clearKey("anthropic"); await refresh(); }} />
      <label className="field">
        <span className="field-label">Gemini model (free tier, Flash only)</span>
        <input type="text" value={a.geminiModel} onChange={(e) => save({ geminiModel: e.target.value })} />
      </label>
      <KeyRow name="gemini" label="Gemini API key (Google AI Studio)" present={keys.gemini} value={entry.gemini} onChange={(v) => setEntry({ ...entry, gemini: v })} onSave={() => saveKey("gemini")} onClear={async () => { await clearKey("gemini"); await refresh(); }} />
      <p className="help">Keys are stored in the device's secure storage (Android Keystore) or encrypted under your passphrase in the browser. They are never included in backups or exports.</p>
    </Card>
  );
}

function KeyRow({ name, label, present, value, onChange, onSave, onClear }: { name: KeyName; label: string; present: boolean; value: string; onChange: (v: string) => void; onSave: () => void; onClear: () => void }) {
  return (
    <div className="field">
      <span className="field-label">
        {label} {present ? "· saved" : "· not set"}
      </span>
      <div className="row">
        <input type="password" value={value} onChange={(e) => onChange(e.target.value)} placeholder={present ? "replace…" : "paste key"} autoComplete="off" name={`${name}-key`} />
        <Button onClick={onSave} disabled={!value.trim()}>
          Save
        </Button>
        {present && (
          <Button kind="ghost" onClick={onClear}>
            clear
          </Button>
        )}
      </div>
    </div>
  );
}
