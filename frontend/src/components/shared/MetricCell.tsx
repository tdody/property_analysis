import type { ReactNode } from "react";

type MetricTone = "default" | "positive" | "negative" | "warn";
type MetricEmphasis = "default" | "large";

interface MetricCellProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: MetricTone;
  emphasis?: MetricEmphasis;
  className?: string;
}

export function MetricCell({
  label,
  value,
  sub,
  tone = "default",
  emphasis = "default",
  className = "",
}: MetricCellProps) {
  const toneClass =
    tone === "positive"
      ? "text-accent"
      : tone === "negative"
      ? "text-negative"
      : tone === "warn"
      ? "text-warn"
      : "text-ink";

  const valueClass =
    emphasis === "large"
      ? "font-serif text-[40px] leading-none"
      : "text-[32px] font-semibold tabular-nums leading-none";

  return (
    <div className={`px-6 py-5 ${className}`}>
      <div className="caps mb-2">{label}</div>
      <div className={`${valueClass} ${toneClass}`}>{value}</div>
      {sub && <div className="text-[13px] text-ink-3 mt-1">{sub}</div>}
    </div>
  );
}

interface MetricStripProps {
  children: ReactNode;
  className?: string;
}

export function MetricStrip({ children, className = "" }: MetricStripProps) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-y border-rule-strong lg:divide-x divide-rule-strong ${className}`}
    >
      {children}
    </div>
  );
}
