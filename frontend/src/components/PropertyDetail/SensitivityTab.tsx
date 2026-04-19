import { useState, useEffect } from "react";
import type { TornadoData, TornadoBar } from "../../types/index.ts";
import { getTornado, getLTRTornado } from "../../api/client.ts";
import { Segmented } from "../shared/Segmented.tsx";

// ── Metric options ──────────────────────────────────────────────────
const METRICS = [
  { value: "monthly_cashflow", label: "Monthly Cashflow" },
  { value: "cash_on_cash_return", label: "Cash-on-Cash" },
  { value: "cap_rate", label: "Cap Rate" },
] as const;

// ── Formatting helpers ──────────────────────────────────────────────
function isPctMetric(key: string) {
  return key === "cash_on_cash_return" || key === "cap_rate";
}

function fmtOutput(value: number, metricKey: string): string {
  if (isPctMetric(metricKey)) return `${value.toFixed(1)}%`;
  if (value < 0)
    return `-$${Math.abs(value).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })}`;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtInput(value: number, variableName: string): string {
  if (
    variableName.includes("pct") ||
    variableName.includes("rate") ||
    variableName.includes("vacancy") ||
    variableName.includes("appreciation") ||
    variableName.includes("growth") ||
    variableName.includes("management")
  ) {
    return `${value.toFixed(1)}%`;
  }
  if (variableName.includes("stay") || variableName.includes("length")) {
    return `${value.toFixed(1)} nights`;
  }
  if (
    variableName.includes("price") ||
    variableName.includes("rent") ||
    variableName.includes("cost") ||
    variableName.includes("fee") ||
    variableName.includes("revenue") ||
    variableName.includes("nightly") ||
    variableName.includes("monthly")
  ) {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return value.toFixed(1);
}

const MONO_FONT = "var(--font-mono)";
const SANS_FONT = "var(--font-sans)";

// Threshold above which we place the value text inside the bar.
const INSIDE_LABEL_MIN_BAR_WIDTH = 64;

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
  if (bars.length === 0)
    return (
      <div className="text-center py-8 text-ink-3 text-[13px]">
        No sensitivity data available.
      </div>
    );

  const barHeight = 26;
  const barGap = 10;
  const labelWidth = 180;
  const padding = { top: 48, right: 96, bottom: 48, left: labelWidth + 16 };
  const chartWidth = 780;
  const plotWidth = chartWidth - padding.left - padding.right;
  const chartHeight =
    padding.top + bars.length * (barHeight + barGap) + padding.bottom;

  // Determine output range across all bars
  const allOutputs = bars.flatMap((b) => [b.low_output, b.high_output]);
  const minOutput = Math.min(...allOutputs, data.baseline_value);
  const maxOutput = Math.max(...allOutputs, data.baseline_value);
  const outputRange = maxOutput - minOutput || 1;

  const xScale = (val: number) =>
    padding.left + ((val - minOutput) / outputRange) * plotWidth;
  const baselineX = xScale(data.baseline_value);

  return (
    <div className="border border-rule-strong rounded p-6">
      <div className="mb-5">
        <h3 className="font-serif text-[22px] leading-tight text-ink">
          {data.metric_label}
        </h3>
        <p className="text-[13px] text-ink-3 mt-1">
          <span className="caps">Baseline</span>{" "}
          <span className="font-mono tabular-nums text-ink ml-1">
            {fmtOutput(data.baseline_value, data.metric_key)}
          </span>
        </p>
      </div>

      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Baseline dashed line */}
        <line
          x1={baselineX}
          y1={padding.top - 12}
          x2={baselineX}
          y2={chartHeight - padding.bottom + 8}
          stroke="var(--rule-strong)"
          strokeDasharray="3 4"
          strokeWidth={1}
        />
        <text
          x={baselineX}
          y={padding.top - 18}
          textAnchor="middle"
          fill="var(--ink-3)"
          style={{ fontSize: 10, fontFamily: MONO_FONT }}
        >
          {fmtOutput(data.baseline_value, data.metric_key)}
        </text>

        {bars.map((bar, i) => {
          const y = padding.top + i * (barHeight + barGap);
          const lowX = xScale(bar.low_output);
          const highX = xScale(bar.high_output);
          const isSelected = selectedBar?.variable_name === bar.variable_name;
          const dimmed = selectedBar !== null && !isSelected;

          // For inverse variables (e.g., fees), high input → lower output.
          const worstX = Math.min(lowX, highX);
          const bestX = Math.max(lowX, highX);
          const worstOutput =
            bar.low_output < bar.high_output
              ? bar.low_output
              : bar.high_output;
          const bestOutput =
            bar.low_output < bar.high_output
              ? bar.high_output
              : bar.low_output;

          const downsideWidth = Math.max(0, baselineX - worstX);
          const upsideWidth = Math.max(0, bestX - baselineX);
          const downsideInside = downsideWidth >= INSIDE_LABEL_MIN_BAR_WIDTH;
          const upsideInside = upsideWidth >= INSIDE_LABEL_MIN_BAR_WIDTH;

          const worstLabel = fmtOutput(worstOutput, data.metric_key);
          const bestLabel = fmtOutput(bestOutput, data.metric_key);

          return (
            <g
              key={bar.variable_name}
              onClick={() => onSelectBar(isSelected ? null : bar)}
              className="cursor-pointer"
              opacity={dimmed ? 0.35 : 1}
            >
              {/* Row label */}
              <text
                x={padding.left - 12}
                y={y + barHeight / 2 + 4}
                textAnchor="end"
                fill="var(--ink-2)"
                style={{
                  fontSize: 12,
                  fontFamily: SANS_FONT,
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {bar.variable_label}
              </text>

              {/* Downside bar */}
              {downsideWidth > 0 && (
                <rect
                  x={worstX}
                  y={y}
                  width={downsideWidth}
                  height={barHeight}
                  fill="var(--negative)"
                  opacity={0.92}
                  rx={2}
                />
              )}

              {/* Upside bar */}
              {upsideWidth > 0 && (
                <rect
                  x={baselineX}
                  y={y}
                  width={upsideWidth}
                  height={barHeight}
                  fill="var(--accent)"
                  opacity={0.92}
                  rx={2}
                />
              )}

              {/* Downside value — inside bar if wide enough, else outside left */}
              {downsideWidth > 0 && (
                <text
                  x={
                    downsideInside
                      ? worstX + downsideWidth / 2
                      : worstX - 6
                  }
                  y={y + barHeight / 2 + 4}
                  textAnchor={downsideInside ? "middle" : "end"}
                  fill={
                    downsideInside ? "var(--canvas)" : "var(--ink)"
                  }
                  style={{
                    fontSize: 11,
                    fontFamily: MONO_FONT,
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 500,
                  }}
                >
                  {worstLabel}
                </text>
              )}

              {/* Upside value — inside bar if wide enough, else outside right */}
              {upsideWidth > 0 && (
                <text
                  x={
                    upsideInside
                      ? baselineX + upsideWidth / 2
                      : bestX + 6
                  }
                  y={y + barHeight / 2 + 4}
                  textAnchor={upsideInside ? "middle" : "start"}
                  fill={upsideInside ? "var(--canvas)" : "var(--ink)"}
                  style={{
                    fontSize: 11,
                    fontFamily: MONO_FONT,
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 500,
                  }}
                >
                  {bestLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-5 text-[11px]">
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block w-3 h-2 rounded-sm bg-negative"
            aria-hidden
          />
          <span className="caps text-ink-3">Downside</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block w-3 h-2 rounded-sm bg-accent"
            aria-hidden
          />
          <span className="caps text-ink-3">Upside</span>
        </span>
        <span className="caps text-ink-3">Click a bar for drill-down</span>
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

  const width = 640;
  const height = 300;
  const padding = { top: 28, right: 32, bottom: 52, left: 72 };
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
  const toSvgY = (v: number) =>
    padding.top + plotHeight - ((v - minY) / yRange) * plotHeight;

  const points = sweep.map((s) => ({
    x: toSvgX(s.input_value),
    y: toSvgY(s.output_value),
  }));
  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const zeroY = maxY > 0 && minY < 0 ? toSvgY(0) : null;
  const baselineInputX = toSvgX(bar.baseline_input);

  const labelCount = Math.min(sweep.length, 8);
  const labelInterval = Math.max(1, Math.ceil(sweep.length / labelCount));

  const yTicks = [minY, (minY + maxY) / 2, maxY];

  return (
    <div className="border border-rule-strong rounded p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-[20px] leading-tight text-ink">
          {bar.variable_label} → {metricLabel}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-3 hover:text-ink transition-colors"
          aria-label="Close drill-down"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {zeroY !== null && (
          <line
            x1={padding.left}
            y1={zeroY}
            x2={width - padding.right}
            y2={zeroY}
            stroke="var(--rule-strong)"
            strokeDasharray="3 4"
            strokeWidth={1}
          />
        )}

        <line
          x1={baselineInputX}
          y1={padding.top}
          x2={baselineInputX}
          y2={height - padding.bottom}
          stroke="var(--rule-strong)"
          strokeDasharray="3 4"
          strokeWidth={1}
        />

        <path
          d={pathD}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.75}
          strokeLinejoin="round"
        />

        {points.map((p, i) => {
          const isBaseline = sweep[i].input_value === bar.baseline_input;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={isBaseline ? 4.5 : 2.5}
              fill="var(--accent)"
              stroke={isBaseline ? "var(--canvas)" : "none"}
              strokeWidth={isBaseline ? 2 : 0}
            />
          );
        })}

        {sweep.map((s, i) => {
          if (i % labelInterval !== 0 && i !== sweep.length - 1) return null;
          return (
            <text
              key={i}
              x={points[i].x}
              y={height - padding.bottom + 18}
              textAnchor="middle"
              fill="var(--ink-3)"
              style={{ fontSize: 10, fontFamily: MONO_FONT }}
            >
              {fmtInput(s.input_value, bar.variable_name)}
            </text>
          );
        })}

        {yTicks.map((val, i) => (
          <text
            key={i}
            x={padding.left - 8}
            y={toSvgY(val) + 4}
            textAnchor="end"
            fill="var(--ink-3)"
            style={{ fontSize: 10, fontFamily: MONO_FONT }}
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
  const [selectedMetric, setSelectedMetric] =
    useState<(typeof METRICS)[number]["value"]>("monthly_cashflow");
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
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load sensitivity data"
          );
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
      <div className="flex items-center gap-3">
        <span className="caps text-ink-3">Metric</span>
        <Segmented
          options={METRICS.map((m) => ({ value: m.value, label: m.label }))}
          value={selectedMetric}
          onChange={(v) =>
            setSelectedMetric(v as (typeof METRICS)[number]["value"])
          }
          ariaLabel="Sensitivity metric"
        />
      </div>

      {loading && (
        <div className="text-center py-12 text-ink-3 text-[14px]">
          Loading sensitivity data…
        </div>
      )}
      {error && (
        <div className="text-center py-12 text-negative text-[14px]">
          {error}
        </div>
      )}
      {!loading && !error && tornadoData && (
        <>
          <TornadoChart
            data={tornadoData}
            selectedBar={selectedBar}
            onSelectBar={setSelectedBar}
          />
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
