interface SeasonalBarsProps {
  values: number[];
  peak?: boolean[];
  height?: number;
  className?: string;
  ariaLabel?: string;
  valueSuffix?: string;
}

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function SeasonalBars({
  values,
  peak,
  height = 96,
  className = "",
  ariaLabel = "Monthly values",
  valueSuffix = "",
}: SeasonalBarsProps) {
  if (values.length !== 12) return null;

  const max = Math.max(...values, 1);
  const barW = 28;
  const gap = 8;
  const width = 12 * barW + 11 * gap;
  const labelY = height - 2;
  const chartH = height - 18;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="xMidYMax meet"
        aria-label={ariaLabel}
      >
        {values.map((v, i) => {
          const h = Math.max(1, (v / max) * chartH);
          const x = i * (barW + gap);
          const y = chartH - h;
          const isPeak = peak?.[i] ?? false;
          return (
            <g key={i}>
              <title>
                {MONTH_LABELS[i]}: {v.toFixed(1)}
                {valueSuffix}
              </title>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={2}
                fill={isPeak ? "var(--accent)" : "var(--ink-3)"}
                opacity={isPeak ? 1 : 0.5}
              />
              <text
                x={x + barW / 2}
                y={labelY}
                textAnchor="middle"
                fill="var(--ink-3)"
                style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
              >
                {MONTH_LABELS[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

