interface ExpenseBreakdownProps {
  breakdown: Record<string, number>;
  total?: number;
  className?: string;
  height?: number;
  labelMap?: Record<string, string>;
}

const PALETTE = [
  "oklch(0.46 0.085 175)",
  "oklch(0.56 0.09 205)",
  "oklch(0.66 0.10 235)",
  "oklch(0.72 0.11 85)",
  "oklch(0.66 0.13 75)",
  "oklch(0.54 0.155 30)",
  "oklch(0.62 0.07 140)",
  "oklch(0.40 0.06 260)",
  "oklch(0.58 0.08 320)",
  "oklch(0.72 0.05 255)",
];

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ExpenseBreakdown({
  breakdown,
  total,
  className = "",
  height = 14,
  labelMap,
}: ExpenseBreakdownProps) {
  const entries = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0) {
    return (
      <div className={`text-[13px] text-ink-3 ${className}`}>
        No operating expenses.
      </div>
    );
  }

  const sum = entries.reduce((s, [, v]) => s + v, 0);
  const displayTotal = total ?? sum;

  return (
    <div className={className}>
      <div
        className="w-full flex overflow-hidden rounded-sm border border-rule"
        style={{ height }}
        role="img"
        aria-label="Expense breakdown"
      >
        {entries.map(([key, value], i) => (
          <div
            key={key}
            style={{
              width: `${(value / sum) * 100}%`,
              backgroundColor: PALETTE[i % PALETTE.length],
            }}
            title={`${labelMap?.[key] ?? humanize(key)}: $${Math.round(
              value
            ).toLocaleString()}`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-4">
        {entries.map(([key, value], i) => {
          const pct = (value / sum) * 100;
          return (
            <li key={key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  aria-hidden
                />
                <span className="text-[13px] text-ink truncate">
                  {labelMap?.[key] ?? humanize(key)}
                </span>
              </div>
              <div className="flex items-baseline gap-2 shrink-0 font-mono tabular-nums text-[12px]">
                <span className="text-ink">
                  ${Math.round(value).toLocaleString()}
                </span>
                <span className="text-ink-3">{pct.toFixed(0)}%</span>
              </div>
            </li>
          );
        })}
      </ul>
      {total !== undefined && total !== sum && (
        <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-rule text-[13px]">
          <span className="caps">Total</span>
          <span className="font-mono tabular-nums text-ink">
            ${Math.round(displayTotal).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
