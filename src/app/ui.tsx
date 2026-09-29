import { useEffect, useState, type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Button({
  children,
  onClick,
  kind = "default",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "default" | "primary" | "danger" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button type={type} className={`btn btn-${kind} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Toggle({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <label className="toggle">
      <span>
        <span className="toggle-label">{label}</span>
        {help && <span className="help">{help}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  step = 0.5,
  min,
  help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  help?: string;
}) {
  // Keep the typed text locally so the field can be emptied while editing; commit parseable values as they are typed.
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value && !(text === "" && value === 0)) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={text}
        step={step}
        min={min}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          if (raw === "") return;
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => {
          if (text === "") {
            setText("0");
            onChange(0);
          } else setText(String(Number(text)));
        }}
      />
      {help && <span className="help">{help}</span>}
    </label>
  );
}

/** ± buttons around a value that can also be typed directly (decimal keyboard on phones). */
export function Stepper({ value, onChange, step, min = 0, format }: { value: number; onChange: (v: number) => void; step: number; min?: number; format?: (v: number) => string }) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const v = Number(text.replace(",", "."));
    if (text.trim() !== "" && Number.isFinite(v)) onChange(Math.max(min, v));
    setText(null);
  };
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, Number((value - step).toFixed(3))))}>
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={text ?? (format ? format(value) : String(value))}
        onFocus={(e) => {
          setText(String(value));
          e.target.select();
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <button type="button" onClick={() => onChange(Number((value + step).toFixed(3)))}>
        +
      </button>
    </div>
  );
}

export const fmtW = (w: number | null | undefined) => (w === null || w === undefined ? "—" : `${w}`);
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
