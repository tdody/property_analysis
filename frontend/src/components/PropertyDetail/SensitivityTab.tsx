import { useState, useEffect } from "react";
import type { TornadoData, TornadoBar } from "../../types/index.ts";
import { getTornado, getLTRTornado } from "../../api/client.ts";

// ── Metric options ──────────────────────────────────────────────────
const METRICS = [
  { key: "monthly_cashflow", label: "Monthly Cashflow" },
  { key: "cash_on_cash_return", label: "Cash-on-Cash" },
  { key: "cap_rate", label: "Cap Rate" },
] as const;

// ── Formatting helpers ──────────────────────────────────────────────
function isPctMetric(key: string) {
  return key === "cash_on_cash_return" || key === "cap_rate";
}

function fmtOutput(value: number, metricKey: string): string {
  if (isPctMetric(metricKey)) return `${value.toFixed(1)}%`;
  if (value < 0) return `-$${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtInput(value: number, variableName: string): string {
  if (variableName.includes("pct") || variableName.includes("rate") || variableName.includes("vacancy") || variableName.includes("appreciation") || variableName.includes("growth") || variableName.includes("management")) {
    return `${value.toFixed(1)}%`;
  }
  if (variableName.includes("stay") || variableName.includes("length")) {
    return `${value.toFixed(1)} nights`;
  }
  if (variableName.includes("price") || variableName.includes("rent") || variableName.includes("cost") || variableName.includes("fee") || variableName.includes("revenue") || variableName.includes("nightly") || variableName.includes("monthly")) {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return value.toFixed(1);
}

// ── TornadoChart ────────────────────────────────────────────────────
function TornadoChart({
  data,
  selectedBar,
  onSelectBar,
}: {
  data: TornadoData;
  selectedBar: TornadoBar | null;
  onSelectBar: (bar: TornadoBar | null) => void;
}) {
  const bars = data.bars;
  if (bars.length === 0) return <p className="text-slate-500 dark:text-slate-400">No sensitivity data available.</p>;

  const barHeight = 32;
  const barGap = 8;
  const labelWidth = 180;
  const annotationWidth = 80;
  const padding = { top: 50, right: annotationWidth + 20, bottom: 50, left: labelWidth + 10 };
  const chartWidth = 700;
  const plotWidth = chartWidth - padding.left - padding.right;
  const chartHeight = padding.top + bars.length * (barHeight + barGap) + padding.bottom;

  // Determine output range across all bars
  const allOutputs = bars.flatMap((b) => [b.low_output, b.high_output]);
  const minOutput = Math.min(...allOutputs, data.baseline_value);
  const maxOutput = Math.max(...allOutputs, data.baseline_value);
  const outputRange = maxOutput - minOutput || 1;

  const xScale = (val: number) => padding.left + ((val - minOutput) / outputRange) * plotWidth;
  const baselineX = xScale(data.baseline_value);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{data.metric_label}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Baseline: <span className="font-medium text-slate-700 dark:text-slate-300">{fmtOutput(data.baseline_value, data.metric_key)}</span>
        </p>
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Baseline dashed line */}
        <line
          x1={baselineX}
          y1={padding.top - 10}
          x2={baselineX}
          y2={chartHeight - padding.bottom + 10}
          stroke="#94a3b8"
          strokeDasharray="4 4"
          strokeWidth={1}
        />
        <text x={baselineX} y={padding.top - 16} textAnchor="middle" className="fill-slate-500" fontSize={10}>
          {fmtOutput(data.baseline_value, data.metric_key)}
        </text>

        {bars.map((bar, i) => {
          const y = padding.top + i * (barHeight + barGap);
          const lowX = xScale(bar.low_output);
          const highX = xScale(bar.high_output);
          const isSelected = selectedBar?.variable_name === bar.variable_name;
          const dimmed = selectedBar !== null && !isSelected;

          // For inverse variables (e.g., fees), high input → lower output,
          // so highX may be left of baseline. Use min/max to find actual sides.
          const worstX = Math.min(lowX, highX);
          const bestX = Math.max(lowX, highX);
          const worstOutput = bar.low_output < bar.high_output ? bar.low_output : bar.high_output;
          const bestOutput = bar.low_output < bar.high_output ? bar.high_output : bar.low_output;

          return (
            <g
              key={bar.variable_name}
              onClick={() => onSelectBar(isSelected ? null : bar)}
              className="cursor-pointer"
              opacity={dimmed ? 0.3 : 1}
            >
              {/* Label */}
              <text
                x={padding.left - 8}
                y={y + barHeight / 2 + 4}
                textAnchor="end"
                className="fill-slate-700 dark:fill-slate-300"
                fontSize={11}
                fontWeight={isSelected ? 600 : 400}
              >
                {bar.variable_label}
              </text>

              {/* Red bar (downside — left of baseline) */}
              {worstX < baselineX && (
                <rect
                  x={worstX}
                  y={y}
                  width={baselineX - worstX}
                  height={barHeight}
                  fill="#ef4444"
                  opacity={0.8}
                  rx={3}
                />
              )}

              {/* Green bar (upside — right of baseline) */}
              {bestX > baselineX && (
                <rect
                  x={baselineX}
                  y={y}
                  width={bestX - baselineX}
                  height={barHeight}
                  fill="#22c55e"
                  opacity={0.8}
                  rx={3}
                />
              )}

              {/* Red side annotation (worst case) */}
              <text x={worstX - 4} y={y + barHeight / 2 + 4} textAnchor="end" fill="#fca5a5" fontSize={10}>
                {fmtOutput(worstOutput, data.metric_key)}
              </text>

              {/* Green side annotation (best case) */}
              <text x={bestX + 4} y={y + barHeight / 2 + 4} textAnchor="start" fill="#86efac" fontSize={10}>
                {fmtOutput(bestOutput, data.metric_key)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#ef4444", opacity: 0.8 }} />
          Downside
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#22c55e", opacity: 0.8 }} />
          Upside
        </span>
        <span className="text-slate-400 dark:text-slate-500">Click a bar for drill-down</span>
      </div>
    </div>
  );
}

// ── DrillDownChart ──────────────────────────────────────────────────
function DrillDownChart({
  bar,
  metricKey,
  metricLabel,
  onClose,
}: {
  bar: TornadoBar;
  metricKey: string;
  metricLabel: string;
  onClose: () => void;
}) {
  const sweep = bar.sweep;
  if (sweep.length === 0) return null;

  const width = 600;
  const height = 300;
  const padding = { top: 30, right: 30, bottom: 50, left: 70 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const inputs = sweep.map((s) => s.input_value);
  const outputs = sweep.map((s) => s.output_value);
  const minX = Math.min(...inputs);
  const maxX = Math.max(...inputs);
  const minY = Math.min(...outputs);
  const maxY = Math.max(...outputs);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  const toSvgX = (v: number) => padding.left + ((v - minX) / xRange) * plotWidth;
  const toSvgY = (v: number) => padding.top + plotHeight - ((v - minY) / yRange) * plotHeight;

  const points = sweep.map((s) => ({ x: toSvgX(s.input_value), y: toSvgY(s.output_value) }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Zero line if outputs cross zero
  const zeroY = maxY > 0 && minY < 0 ? toSvgY(0) : null;

  // Baseline input vertical line
  const baselineInputX = toSvgX(bar.baseline_input);

  // X-axis labels
  const labelCount = Math.min(sweep.length, 8);
  const labelInterval = Math.max(1, Math.ceil(sweep.length / labelCount));

  // Y-axis labels
  const yTicks = [minY, (minY + maxY) / 2, maxY];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {bar.variable_label} &rarr; {metricLabel}
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Zero line */}
        {zeroY !== null && (
          <line
            x1={padding.left}
            y1={zeroY}
            x2={width - padding.right}
            y2={zeroY}
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
        )}

        {/* Baseline input dashed vertical */}
        <line
          x1={baselineInputX}
          y1={padding.top}
          x2={baselineInputX}
          y2={height - padding.bottom}
          stroke="#a5b4fc"
          strokeDasharray="4 4"
          strokeWidth={1}
        />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={2} />

        {/* Dots */}
        {points.map((p, i) => {
          const isBaseline = sweep[i].input_value === bar.baseline_input;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={isBaseline ? 5 : 3}
              fill="#6366f1"
              stroke={isBaseline ? "#a5b4fc" : "none"}
              strokeWidth={isBaseline ? 2 : 0}
            />
          );
        })}

        {/* X-axis labels */}
        {sweep.map((s, i) => {
          if (i % labelInterval !== 0 && i !== sweep.length - 1) return null;
          return (
            <text
              key={i}
              x={points[i].x}
              y={height - padding.bottom + 18}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize={10}
            >
              {fmtInput(s.input_value, bar.variable_name)}
            </text>
          );
        })}

        {/* Y-axis labels */}
        {yTicks.map((val, i) => (
          <text
            key={i}
            x={padding.left - 8}
            y={toSvgY(val) + 4}
            textAnchor="end"
            className="fill-slate-500"
            fontSize={10}
          >
            {fmtOutput(val, metricKey)}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── SensitivityTab (main export) ────────────────────────────────────
export function SensitivityTab({
  propertyId,
  activeRentalType,
}: {
  propertyId: string;
  activeRentalType: "str" | "ltr";
}) {
  const [selectedMetric, setSelectedMetric] = useState("monthly_cashflow");
  const [tornadoData, setTornadoData] = useState<TornadoData | null>(null);
  const [selectedBar, setSelectedBar] = useState<TornadoBar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      setSelectedBar(null);

      try {
        const fetchFn = activeRentalType === "ltr" ? getLTRTornado : getTornado;
        const data = await fetchFn(propertyId, selectedMetric);
        if (!cancelled) {
          setTornadoData(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load sensitivity data");
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [propertyId, selectedMetric, activeRentalType]);

  return (
    <div className="space-y-6">
      {/* Metric pill selector */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 inline-flex gap-1">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setSelectedMetric(m.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              selectedMetric === m.key
                ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100 font-semibold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Loading / Error / Data */}
      {loading && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading sensitivity data...</div>
      )}
      {error && (
        <div className="text-center py-12 text-red-500 dark:text-red-400">{error}</div>
      )}
      {!loading && !error && tornadoData && (
        <>
          <TornadoChart data={tornadoData} selectedBar={selectedBar} onSelectBar={setSelectedBar} />
          {selectedBar && (
            <DrillDownChart
              bar={selectedBar}
              metricKey={tornadoData.metric_key}
              metricLabel={tornadoData.metric_label}
              onClose={() => setSelectedBar(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
