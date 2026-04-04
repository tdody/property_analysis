import { useState, useEffect, useCallback } from "react";
import type { MortgageScenario, ComputedResults, LTRComputedResults, SensitivityData, LTRSensitivityData, AmortizationEntry, ProjectionYear, MonthlyDetail } from "../../types/index.ts";
import { getResults, getResultsForScenario, getSensitivity, getLTRResults, getLTRSensitivity, getAmortization, getProjections, getMonthlyBreakdown } from "../../api/client.ts";
import { MetricCard } from "../shared/MetricCard.tsx";

interface ResultsTabProps {
  propertyId: string;
  scenarios: MortgageScenario[];
  activeRentalType: 'str' | 'ltr';
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
  total_roi_year1_with_appreciation:
    "(Annual cashflow + equity buildup + property appreciation) / total cash invested. Optimistic ROI that includes unrealized gains from property value increase.",
};

export function ResultsTab({ propertyId, scenarios, activeRentalType }: ResultsTabProps) {
  const [results, setResults] = useState<ComputedResults | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityData | null>(null);
  const [amortization, setAmortization] = useState<AmortizationEntry[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAmortization, setShowAmortization] = useState(false);
  const [showTaxAnalysis, setShowTaxAnalysis] = useState(false);
  const [showProjections, setShowProjections] = useState(false);
  const [projections, setProjections] = useState<ProjectionYear[]>([]);
  const [projectionsLoading, setProjectionsLoading] = useState(false);
  const [projectionIrr, setProjectionIrr] = useState<number | null>(null);
  const [projectionEqMultiple, setProjectionEqMultiple] = useState(0);
  const [showMonthly, setShowMonthly] = useState(false);
  const [monthlyData, setMonthlyData] = useState<MonthlyDetail[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyIsSeasonal, setMonthlyIsSeasonal] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [ltrResults, setLtrResults] = useState<LTRComputedResults | null>(null);
  const [ltrSensitivity, setLtrSensitivity] = useState<LTRSensitivityData | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

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
    setProjections([]);
    setShowProjections(false);
    setMonthlyData([]);
    setShowMonthly(false);
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
        {m.tax_liability !== 0 && (
          <MetricCard
            label="After-Tax Cashflow"
            value={`${fmtCurrency(m.after_tax_monthly_cashflow)}/mo`}
            variant={cashflowVariant(m.after_tax_monthly_cashflow)}
            tooltip="Monthly cashflow after estimated income taxes, accounting for depreciation and mortgage interest deductions."
          />
        )}
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
        {m.appreciation_year1 > 0 && (
          <MetricCard
            label="Year-1 ROI (w/ Appreciation)"
            value={fmtPct(m.total_roi_year1_with_appreciation)}
            variant={cashflowVariant(m.total_roi_year1_with_appreciation)}
            tooltip={METRIC_TOOLTIPS.total_roi_year1_with_appreciation}
          />
        )}
      </div>

      {/* DSCR Warning */}
      {m.dscr_warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-amber-500 text-lg mt-0.5">&#9888;</span>
          <div>
            <p className="text-sm font-medium text-amber-800">DSCR Lender Warning</p>
            <p className="text-sm text-amber-700">{m.dscr_warning}</p>
          </div>
        </div>
      )}

      {/* Occupancy/Rate Warning */}
      {m.occupancy_rate_warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-amber-500 text-lg mt-0.5">&#9888;</span>
          <div>
            <p className="text-sm font-medium text-amber-800">Optimistic Assumptions</p>
            <p className="text-sm text-amber-700">{m.occupancy_rate_warning}</p>
          </div>
        </div>
      )}

      {/* Rental Delay Notice */}
      {results.rental_delay_months > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-blue-500 text-lg mt-0.5">&#128197;</span>
          <div>
            <p className="text-sm font-medium text-blue-800">
              Year-1 Adjusted ({results.rental_delay_months}-month rental delay)
            </p>
            <p className="text-sm text-blue-700">
              Metrics reflect {12 - results.rental_delay_months} months of rental income with 12 months of carrying costs.
              Carrying costs during the delay period are added to total cash invested.
            </p>
          </div>
        </div>
      )}

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
              {m.guest_cost_per_night > 0 && (
                <tr>
                  <td className="px-4 py-3 text-slate-500">
                    Guest Cost per Night
                    <span className="ml-2 text-xs text-slate-400">(rate + cleaning fee / stay length)</span>
                  </td>
                  <td className="px-4 py-3 text-right">{fmtCurrency(m.guest_cost_per_night)}</td>
                </tr>
              )}
              {results.tax_impact && (
                <>
                  <tr className="bg-amber-50/50">
                    <td className="px-4 py-3 text-slate-700">
                      Guest-Facing Tax Rate
                      {results.tax_impact.platform_remits && (
                        <span className="ml-2 text-xs text-slate-400">(platform remits)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{fmtPct(results.tax_impact.guest_facing_tax_pct)}</td>
                  </tr>
                  <tr className="bg-amber-50/50">
                    <td className="px-4 py-3 text-slate-500 pl-8">Effective Nightly Rate (with tax)</td>
                    <td className="px-4 py-3 text-right">{fmtCurrency(results.tax_impact.effective_nightly_rate_with_tax)}</td>
                  </tr>
                </>
              )}
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
                {results.mortgage.origination_fee > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-slate-600">Origination Fee</td>
                    <td className="px-4 py-2 text-right">{fmtCurrency(results.mortgage.origination_fee)}</td>
                  </tr>
                )}
                <tr>
                  <td className="px-4 py-2 text-slate-600">Total Cash Invested</td>
                  <td className="px-4 py-2 text-right font-semibold">{fmtCurrency(results.mortgage.total_cash_invested)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Tax Analysis */}
      {m.tax_liability !== 0 && (
        <section>
          <button
            onClick={() => setShowTaxAnalysis(!showTaxAnalysis)}
            className="flex items-center gap-2 text-base font-semibold text-slate-900 mb-4 w-full text-left"
          >
            <span>{showTaxAnalysis ? "\u25BC" : "\u25B6"}</span>
            Tax Analysis
          </button>
          {showTaxAnalysis && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-2 text-slate-700">Net Operating Income (NOI)</td>
                    <td className="px-4 py-2 text-right">{fmtCurrency(m.noi)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-slate-500 pl-8">Less: Mortgage Interest (Year 1)</td>
                    <td className="px-4 py-2 text-right text-red-500">
                      -{fmtCurrency(m.noi - m.taxable_income - (results.depreciation?.total_depreciation_annual ?? 0))}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-slate-500 pl-8">Less: Depreciation</td>
                    <td className="px-4 py-2 text-right text-red-500">
                      -{fmtCurrency(results.depreciation?.total_depreciation_annual ?? 0)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">Taxable Income</td>
                    <td className={`px-4 py-3 text-right font-semibold ${m.taxable_income >= 0 ? "" : "text-emerald-600"}`}>
                      {fmtCurrency(m.taxable_income)}
                      {m.taxable_income < 0 && <span className="text-xs ml-1">(paper loss)</span>}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-slate-700">
                      {m.tax_liability >= 0 ? "Tax Liability" : "Tax Savings"}
                    </td>
                    <td className={`px-4 py-2 text-right font-medium ${m.tax_liability >= 0 ? "text-red-500" : "text-emerald-600"}`}>
                      {m.tax_liability >= 0 ? `-${fmtCurrency(m.tax_liability)}` : `+${fmtCurrency(Math.abs(m.tax_liability))}`}
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">After-Tax Annual Cashflow</td>
                    <td className={`px-4 py-3 text-right font-semibold ${m.after_tax_annual_cashflow >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {fmtCurrency(m.after_tax_annual_cashflow)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tax Deductions (Depreciation) */}
      {results.depreciation && results.depreciation.total_depreciation_annual > 0 && (
        <section>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Tax Deductions (Non-Cash)</h3>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-2 text-slate-600">Building Value (Depreciable)</td>
                  <td className="px-4 py-2 text-right">{fmtCurrency(results.depreciation.building_value)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-slate-600">Building Depreciation (27.5 yr)</td>
                  <td className="px-4 py-2 text-right">{fmtCurrency(results.depreciation.building_depreciation_annual)}/yr</td>
                </tr>
                {results.depreciation.furniture_depreciation_annual > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-slate-600">Furniture Depreciation (7 yr)</td>
                    <td className="px-4 py-2 text-right">{fmtCurrency(results.depreciation.furniture_depreciation_annual)}/yr</td>
                  </tr>
                )}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-3">Total Annual Depreciation</td>
                  <td className="px-4 py-3 text-right">{fmtCurrency(results.depreciation.total_depreciation_annual)}/yr</td>
                </tr>
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
              Depreciation is a non-cash tax deduction. It reduces taxable income but does not affect NOI, cashflow, or DSCR.
            </div>
          </div>
        </section>
      )}

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

      {/* Monthly Cashflow */}
      <section>
        <button
          onClick={() => {
            const next = !showMonthly;
            setShowMonthly(next);
            if (next && monthlyData.length === 0 && selectedScenarioId) {
              setMonthlyLoading(true);
              getMonthlyBreakdown(propertyId, selectedScenarioId)
                .then((data) => {
                  setMonthlyData(data.months);
                  setMonthlyIsSeasonal(data.use_seasonal);
                })
                .catch(() => setMonthlyData([]))
                .finally(() => setMonthlyLoading(false));
            }
          }}
          className="flex items-center gap-2 text-base font-semibold text-slate-900 mb-4 w-full text-left"
        >
          <span>{showMonthly ? "\u25BC" : "\u25B6"}</span>
          Monthly Cashflow
        </button>
        {showMonthly && (
          monthlyLoading ? (
            <div className="text-center py-6 text-slate-500">Loading monthly data...</div>
          ) : monthlyData.length > 0 ? (
            <div className="space-y-4">
              {/* Bar chart */}
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <MonthlyCashflowChart data={monthlyData} />
              </div>
              {/* Table */}
              <div className="bg-white rounded-2xl shadow-sm overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-3 text-left text-slate-600">Month</th>
                      {monthlyIsSeasonal && <th className="px-3 py-3 text-left text-slate-600">Season</th>}
                      <th className="px-3 py-3 text-right text-slate-600">Revenue</th>
                      <th className="px-3 py-3 text-right text-slate-600">Expenses</th>
                      <th className="px-3 py-3 text-right text-slate-600">NOI</th>
                      <th className="px-3 py-3 text-right text-slate-600">Cashflow</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlyData.map((m) => (
                      <tr key={m.month}>
                        <td className="px-3 py-2 font-medium">{m.month}</td>
                        {monthlyIsSeasonal && (
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${m.is_peak ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                              {m.is_peak ? "Peak" : "Off-Peak"}
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-2 text-right">{fmtCurrency(m.gross_revenue)}</td>
                        <td className="px-3 py-2 text-right">{fmtCurrency(m.total_expenses)}</td>
                        <td className="px-3 py-2 text-right">{fmtCurrency(m.noi)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${m.cashflow >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {fmtCurrency(m.cashflow)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500">No monthly data available.</div>
          )
        )}
      </section>

      {/* 5-Year Projections */}
      <section>
        <button
          onClick={() => {
            const next = !showProjections;
            setShowProjections(next);
            if (next && projections.length === 0 && selectedScenarioId) {
              setProjectionsLoading(true);
              getProjections(propertyId, selectedScenarioId)
                .then((data) => {
                  setProjections(data.years);
                  setProjectionIrr(data.irr);
                  setProjectionEqMultiple(data.equity_multiple);
                })
                .catch(() => setProjections([]))
                .finally(() => setProjectionsLoading(false));
            }
          }}
          className="flex items-center gap-2 text-base font-semibold text-slate-900 mb-4 w-full text-left"
        >
          <span>{showProjections ? "\u25BC" : "\u25B6"}</span>
          5-Year Projections
        </button>
        {showProjections && (
          projectionsLoading ? (
            <div className="text-center py-6 text-slate-500">Loading projections...</div>
          ) : projections.length > 0 ? (
            <div className="space-y-4">
              {/* IRR & Equity Multiple summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {projectionIrr !== null && (
                  <div className="bg-white rounded-xl shadow-sm p-3 text-center">
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-medium">5-Year IRR</div>
                    <div className={`text-lg font-bold ${projectionIrr >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {projectionIrr.toFixed(1)}%
                    </div>
                  </div>
                )}
                <div className="bg-white rounded-xl shadow-sm p-3 text-center">
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-medium">Equity Multiple</div>
                  <div className={`text-lg font-bold ${projectionEqMultiple >= 1 ? "text-emerald-600" : projectionEqMultiple >= 0 ? "text-slate-900" : "text-red-500"}`}>
                    {projectionEqMultiple.toFixed(2)}x
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-3 text-left text-slate-600">Year</th>
                    <th className="px-3 py-3 text-right text-slate-600">Gross Revenue</th>
                    <th className="px-3 py-3 text-right text-slate-600">NOI</th>
                    <th className="px-3 py-3 text-right text-slate-600">Cashflow</th>
                    <th className="px-3 py-3 text-right text-slate-600">Cumulative CF</th>
                    <th className="px-3 py-3 text-right text-slate-600">CoC Return</th>
                    <th className="px-3 py-3 text-right text-slate-600">Property Value</th>
                    <th className="px-3 py-3 text-right text-slate-600">Loan Balance</th>
                    <th className="px-3 py-3 text-right text-slate-600">Equity</th>
                    {m.tax_liability !== 0 && <th className="px-3 py-3 text-right text-slate-600">After-Tax CF</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projections.map((y) => (
                    <tr key={y.year}>
                      <td className="px-3 py-2 font-medium">{y.year}</td>
                      <td className="px-3 py-2 text-right">{fmtCurrency(y.gross_revenue)}</td>
                      <td className="px-3 py-2 text-right">{fmtCurrency(y.noi)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${y.annual_cashflow >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {fmtCurrency(y.annual_cashflow)}
                      </td>
                      <td className={`px-3 py-2 text-right ${y.cumulative_cashflow >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {fmtCurrency(y.cumulative_cashflow)}
                      </td>
                      <td className="px-3 py-2 text-right">{fmtPct(y.cash_on_cash_return)}</td>
                      <td className="px-3 py-2 text-right">{fmtCurrency(y.property_value)}</td>
                      <td className="px-3 py-2 text-right">{fmtCurrency(y.loan_balance)}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmtCurrency(y.equity)}</td>
                      {m.tax_liability !== 0 && (
                        <td className={`px-3 py-2 text-right font-medium ${y.after_tax_cashflow >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {fmtCurrency(y.after_tax_cashflow)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500">No projection data available.</div>
          )
        )}
      </section>

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

      {/* STR vs LTR Comparison */}
      <section>
        <button
          onClick={() => {
            const next = !showComparison;
            setShowComparison(next);
            if (next && !ltrResults) {
              setComparisonLoading(true);
              Promise.all([
                getLTRResults(propertyId),
                getLTRSensitivity(propertyId),
              ])
                .then(([ltrRes, ltrSens]) => {
                  setLtrResults(ltrRes);
                  setLtrSensitivity(ltrSens);
                })
                .catch(() => {
                  setLtrResults(null);
                  setLtrSensitivity(null);
                })
                .finally(() => setComparisonLoading(false));
            }
          }}
          className="flex items-center gap-2 text-base font-semibold text-slate-900 mb-4 w-full text-left"
        >
          <span>{showComparison ? "\u25BC" : "\u25B6"}</span>
          Compare STR vs LTR
        </button>
        {showComparison && (
          comparisonLoading ? (
            <div className="text-center py-6 text-slate-500">Loading LTR results...</div>
          ) : ltrResults ? (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-slate-600">Metric</th>
                      <th className="px-4 py-3 text-right text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                          STR
                        </span>
                      </th>
                      <th className="px-4 py-3 text-right text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
                          LTR
                        </span>
                      </th>
                      <th className="px-4 py-3 text-right text-slate-600">Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { label: "Monthly Cashflow", strVal: m.monthly_cashflow, ltrVal: ltrResults.metrics.monthly_cashflow, fmt: fmtCurrency },
                      { label: "Annual Cashflow", strVal: m.annual_cashflow, ltrVal: ltrResults.metrics.annual_cashflow, fmt: fmtCurrency },
                      { label: "Cash-on-Cash Return", strVal: m.cash_on_cash_return, ltrVal: ltrResults.metrics.cash_on_cash_return, fmt: fmtPct },
                      { label: "Cap Rate", strVal: m.cap_rate, ltrVal: ltrResults.metrics.cap_rate, fmt: fmtPct },
                      { label: "NOI", strVal: m.noi, ltrVal: ltrResults.metrics.noi, fmt: fmtCurrency },
                      { label: "DSCR", strVal: m.dscr, ltrVal: ltrResults.metrics.dscr, fmt: (v: number) => v.toFixed(2) },
                      { label: "Gross Yield", strVal: m.gross_yield, ltrVal: ltrResults.metrics.gross_yield, fmt: fmtPct },
                      { label: "Year-1 Total ROI", strVal: m.total_roi_year1, ltrVal: ltrResults.metrics.total_roi_year1, fmt: fmtPct },
                    ].map(({ label, strVal, ltrVal, fmt }) => {
                      const diff = ltrVal - strVal;
                      const winner = diff > 0.01 ? "ltr" : diff < -0.01 ? "str" : "tie";
                      return (
                        <tr key={label}>
                          <td className="px-4 py-2 text-slate-700 font-medium">{label}</td>
                          <td className={`px-4 py-2 text-right ${winner === "str" ? "font-semibold text-sky-700" : ""}`}>
                            {fmt(strVal)}
                          </td>
                          <td className={`px-4 py-2 text-right ${winner === "ltr" ? "font-semibold text-violet-700" : ""}`}>
                            {fmt(ltrVal)}
                          </td>
                          <td className={`px-4 py-2 text-right text-sm ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-500" : "text-slate-400"}`}>
                            {diff > 0 ? "+" : ""}{fmt(diff)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* LTR Sensitivity */}
              {ltrSensitivity && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">LTR Sensitivity Analysis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                        Vacancy % vs Monthly Cashflow
                      </div>
                      <div className="p-4">
                        <SensitivityChart
                          data={ltrSensitivity.vacancy_sweep.map((d) => ({
                            label: `${d.vacancy_pct}%`,
                            value: d.monthly_cashflow,
                          }))}
                        />
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                        Monthly Rent vs Monthly Cashflow
                      </div>
                      <div className="p-4">
                        <SensitivityChart
                          data={ltrSensitivity.rent_sweep.map((d) => ({
                            label: `$${d.monthly_rent}`,
                            value: d.monthly_cashflow,
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500">
              Failed to load LTR results. Make sure you have at least one active scenario configured.
            </div>
          )
        )}
      </section>
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

// Bar chart for monthly cashflow
function MonthlyCashflowChart({ data }: { data: MonthlyDetail[] }) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.cashflow);
  const maxAbs = Math.max(...values.map(Math.abs)) || 1;

  const width = 500;
  const height = 180;
  const padding = { top: 10, right: 10, bottom: 30, left: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const barWidth = plotWidth / 12 - 4;

  // Zero line Y position
  const hasNeg = Math.min(...values) < 0;
  const hasPos = Math.max(...values) > 0;
  const zeroY = hasNeg && hasPos
    ? padding.top + plotHeight * (maxAbs / (2 * maxAbs))
    : hasNeg
    ? padding.top
    : padding.top + plotHeight;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Zero line */}
      <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="#94a3b8" strokeWidth={1} />

      {/* Bars */}
      {data.map((d, i) => {
        const barX = padding.left + i * (plotWidth / 12) + 2;
        const barH = (Math.abs(d.cashflow) / maxAbs) * (plotHeight / 2);
        const barY = d.cashflow >= 0 ? zeroY - barH : zeroY;
        const fill = d.cashflow >= 0 ? "#10b981" : "#ef4444";
        return (
          <g key={i}>
            <rect x={barX} y={barY} width={barWidth} height={Math.max(barH, 1)} fill={fill} rx={2} />
            <text x={barX + barWidth / 2} y={height - 8} textAnchor="middle" fontSize={9} className="fill-slate-500">
              {d.month}
            </text>
          </g>
        );
      })}

      {/* Y labels */}
      {[maxAbs, 0, -maxAbs].map((val, i) => {
        if (!hasNeg && val < 0) return null;
        if (!hasPos && val > 0) return null;
        const y = padding.top + (plotHeight / 2) - (val / maxAbs) * (plotHeight / 2);
        return (
          <text key={i} x={padding.left - 5} y={y + 4} textAnchor="end" fontSize={9} className="fill-slate-500">
            ${Math.round(val).toLocaleString()}
          </text>
        );
      })}
    </svg>
  );
}
