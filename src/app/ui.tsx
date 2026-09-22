import type { ReactNode } from "react";

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
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input type="number" inputMode="decimal" value={value} step={step} min={min} onChange={(e) => onChange(Number(e.target.value))} />
      {help && <span className="help">{help}</span>}
    </label>
  );
}

export function Stepper({ value, onChange, step, min = 0, format }: { value: number; onChange: (v: number) => void; step: number; min?: number; format?: (v: number) => string }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, Number((value - step).toFixed(3))))}>
        −
      </button>
      <span>{format ? format(value) : value}</span>
      <button type="button" onClick={() => onChange(Number((value + step).toFixed(3)))}>
        +
      </button>
    </div>
  );
}

export const fmtW = (w: number | null | undefined) => (w === null || w === undefined ? "—" : `${w}`);
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
