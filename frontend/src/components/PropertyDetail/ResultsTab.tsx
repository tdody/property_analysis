import { useState, useEffect, useCallback } from "react";
import type { MortgageScenario, ComputedResults, SensitivityData, AmortizationEntry } from "../../types/index.ts";
import { getResults, getResultsForScenario, getSensitivity, getAmortization } from "../../api/client.ts";
import { MetricCard } from "../shared/MetricCard.tsx";

interface ResultsTabProps {
  propertyId: string;
  scenarios: MortgageScenario[];
}

function fmt(value: number, decimals = 0): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = `$${fmt(abs)}`;
  return value < 0 ? `-${formatted}` : formatted;
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function cashflowVariant(value: number): "positive" | "negative" | "neutral" {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

const METRIC_TOOLTIPS: Record<string, string> = {
  monthly_cashflow:
    "Net monthly income after all expenses, debt service, taxes, and reserves. Positive = the property pays you. Target: > $200/mo for a viable STR.",
  annual_cashflow: "Monthly cashflow x 12. Your annual profit from the property after all costs.",
  cash_on_cash_return:
    "Annual cashflow / total cash invested. Measures return on actual cash you put in. A good STR target is 8-12%.",
  cap_rate:
    "NOI / purchase price. A financing-independent measure of property value. Good STR cap rates: 6-10%.",
  noi: "Gross revenue minus all operating expenses, before debt service. Used to calculate cap rate and DSCR.",
  break_even_occupancy:
    "Minimum occupancy % needed to cover all costs. A good STR should break even at 40-55%. Above 65% means thin margins.",
  dscr: "NOI / annual debt service. > 1.0 means income covers debt. Lenders typically want >= 1.25 for DSCR loans.",
  gross_yield:
    "Gross annual revenue / purchase price. Quick screening metric. Good STR gross yields: 12-20%.",
  total_roi_year1:
    "(Annual cashflow + first-year equity buildup) / total cash invested. More complete than CoC because it includes principal paydown.",
};

export function ResultsTab({ propertyId, scenarios }: ResultsTabProps) {
  const [results, setResults] = useState<ComputedResults | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityData | null>(null);
  const [amortization, setAmortization] = useState<AmortizationEntry[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAmortization, setShowAmortization] = useState(false);

  const activeScenario = scenarios.find((s) => s.is_active);

  useEffect(() => {
    if (activeScenario && !selectedScenarioId) {
      setSelectedScenarioId(activeScenario.id);
    }
  }, [activeScenario, selectedScenarioId]);

  const fetchResults = useCallback(async () => {
    if (!selectedScenarioId) return;
    try {
      setLoading(true);
      setError(null);
      const [resultData, sensitivityData, amortData] = await Promise.all([
        selectedScenarioId
          ? getResultsForScenario(propertyId, selectedScenarioId)
          : getResults(propertyId),
        getSensitivity(propertyId),
        getAmortization(propertyId, selectedScenarioId),
      ]);
      setResults(resultData);
      setSensitivity(sensitivityData);
      setAmortization(amortData.slice(0, 60)); // First 5 years
    } catch {
      setError("Failed to load results. Make sure you have at least one scenario and revenue/expense assumptions configured.");
    } finally {
      setLoading(false);
    }
  }, [propertyId, selectedScenarioId]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  if (scenarios.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-lg mb-2">No scenarios configured</p>
        <p className="text-sm">Add a financing scenario in the Financing tab to see results.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading results...</div>;
  }

  if (error || !results) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error || "No results available"}</p>
        <button
          onClick={() => void fetchResults()}
          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-md shadow-indigo-200 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600"
        >
          Retry
        </button>
      </div>
    );
  }

  const m = results.metrics;

  return (
    <div className="space-y-8">
      {/* Scenario selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700">Scenario:</label>
        <select
          value={selectedScenarioId}
          onChange={(e) => setSelectedScenarioId(e.target.value)}
          className="px-3 py-2 bg-slate-100 border-0 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {s.is_active ? "(Active)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Monthly Cashflow"
          value={`${fmtCurrency(m.monthly_cashflow)}/mo`}
          variant={cashflowVariant(m.monthly_cashflow)}
          large
          tooltip={METRIC_TOOLTIPS.monthly_cashflow}
        />
        <MetricCard
          label="Annual Cashflow"
          value={fmtCurrency(m.annual_cashflow)}
          variant={cashflowVariant(m.annual_cashflow)}
          tooltip={METRIC_TOOLTIPS.annual_cashflow}
        />
        <MetricCard
          label="Cash-on-Cash Return"
          value={fmtPct(m.cash_on_cash_return)}
          variant={cashflowVariant(m.cash_on_cash_return)}
          tooltip={METRIC_TOOLTIPS.cash_on_cash_return}
        />
        <MetricCard
          label="Cap Rate"
          value={fmtPct(m.cap_rate)}
          variant={m.cap_rate >= 6 ? "positive" : m.cap_rate >= 4 ? "neutral" : "negative"}
          tooltip={METRIC_TOOLTIPS.cap_rate}
        />
        <MetricCard
          label="NOI"
          value={fmtCurrency(m.noi)}
          variant={cashflowVariant(m.noi)}
          tooltip={METRIC_TOOLTIPS.noi}
        />
        <MetricCard
          label="Break-Even Occupancy"
          value={fmtPct(m.break_even_occupancy)}
          variant={m.break_even_occupancy <= 55 ? "positive" : m.break_even_occupancy <= 70 ? "neutral" : "negative"}
          tooltip={METRIC_TOOLTIPS.break_even_occupancy}
        />
        <MetricCard
          label="DSCR"
          value={m.dscr.toFixed(2)}
          variant={m.dscr >= 1.25 ? "positive" : m.dscr >= 1.0 ? "neutral" : "negative"}
          tooltip={METRIC_TOOLTIPS.dscr}
        />
        <MetricCard
          label="Gross Yield"
          value={fmtPct(m.gross_yield)}
          variant={m.gross_yield >= 12 ? "positive" : m.gross_yield >= 8 ? "neutral" : "negative"}
          tooltip={METRIC_TOOLTIPS.gross_yield}
        />
        <MetricCard
          label="Year-1 Total ROI"
          value={fmtPct(m.total_roi_year1)}
          variant={cashflowVariant(m.total_roi_year1)}
          tooltip={METRIC_TOOLTIPS.total_roi_year1}
        />
      </div>

      {/* Revenue Waterfall */}
      <section>
        <h3 className="text-base font-semibold text-slate-900 mb-4">Revenue Breakdown</h3>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-3 text-slate-700">Gross Annual Revenue</td>
                <td className="px-4 py-3 text-right font-semibold">{fmtCurrency(results.revenue.gross_annual)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-slate-500 pl-8">Less: Platform Fees</td>
                <td className="px-4 py-3 text-right text-red-500">
                  -{fmtCurrency(results.revenue.gross_annual - results.revenue.net_annual)}
                </td>
              </tr>
              <tr className="bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">Net Annual Revenue</td>
                <td className="px-4 py-3 text-right font-semibold">{fmtCurrency(results.revenue.net_annual)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-slate-500">Annual Turnovers</td>
                <td className="px-4 py-3 text-right">{results.revenue.annual_turnovers}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Expense Breakdown */}
      <section>
        <h3 className="text-base font-semibold text-slate-900 mb-4">Expense Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Operating expenses */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Operating Expenses</div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {Object.entries(results.expenses.breakdown).map(([key, val]) => (
                  <tr key={key}>
                    <td className="px-4 py-2 text-slate-600 capitalize">{key.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-right">{fmtCurrency(val)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-3">Total Operating</td>
                  <td className="px-4 py-3 text-right">{fmtCurrency(results.expenses.total_annual_operating)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Housing costs */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Housing Costs (Monthly)</div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-2 text-slate-600">Principal & Interest</td>
                  <td className="px-4 py-2 text-right">{fmtCurrency(results.mortgage.monthly_pi)}</td>
                </tr>
                {results.mortgage.monthly_pmi > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-slate-600">PMI</td>
                    <td className="px-4 py-2 text-right">{fmtCurrency(results.mortgage.monthly_pmi)}</td>
                  </tr>
                )}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-3">Total Monthly Housing</td>
                  <td className="px-4 py-3 text-right">{fmtCurrency(results.mortgage.total_monthly_housing)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-slate-600">Total Cash Invested</td>
                  <td className="px-4 py-2 text-right font-semibold">{fmtCurrency(results.mortgage.total_cash_invested)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Sensitivity Analysis */}
      {sensitivity && (
        <section>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Sensitivity Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Occupancy sweep */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                Occupancy % vs Monthly Cashflow
              </div>
              <div className="p-4">
                <SensitivityChart
                  data={sensitivity.occupancy_sweep.map((d) => ({
                    label: `${d.occupancy_pct}%`,
                    value: d.monthly_cashflow,
                  }))}
                />
              </div>
            </div>

            {/* Rate sweep */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                Nightly Rate vs Monthly Cashflow
              </div>
              <div className="p-4">
                <SensitivityChart
                  data={sensitivity.rate_sweep.map((d) => ({
                    label: `$${d.nightly_rate}`,
                    value: d.monthly_cashflow,
                  }))}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Amortization Table */}
      {amortization.length > 0 && (
        <section>
          <button
            onClick={() => setShowAmortization(!showAmortization)}
            className="flex items-center gap-2 text-base font-semibold text-slate-900 mb-4 w-full text-left"
          >
            <span>{showAmortization ? "\u25BC" : "\u25B6"}</span>
            Amortization Schedule (First 5 Years)
          </button>
          {showAmortization && (
            <div className="bg-white rounded-2xl shadow-sm overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-slate-600">Month</th>
                    <th className="px-4 py-3 text-right text-slate-600">Principal</th>
                    <th className="px-4 py-3 text-right text-slate-600">Interest</th>
                    <th className="px-4 py-3 text-right text-slate-600">Remaining Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {amortization.map((entry) => (
                    <tr key={entry.month}>
                      <td className="px-4 py-2">{entry.month}</td>
                      <td className="px-4 py-2 text-right">{fmtCurrency(entry.principal)}</td>
                      <td className="px-4 py-2 text-right">{fmtCurrency(entry.interest)}</td>
                      <td className="px-4 py-2 text-right">{fmtCurrency(entry.remaining_balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// Simple SVG line chart for sensitivity analysis
function SensitivityChart({ data }: { data: Array<{ label: string; value: number }> }) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const width = 400;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const xStep = plotWidth / (data.length - 1 || 1);

  const points = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + plotHeight - ((d.value - minVal) / range) * plotHeight,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Zero line
  const zeroY = maxVal > 0 && minVal < 0
    ? padding.top + plotHeight - ((0 - minVal) / range) * plotHeight
    : null;

  // Show every N labels to prevent crowding
  const labelInterval = Math.ceil(data.length / 8);

  return (
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

      {/* Line */}
      <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={2} />

      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#6366f1" />
      ))}

      {/* X labels */}
      {data.map((d, i) => {
        if (i % labelInterval !== 0 && i !== data.length - 1) return null;
        return (
          <text
            key={i}
            x={points[i].x}
            y={height - 5}
            textAnchor="middle"
            className="text-xs fill-slate-500"
            fontSize={10}
          >
            {d.label}
          </text>
        );
      })}

      {/* Y labels */}
      {[minVal, (minVal + maxVal) / 2, maxVal].map((val, i) => {
        const y = padding.top + plotHeight - ((val - minVal) / range) * plotHeight;
        return (
          <text
            key={i}
            x={padding.left - 5}
            y={y + 4}
            textAnchor="end"
            className="text-xs fill-slate-500"
            fontSize={10}
          >
            ${Math.round(val).toLocaleString()}
          </text>
        );
      })}
    </svg>
  );
}
