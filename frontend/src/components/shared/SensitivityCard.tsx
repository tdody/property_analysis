interface SensitivityPoint {
  label: string;
  value: number;
}

interface SensitivityCardProps {
  title: string;
  subtitle?: string;
  data: SensitivityPoint[];
  yLabel?: "$" | "%";
  height?: number;
  className?: string;
}

export function SensitivityCard({
  title,
  subtitle,
  data,
  yLabel = "$",
  height = 180,
  className = "",
}: SensitivityCardProps) {
  if (data.length === 0) {
    return (
      <div className={`border border-rule-strong rounded p-5 ${className}`}>
        <div className="caps mb-1">{title}</div>
        {subtitle && (
          <div className="text-[12px] text-ink-3 mb-3">{subtitle}</div>
        )}
        <div className="text-[13px] text-ink-3 text-center py-10">
          No data available.
        </div>
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const width = 420;
  const padding = { top: 16, right: 16, bottom: 32, left: 56 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const xStep = plotWidth / (data.length - 1 || 1);

  const points = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y:
      padding.top +
      plotHeight -
      ((d.value - minVal) / range) * plotHeight,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const zeroY =
    maxVal > 0 && minVal < 0
      ? padding.top + plotHeight - ((0 - minVal) / range) * plotHeight
      : null;

  const labelInterval = Math.max(1, Math.ceil(data.length / 6));
  const fmtValue = (v: number) =>
    yLabel === "%"
      ? `${v.toFixed(1)}%`
      : `$${Math.round(v).toLocaleString()}`;

  return (
    <div className={`border border-rule-strong rounded p-5 ${className}`}>
      <div className="caps mb-1">{title}</div>
      {subtitle && (
        <div className="text-[12px] text-ink-3 mb-3">{subtitle}</div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ height }}
      >
        {zeroY !== null && (
          <line
            x1={padding.left}
            y1={zeroY}
            x2={width - padding.right}
            y2={zeroY}
            stroke="var(--rule-strong)"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
        )}
        <path
          d={pathD}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.75}
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill="var(--accent)"
          />
        ))}
        {data.map((d, i) => {
          if (i % labelInterval !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={points[i].x}
              y={height - 6}
              textAnchor="middle"
              fill="var(--ink-3)"
              style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            >
              {d.label}
            </text>
          );
        })}
        {[minVal, (minVal + maxVal) / 2, maxVal].map((val, i) => {
          const y =
            padding.top + plotHeight - ((val - minVal) / range) * plotHeight;
          return (
            <text
              key={i}
              x={padding.left - 6}
              y={y + 3}
              textAnchor="end"
              fill="var(--ink-3)"
              style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            >
              {fmtValue(val)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
