import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`glass rounded-2xl ${className}`}>{children}</div>;
}

export function DataCard({
  label,
  value,
  unit,
  tone = "default",
  big = false,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "default" | "good" | "warn";
  big?: boolean;
}) {
  const toneClass =
    tone === "good"
      ? "text-accent"
      : tone === "warn"
        ? "text-[color:var(--warn)]"
        : "text-primary";
  return (
    <div className="glass rounded-xl px-3 py-3 sm:px-4">
      <div className="tech-label text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
        {label}
      </div>
      <div
        className={`mt-1 font-display font-bold tabular-nums glow-text ${toneClass} ${
          big ? "text-2xl sm:text-4xl" : "text-xl sm:text-2xl"
        }`}
      >
        {value}
        {unit ? (
          <span className="ml-1 text-xs font-medium text-muted-foreground sm:text-sm">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block w-full select-none">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="tech-label text-xs text-muted-foreground">{label}</span>
        <span className="font-display text-base font-bold text-primary tabular-nums">
          {value}
          <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        className="range-tech"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function ActionButton({
  children,
  onClick,
  variant = "ghost",
  active = false,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost" | "alert";
  active?: boolean;
}) {
  const base =
    "tech-label min-h-[46px] flex-1 rounded-xl px-4 text-xs font-semibold transition-all duration-200 active:scale-[0.97]";
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-foreground shadow-[0_0_24px_oklch(0.8_0.14_200/45%)] hover:brightness-110"
      : variant === "alert"
        ? "bg-[color:var(--warn)] text-primary-foreground hover:brightness-110"
        : `border border-border text-foreground hover:bg-secondary ${active ? "bg-secondary" : ""}`;
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{children}</p>
  );
}
