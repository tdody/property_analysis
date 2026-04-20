import { useState, useEffect, useCallback } from "react";
import type {
  MortgageScenario,
  ComputedResults,
  LTRComputedResults,
  SensitivityData,
  LTRSensitivityData,
  AmortizationEntry,
  ProjectionYear,
  MonthlyDetail,
  IRRResult,
  HoldPeriodSweepEntry,
} from "../../types/index.ts";
import {
  getResults,
  getResultsForScenario,
  getSensitivity,
  getLTRResults,
  getLTRSensitivity,
  getAmortization,
  getProjections,
  getMonthlyBreakdown,
} from "../../api/client.ts";
import { MetricCell, MetricStrip } from "../shared/MetricCell.tsx";
import { SensitivityCard } from "../shared/SensitivityCard.tsx";
import { ExpenseBreakdown } from "../shared/ExpenseBreakdown.tsx";

interface ResultsTabProps {
  propertyId: string;
  scenarios: MortgageScenario[];
  activeRentalType: "str" | "ltr";
}

function fmt(value: number, decimals = 0): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCurrency(value: number): string {
  const abs = Math.abs(value);
  return value < 0 ? `-$${fmt(abs)}` : `$${fmt(abs)}`;
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function cashflowTone(
  value: number
): "positive" | "negative" | "default" {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "default";
}

export function ResultsTab({
  propertyId,
  scenarios,
  activeRentalType,
}: ResultsTabProps) {
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
  const [irrWithExit, setIrrWithExit] = useState<IRRResult | null>(null);
  const [holdPeriodSweep, setHoldPeriodSweep] = useState<HoldPeriodSweepEntry[]>(
    []
  );
  const [showExitAnalysis, setShowExitAnalysis] = useState(false);
  const [showMonthly, setShowMonthly] = useState(false);
  const [monthlyData, setMonthlyData] = useState<MonthlyDetail[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyIsSeasonal, setMonthlyIsSeasonal] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [ltrResults, setLtrResults] = useState<LTRComputedResults | null>(null);
  const [ltrSensitivity, setLtrSensitivity] = useState<LTRSensitivityData | null>(
    null
  );
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

      if (activeRentalType === "ltr") {
        const [ltrRes, ltrSens, amortData] = await Promise.all([
          getLTRResults(propertyId),
          getLTRSensitivity(propertyId),
          getAmortization(propertyId, selectedScenarioId),
        ]);
        setLtrResults(ltrRes);
        setLtrSensitivity(ltrSens);
        setResults(null);
        setSensitivity(null);
        setAmortization(amortData.slice(0, 60));
      } else {
        const [resultData, sensitivityData, amortData] = await Promise.all([
          selectedScenarioId
            ? getResultsForScenario(propertyId, selectedScenarioId)
            : getResults(propertyId),
          getSensitivity(propertyId),
          getAmortization(propertyId, selectedScenarioId),
        ]);
        setResults(resultData);
        setSensitivity(sensitivityData);
        setLtrResults(null);
        setLtrSensitivity(null);
        setAmortization(amortData.slice(0, 60));
      }
    } catch {
      setError(
        "Failed to load results. Make sure you have at least one scenario and revenue/expense assumptions configured."
      );
    } finally {
      setLoading(false);
    }
  }, [propertyId, selectedScenarioId, activeRentalType]);

  useEffect(() => {
    void fetchResults();
    setProjections([]);
    setShowProjections(false);
    setIrrWithExit(null);
    setHoldPeriodSweep([]);
    setShowExitAnalysis(false);
    setMonthlyData([]);
    setShowMonthly(false);
  }, [fetchResults]);

  if (scenarios.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-serif text-[20px] text-ink mb-2">
          No scenarios configured
        </p>
        <p className="text-[13px] text-ink-3">
          Add a financing scenario in the Financing tab to see results.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-ink-3 text-[14px]">
        Loading results…
      </div>
    );
  }

  if (error || (!results && !ltrResults)) {
    return (
      <div className="text-center py-12">
        <p className="text-negative mb-4 text-[14px]">
          {error || "No results available"}
        </p>
        <button
          type="button"
          onClick={() => void fetchResults()}
          className="caps px-5 py-2 bg-ink text-canvas rounded hover:opacity-90 transition-opacity"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <ScenarioSelector
        scenarios={scenarios}
        selectedId={selectedScenarioId}
        onChange={setSelectedScenarioId}
        rentalType={activeRentalType}
      />

      {activeRentalType === "ltr" && ltrResults ? (
        <LTRView
          results={ltrResults}
          sensitivity={ltrSensitivity}
          amortization={amortization}
          showAmortization={showAmortization}
          setShowAmortization={setShowAmortization}
        />
      ) : results ? (
        <STRView
          propertyId={propertyId}
          selectedScenarioId={selectedScenarioId}
          results={results}
          sensitivity={sensitivity}
          amortization={amortization}
          showAmortization={showAmortization}
          setShowAmortization={setShowAmortization}
          showTaxAnalysis={showTaxAnalysis}
          setShowTaxAnalysis={setShowTaxAnalysis}
          showProjections={showProjections}
          setShowProjections={setShowProjections}
          projections={projections}
          setProjections={setProjections}
          projectionsLoading={projectionsLoading}
          setProjectionsLoading={setProjectionsLoading}
          projectionIrr={projectionIrr}
          setProjectionIrr={setProjectionIrr}
          projectionEqMultiple={projectionEqMultiple}
          setProjectionEqMultiple={setProjectionEqMultiple}
          irrWithExit={irrWithExit}
          setIrrWithExit={setIrrWithExit}
          holdPeriodSweep={holdPeriodSweep}
          setHoldPeriodSweep={setHoldPeriodSweep}
          showExitAnalysis={showExitAnalysis}
          setShowExitAnalysis={setShowExitAnalysis}
          showMonthly={showMonthly}
          setShowMonthly={setShowMonthly}
          monthlyData={monthlyData}
          setMonthlyData={setMonthlyData}
          monthlyLoading={monthlyLoading}
          setMonthlyLoading={setMonthlyLoading}
          monthlyIsSeasonal={monthlyIsSeasonal}
          setMonthlyIsSeasonal={setMonthlyIsSeasonal}
          showComparison={showComparison}
          setShowComparison={setShowComparison}
          ltrResults={ltrResults}
          setLtrResults={setLtrResults}
          ltrSensitivity={ltrSensitivity}
          setLtrSensitivity={setLtrSensitivity}
          comparisonLoading={comparisonLoading}
          setComparisonLoading={setComparisonLoading}
        />
      ) : null}
    </div>
  );
}

// --- Scenario selector ----------------------------------------------------

function ScenarioSelector({
  scenarios,
  selectedId,
  onChange,
  rentalType,
}: {
  scenarios: MortgageScenario[];
  selectedId: string;
  onChange: (id: string) => void;
  rentalType: "str" | "ltr";
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="caps text-ink-3" htmlFor="results-scenario">
        Scenario
      </label>
      <select
        id="results-scenario"
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="text-[13px] bg-transparent border-0 border-b border-rule-strong focus:border-accent outline-none text-ink py-0.5 cursor-pointer"
      >
        {scenarios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.is_active ? " · active" : ""}
          </option>
        ))}
      </select>
      <span className="caps px-2 py-0.5 border border-rule-strong rounded">
        {rentalType === "ltr" ? "LTR" : "STR"}
      </span>
    </div>
  );
}

// --- STR view -------------------------------------------------------------

interface STRViewProps {
  propertyId: string;
  selectedScenarioId: string;
  results: ComputedResults;
  sensitivity: SensitivityData | null;
  amortization: AmortizationEntry[];
  showAmortization: boolean;
  setShowAmortization: (v: boolean) => void;
  showTaxAnalysis: boolean;
  setShowTaxAnalysis: (v: boolean) => void;
  showProjections: boolean;
  setShowProjections: (v: boolean) => void;
  projections: ProjectionYear[];
  setProjections: (v: ProjectionYear[]) => void;
  projectionsLoading: boolean;
  setProjectionsLoading: (v: boolean) => void;
  projectionIrr: number | null;
  setProjectionIrr: (v: number | null) => void;
  projectionEqMultiple: number;
  setProjectionEqMultiple: (v: number) => void;
  irrWithExit: IRRResult | null;
  setIrrWithExit: (v: IRRResult | null) => void;
  holdPeriodSweep: HoldPeriodSweepEntry[];
  setHoldPeriodSweep: (v: HoldPeriodSweepEntry[]) => void;
  showExitAnalysis: boolean;
  setShowExitAnalysis: (v: boolean) => void;
  showMonthly: boolean;
  setShowMonthly: (v: boolean) => void;
  monthlyData: MonthlyDetail[];
  setMonthlyData: (v: MonthlyDetail[]) => void;
  monthlyLoading: boolean;
  setMonthlyLoading: (v: boolean) => void;
  monthlyIsSeasonal: boolean;
  setMonthlyIsSeasonal: (v: boolean) => void;
  showComparison: boolean;
  setShowComparison: (v: boolean) => void;
  ltrResults: LTRComputedResults | null;
  setLtrResults: (v: LTRComputedResults | null) => void;
  ltrSensitivity: LTRSensitivityData | null;
  setLtrSensitivity: (v: LTRSensitivityData | null) => void;
  comparisonLoading: boolean;
  setComparisonLoading: (v: boolean) => void;
}

function STRView(props: STRViewProps) {
  const {
    propertyId,
    selectedScenarioId,
    results,
    sensitivity,
    amortization,
    showAmortization,
    setShowAmortization,
    showTaxAnalysis,
    setShowTaxAnalysis,
    showProjections,
    setShowProjections,
    projections,
    setProjections,
    projectionsLoading,
    setProjectionsLoading,
    projectionIrr,
    setProjectionIrr,
    projectionEqMultiple,
    setProjectionEqMultiple,
    irrWithExit,
    setIrrWithExit,
    holdPeriodSweep,
    setHoldPeriodSweep,
    showExitAnalysis,
    setShowExitAnalysis,
    showMonthly,
    setShowMonthly,
    monthlyData,
    setMonthlyData,
    monthlyLoading,
    setMonthlyLoading,
    monthlyIsSeasonal,
    setMonthlyIsSeasonal,
    showComparison,
    setShowComparison,
    ltrResults,
    setLtrResults,
    ltrSensitivity,
    setLtrSensitivity,
    comparisonLoading,
    setComparisonLoading,
  } = props;

  const m = results.metrics;
  const headlineIrr = irrWithExit?.irr_with_exit ?? projectionIrr;

  return (
    <>
      {/* Headline strip */}
      <MetricStrip>
        <MetricCell
          label="Annual Cashflow"
          value={fmtCurrency(m.annual_cashflow)}
          emphasis="large"
          tone={cashflowTone(m.annual_cashflow)}
          sub={`${fmtCurrency(m.monthly_cashflow)}/mo`}
        />
        <MetricCell
          label="IRR"
          value={headlineIrr !== null ? fmtPct(headlineIrr) : "—"}
          tone={
            headlineIrr === null
              ? "default"
              : cashflowTone(headlineIrr)
          }
          sub={
            irrWithExit
              ? `with exit @ ${irrWithExit.hold_period_years}yr`
              : "load projections"
          }
        />
        <MetricCell
          label="Break-even Occupancy"
          value={fmtPct(m.break_even_occupancy)}
          tone={
            m.break_even_occupancy <= 55
              ? "positive"
              : m.break_even_occupancy <= 70
              ? "default"
              : "warn"
          }
        />
      </MetricStrip>

      {/* Secondary metrics */}
      <MetricStrip>
        <MetricCell
          label="Cash-on-Cash"
          value={fmtPct(m.cash_on_cash_return)}
          tone={cashflowTone(m.cash_on_cash_return)}
        />
        <MetricCell
          label="Cap Rate"
          value={fmtPct(m.cap_rate)}
          tone={
            m.cap_rate >= 6
              ? "positive"
              : m.cap_rate >= 4
              ? "default"
              : "negative"
          }
        />
        <MetricCell
          label="DSCR"
          value={m.dscr.toFixed(2)}
          tone={
            m.dscr >= 1.25
              ? "positive"
              : m.dscr >= 1.0
              ? "warn"
              : "negative"
          }
        />
        <MetricCell
          label="NOI"
          value={fmtCurrency(m.noi)}
          tone={cashflowTone(m.noi)}
        />
      </MetricStrip>

      {/* Third strip: gross yield, ROI */}
      <MetricStrip>
        <MetricCell
          label="Gross Yield"
          value={fmtPct(m.gross_yield)}
          tone={
            m.gross_yield >= 12
              ? "positive"
              : m.gross_yield >= 8
              ? "default"
              : "negative"
          }
        />
        <MetricCell
          label="Year-1 ROI"
          value={fmtPct(m.total_roi_year1)}
          tone={cashflowTone(m.total_roi_year1)}
        />
        {m.appreciation_year1 > 0 ? (
          <MetricCell
            label="Year-1 ROI w/ Appreciation"
            value={fmtPct(m.total_roi_year1_with_appreciation)}
            tone={cashflowTone(m.total_roi_year1_with_appreciation)}
          />
        ) : (
          <MetricCell
            label="After-Tax Monthly"
            value={
              m.tax_liability !== 0
                ? fmtCurrency(m.after_tax_monthly_cashflow)
                : "—"
            }
            tone={
              m.tax_liability !== 0
                ? cashflowTone(m.after_tax_monthly_cashflow)
                : "default"
            }
            sub={m.tax_liability !== 0 ? undefined : "no tax modeled"}
          />
        )}
        <MetricCell
          label="Guest Cost / Night"
          value={
            m.guest_cost_per_night > 0
              ? fmtCurrency(m.guest_cost_per_night)
              : "—"
          }
          sub={m.guest_cost_per_night > 0 ? "rate + cleaning" : undefined}
        />
      </MetricStrip>

      {/* Warnings */}
      {m.dscr_warning && (
        <WarnBanner title="DSCR Lender Warning" body={m.dscr_warning} />
      )}
      {m.occupancy_rate_warning && (
        <WarnBanner
          title="Optimistic Assumptions"
          body={m.occupancy_rate_warning}
        />
      )}
      {results.rental_delay_months > 0 && (
        <InfoBanner
          title={`Year-1 adjusted · ${results.rental_delay_months}-month rental delay`}
          body={`Metrics reflect ${
            12 - results.rental_delay_months
          } months of rental income with 12 months of carrying costs. Carrying costs during the delay period are added to total cash invested.`}
        />
      )}

      {/* Revenue breakdown */}
      <section>
        <h2 className="h2 mb-4">Revenue breakdown</h2>
        <div className="border border-rule-strong rounded overflow-hidden">
          <table className="w-full text-[13px]">
            <tbody>
              <tr className="border-b border-rule">
                <td className="px-4 py-3 text-ink">Gross annual revenue</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                  {fmtCurrency(results.revenue.gross_annual)}
                </td>
              </tr>
              <tr className="border-b border-rule">
                <td className="px-4 py-3 text-ink-3 pl-8">
                  Less: platform fees
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-negative">
                  -
                  {fmtCurrency(
                    results.revenue.gross_annual - results.revenue.net_annual
                  )}
                </td>
              </tr>
              <tr className="border-b border-rule bg-paper">
                <td className="px-4 py-3 font-medium text-ink">
                  Net annual revenue
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                  {fmtCurrency(results.revenue.net_annual)}
                </td>
              </tr>
              <tr className="border-b border-rule">
                <td className="px-4 py-3 text-ink-3">Annual turnovers</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                  {results.revenue.annual_turnovers}
                </td>
              </tr>
              {results.tax_impact && (
                <>
                  <tr className="border-b border-rule">
                    <td className="px-4 py-3 text-ink">
                      Guest-facing tax rate
                      {results.tax_impact.platform_remits && (
                        <span className="ml-2 text-[11px] text-ink-3">
                          · platform remits
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                      {fmtPct(results.tax_impact.guest_facing_tax_pct)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-ink-3 pl-8">
                      Effective nightly rate (with tax)
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                      {fmtCurrency(
                        results.tax_impact.effective_nightly_rate_with_tax
                      )}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Expense breakdown */}
      <section>
        <h2 className="h2 mb-4">Expense breakdown</h2>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
          <div className="border border-rule-strong rounded p-5">
            <ExpenseBreakdown
              breakdown={results.expenses.breakdown}
              total={results.expenses.total_annual_operating}
            />
          </div>
          <div className="border border-rule-strong rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-rule caps">
              Housing · monthly
            </div>
            <table className="w-full text-[13px]">
              <tbody>
                <tr className="border-b border-rule">
                  <td className="px-4 py-2 text-ink-3">Principal &amp; interest</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                    {fmtCurrency(results.mortgage.monthly_pi)}
                  </td>
                </tr>
                {results.mortgage.monthly_pmi > 0 && (
                  <tr className="border-b border-rule">
                    <td className="px-4 py-2 text-ink-3">PMI</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                      {fmtCurrency(results.mortgage.monthly_pmi)}
                    </td>
                  </tr>
                )}
                <tr className="border-b border-rule bg-paper">
                  <td className="px-4 py-3 font-medium text-ink">
                    Total monthly housing
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                    {fmtCurrency(results.mortgage.total_monthly_housing)}
                  </td>
                </tr>
                {results.mortgage.origination_fee > 0 && (
                  <tr className="border-b border-rule">
                    <td className="px-4 py-2 text-ink-3">Origination fee</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                      {fmtCurrency(results.mortgage.origination_fee)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="px-4 py-2 text-ink-3">Total cash invested</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                    {fmtCurrency(results.mortgage.total_cash_invested)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Tax analysis */}
      {m.tax_liability !== 0 && (
        <Disclosure
          title="Tax analysis"
          open={showTaxAnalysis}
          onToggle={() => setShowTaxAnalysis(!showTaxAnalysis)}
        >
          <div className="border border-rule-strong rounded overflow-hidden">
            <table className="w-full text-[13px]">
              <tbody>
                <tr className="border-b border-rule">
                  <td className="px-4 py-2 text-ink">NOI</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                    {fmtCurrency(m.noi)}
                  </td>
                </tr>
                <tr className="border-b border-rule">
                  <td className="px-4 py-2 text-ink-3 pl-8">
                    Less: mortgage interest (Yr 1)
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-negative">
                    -
                    {fmtCurrency(
                      m.noi -
                        m.taxable_income -
                        (results.depreciation?.total_depreciation_annual ?? 0)
                    )}
                  </td>
                </tr>
                <tr className="border-b border-rule">
                  <td className="px-4 py-2 text-ink-3 pl-8">
                    Less: depreciation
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-negative">
                    -
                    {fmtCurrency(
                      results.depreciation?.total_depreciation_annual ?? 0
                    )}
                  </td>
                </tr>
                <tr className="border-b border-rule bg-paper">
                  <td className="px-4 py-3 font-medium text-ink">
                    Taxable income
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono tabular-nums font-medium ${
                      m.taxable_income < 0 ? "text-accent" : "text-ink"
                    }`}
                  >
                    {fmtCurrency(m.taxable_income)}
                    {m.taxable_income < 0 && (
                      <span className="text-[11px] ml-1 text-ink-3">
                        (paper loss)
                      </span>
                    )}
                  </td>
                </tr>
                <tr className="border-b border-rule">
                  <td className="px-4 py-2 text-ink">
                    {m.tax_liability >= 0 ? "Tax liability" : "Tax savings"}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono tabular-nums ${
                      m.tax_liability >= 0 ? "text-negative" : "text-accent"
                    }`}
                  >
                    {m.tax_liability >= 0
                      ? `-${fmtCurrency(m.tax_liability)}`
                      : `+${fmtCurrency(Math.abs(m.tax_liability))}`}
                  </td>
                </tr>
                <tr className="bg-paper">
                  <td className="px-4 py-3 font-medium text-ink">
                    After-tax annual cashflow
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono tabular-nums font-medium ${
                      m.after_tax_annual_cashflow >= 0
                        ? "text-accent"
                        : "text-negative"
                    }`}
                  >
                    {fmtCurrency(m.after_tax_annual_cashflow)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Disclosure>
      )}

      {/* Depreciation */}
      {results.depreciation &&
        results.depreciation.total_depreciation_annual > 0 && (
          <section>
            <h2 className="h2 mb-4">
              Tax deductions · non-cash
            </h2>
            <div className="border border-rule-strong rounded overflow-hidden">
              <table className="w-full text-[13px]">
                <tbody>
                  <tr className="border-b border-rule">
                    <td className="px-4 py-2 text-ink-3">
                      Building value (depreciable)
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                      {fmtCurrency(results.depreciation.building_value)}
                    </td>
                  </tr>
                  <tr className="border-b border-rule">
                    <td className="px-4 py-2 text-ink-3">
                      Building depreciation · 27.5 yr
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                      {fmtCurrency(
                        results.depreciation.building_depreciation_annual
                      )}
                      /yr
                    </td>
                  </tr>
                  {results.depreciation.furniture_depreciation_annual > 0 && (
                    <tr className="border-b border-rule">
                      <td className="px-4 py-2 text-ink-3">
                        Furniture depreciation · 7 yr
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                        {fmtCurrency(
                          results.depreciation.furniture_depreciation_annual
                        )}
                        /yr
                      </td>
                    </tr>
                  )}
                  <tr className="bg-paper">
                    <td className="px-4 py-3 font-medium text-ink">
                      Total annual depreciation
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-ink">
                      {fmtCurrency(
                        results.depreciation.total_depreciation_annual
                      )}
                      /yr
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="px-4 py-2 text-[11px] text-ink-3 border-t border-rule bg-paper">
                Depreciation is a non-cash tax deduction. It reduces taxable
                income but does not affect NOI, cashflow, or DSCR.
              </div>
            </div>
          </section>
        )}

      {/* Sensitivity */}
      {sensitivity && (
        <section>
          <h2 className="h2 mb-4">Sensitivity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SensitivityCard
              title="Occupancy vs monthly cashflow"
              data={sensitivity.occupancy_sweep.map((d) => ({
                label: `${d.occupancy_pct}%`,
                value: d.monthly_cashflow,
              }))}
            />
            <SensitivityCard
              title="Nightly rate vs monthly cashflow"
              data={sensitivity.rate_sweep.map((d) => ({
                label: `$${d.nightly_rate}`,
                value: d.monthly_cashflow,
              }))}
            />
          </div>
        </section>
      )}

      {/* Monthly cashflow */}
      <Disclosure
        title="Monthly cashflow"
        open={showMonthly}
        onToggle={() => {
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
      >
        {monthlyLoading ? (
          <div className="text-center py-6 text-ink-3 text-[13px]">
            Loading monthly data…
          </div>
        ) : monthlyData.length > 0 ? (
          <div className="space-y-4">
            <div className="border border-rule-strong rounded p-4">
              <MonthlyCashflowChart data={monthlyData} />
            </div>
            <div className="border border-rule-strong rounded overflow-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-paper">
                  <tr className="border-b border-rule">
                    <th className="px-3 py-3 text-left caps">Month</th>
                    {monthlyData[0]?.nightly_rate != null ? (
                      <>
                        <th className="px-3 py-3 text-right caps">Rate</th>
                        <th className="px-3 py-3 text-right caps">Occ %</th>
                      </>
                    ) : monthlyIsSeasonal ? (
                      <th className="px-3 py-3 text-left caps">Season</th>
                    ) : null}
                    <th className="px-3 py-3 text-right caps">Revenue</th>
                    <th className="px-3 py-3 text-right caps">Expenses</th>
                    <th className="px-3 py-3 text-right caps">NOI</th>
                    <th className="px-3 py-3 text-right caps">Cashflow</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((mo) => (
                    <tr key={mo.month} className="border-b border-rule last:border-0">
                      <td className="px-3 py-2 font-medium text-ink">
                        {mo.month}
                      </td>
                      {mo.nightly_rate != null ? (
                        <>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                            ${fmt(mo.nightly_rate)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                            {mo.occupancy_pct?.toFixed(0)}%
                          </td>
                        </>
                      ) : monthlyIsSeasonal ? (
                        <td className="px-3 py-2">
                          <span
                            className={`caps px-2 py-0.5 border rounded ${
                              mo.is_peak
                                ? "border-accent text-accent"
                                : "border-rule-strong text-ink-3"
                            }`}
                          >
                            {mo.is_peak ? "Peak" : "Off-peak"}
                          </span>
                        </td>
                      ) : null}
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                        {fmtCurrency(mo.gross_revenue)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                        {fmtCurrency(mo.total_expenses)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                        {fmtCurrency(mo.noi)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono tabular-nums font-medium ${
                          mo.cashflow >= 0 ? "text-accent" : "text-negative"
                        }`}
                      >
                        {fmtCurrency(mo.cashflow)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-ink-3 text-[13px]">
            No monthly data available.
          </div>
        )}
      </Disclosure>

      {/* Projections */}
      <Disclosure
        title={`${
          irrWithExit ? irrWithExit.hold_period_years : 5
        }-year projections`}
        open={showProjections}
        onToggle={() => {
          const next = !showProjections;
          setShowProjections(next);
          if (next && projections.length === 0 && selectedScenarioId) {
            setProjectionsLoading(true);
            getProjections(propertyId, selectedScenarioId)
              .then((data) => {
                setProjections(data.years);
                setProjectionIrr(data.irr);
                setProjectionEqMultiple(data.equity_multiple);
                setIrrWithExit(data.irr_with_exit);
                setHoldPeriodSweep(data.hold_period_sweep);
              })
              .catch(() => setProjections([]))
              .finally(() => setProjectionsLoading(false));
          }
        }}
      >
        {projectionsLoading ? (
          <div className="text-center py-6 text-ink-3 text-[13px]">
            Loading projections…
          </div>
        ) : projections.length > 0 ? (
          <div className="space-y-6">
            <MetricStrip>
              {irrWithExit?.irr_with_exit != null && (
                <MetricCell
                  label="IRR with exit"
                  value={`${irrWithExit.irr_with_exit.toFixed(1)}%`}
                  tone={cashflowTone(irrWithExit.irr_with_exit)}
                />
              )}
              {projectionIrr !== null && (
                <MetricCell
                  label="IRR · operating"
                  value={`${projectionIrr.toFixed(1)}%`}
                  tone={cashflowTone(projectionIrr)}
                />
              )}
              <MetricCell
                label="Equity multiple"
                value={`${projectionEqMultiple.toFixed(2)}x`}
                tone={
                  projectionEqMultiple >= 1
                    ? "positive"
                    : projectionEqMultiple >= 0
                    ? "default"
                    : "negative"
                }
              />
              {irrWithExit && (
                <MetricCell
                  label="Total profit"
                  value={fmtCurrency(irrWithExit.total_profit)}
                  tone={cashflowTone(irrWithExit.total_profit)}
                />
              )}
            </MetricStrip>

            <ProjectionTable
              projections={projections}
              showAfterTax={m.tax_liability !== 0}
            />

            {irrWithExit && (
              <Disclosure
                title="Exit analysis"
                open={showExitAnalysis}
                onToggle={() => setShowExitAnalysis(!showExitAnalysis)}
                level="nested"
              >
                <div className="border border-rule-strong rounded overflow-hidden">
                  <table className="w-full text-[13px]">
                    <tbody>
                      {[
                        {
                          label: "Sale price",
                          value: irrWithExit.exit_analysis.sale_price,
                          positive: true,
                        },
                        {
                          label: "Selling costs",
                          value: -irrWithExit.exit_analysis.selling_costs,
                          positive: false,
                        },
                        {
                          label: "Remaining mortgage",
                          value: -irrWithExit.exit_analysis.remaining_mortgage,
                          positive: false,
                        },
                        {
                          label: "Capital gains tax",
                          value: -irrWithExit.exit_analysis.capital_gains_tax,
                          positive: false,
                        },
                        {
                          label: "Depreciation recapture tax",
                          value:
                            -irrWithExit.exit_analysis.depreciation_recapture_tax,
                          positive: false,
                        },
                      ].map((row) => (
                        <tr
                          key={row.label}
                          className="border-b border-rule last:border-0"
                        >
                          <td className="px-4 py-2 text-ink-3">{row.label}</td>
                          <td
                            className={`px-4 py-2 text-right font-mono tabular-nums ${
                              row.positive ? "text-accent" : "text-negative"
                            }`}
                          >
                            {fmtCurrency(row.value)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-paper">
                        <td className="px-4 py-3 font-medium text-ink">
                          Net exit proceeds
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono tabular-nums font-medium ${
                            irrWithExit.exit_analysis.net_exit_proceeds >= 0
                              ? "text-accent"
                              : "text-negative"
                          }`}
                        >
                          {fmtCurrency(
                            irrWithExit.exit_analysis.net_exit_proceeds
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Disclosure>
            )}

            {holdPeriodSweep.length > 0 && (
              <div>
                <div className="caps mb-2">IRR vs hold period</div>
                <SensitivityCard
                  title=""
                  data={holdPeriodSweep
                    .filter((d) => d.irr !== null)
                    .map((d) => ({ label: `${d.hold_period}yr`, value: d.irr! }))}
                  yLabel="%"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-ink-3 text-[13px]">
            No projection data available.
          </div>
        )}
      </Disclosure>

      {/* Amortization */}
      {amortization.length > 0 && (
        <Disclosure
          title="Amortization · first 5 years"
          open={showAmortization}
          onToggle={() => setShowAmortization(!showAmortization)}
        >
          <div className="border border-rule-strong rounded overflow-auto max-h-96">
            <table className="w-full text-[13px]">
              <thead className="bg-paper sticky top-0">
                <tr className="border-b border-rule">
                  <th className="px-4 py-3 text-left caps">Month</th>
                  <th className="px-4 py-3 text-right caps">Principal</th>
                  <th className="px-4 py-3 text-right caps">Interest</th>
                  <th className="px-4 py-3 text-right caps">Balance</th>
                </tr>
              </thead>
              <tbody>
                {amortization.map((entry) => (
                  <tr
                    key={entry.month}
                    className="border-b border-rule last:border-0"
                  >
                    <td className="px-4 py-2 text-ink">{entry.month}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                      {fmtCurrency(entry.principal)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                      {fmtCurrency(entry.interest)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                      {fmtCurrency(entry.remaining_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Disclosure>
      )}

      {/* STR vs LTR */}
      <Disclosure
        title="Compare STR vs LTR"
        open={showComparison}
        onToggle={() => {
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
      >
        {comparisonLoading ? (
          <div className="text-center py-6 text-ink-3 text-[13px]">
            Loading LTR results…
          </div>
        ) : ltrResults ? (
          <div className="space-y-6">
            <ComparisonTable strMetrics={m} ltrMetrics={ltrResults.metrics} />
            {ltrSensitivity && (
              <div>
                <div className="caps mb-3">LTR sensitivity</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SensitivityCard
                    title="Vacancy vs monthly cashflow"
                    data={ltrSensitivity.vacancy_sweep.map((d) => ({
                      label: `${d.vacancy_pct}%`,
                      value: d.monthly_cashflow,
                    }))}
                  />
                  <SensitivityCard
                    title="Monthly rent vs cashflow"
                    data={ltrSensitivity.rent_sweep.map((d) => ({
                      label: `$${d.monthly_rent}`,
                      value: d.monthly_cashflow,
                    }))}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-ink-3 text-[13px]">
            Failed to load LTR results. Make sure you have at least one active
            scenario configured.
          </div>
        )}
      </Disclosure>
    </>
  );
}

// --- LTR view -------------------------------------------------------------

function LTRView({
  results,
  sensitivity,
  amortization,
  showAmortization,
  setShowAmortization,
}: {
  results: LTRComputedResults;
  sensitivity: LTRSensitivityData | null;
  amortization: AmortizationEntry[];
  showAmortization: boolean;
  setShowAmortization: (v: boolean) => void;
}) {
  const m = results.metrics;
  return (
    <>
      <MetricStrip>
        <MetricCell
          label="Annual Cashflow"
          value={fmtCurrency(m.annual_cashflow)}
          emphasis="large"
          tone={cashflowTone(m.annual_cashflow)}
          sub={`${fmtCurrency(m.monthly_cashflow)}/mo`}
        />
        <MetricCell
          label="Cap Rate"
          value={fmtPct(m.cap_rate)}
          tone={
            m.cap_rate >= 6
              ? "positive"
              : m.cap_rate >= 4
              ? "default"
              : "negative"
          }
        />
        <MetricCell
          label="DSCR"
          value={m.dscr.toFixed(2)}
          tone={
            m.dscr >= 1.25
              ? "positive"
              : m.dscr >= 1.0
              ? "warn"
              : "negative"
          }
        />
      </MetricStrip>

      <MetricStrip>
        <MetricCell
          label="Cash-on-Cash"
          value={fmtPct(m.cash_on_cash_return)}
          tone={cashflowTone(m.cash_on_cash_return)}
        />
        <MetricCell
          label="NOI"
          value={fmtCurrency(m.noi)}
          tone={cashflowTone(m.noi)}
        />
        <MetricCell
          label="Gross Yield"
          value={fmtPct(m.gross_yield)}
          tone={
            m.gross_yield >= 8
              ? "positive"
              : m.gross_yield >= 5
              ? "default"
              : "negative"
          }
        />
        <MetricCell
          label="Year-1 ROI"
          value={fmtPct(m.total_roi_year1)}
          tone={cashflowTone(m.total_roi_year1)}
        />
      </MetricStrip>

      {m.dscr_warning && (
        <WarnBanner title="DSCR Lender Warning" body={m.dscr_warning} />
      )}

      <section>
        <h2 className="h2 mb-4">Revenue breakdown</h2>
        <div className="border border-rule-strong rounded overflow-hidden">
          <table className="w-full text-[13px]">
            <tbody>
              <tr className="border-b border-rule">
                <td className="px-4 py-3 text-ink">Monthly rent</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                  {fmtCurrency(results.revenue.monthly_rent)}/mo
                </td>
              </tr>
              {results.revenue.pet_rent_monthly > 0 && (
                <tr className="border-b border-rule">
                  <td className="px-4 py-3 pl-8 text-ink-3">Pet rent</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                    {fmtCurrency(results.revenue.pet_rent_monthly)}/mo
                  </td>
                </tr>
              )}
              {results.revenue.late_fee_monthly > 0 && (
                <tr className="border-b border-rule">
                  <td className="px-4 py-3 pl-8 text-ink-3">Late fee income</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                    {fmtCurrency(results.revenue.late_fee_monthly)}/mo
                  </td>
                </tr>
              )}
              <tr className="border-b border-rule">
                <td className="px-4 py-3 text-ink">Gross annual revenue</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                  {fmtCurrency(results.revenue.gross_annual)}
                </td>
              </tr>
              <tr className="border-b border-rule">
                <td className="px-4 py-3 pl-8 text-ink-3">Less: vacancy loss</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-negative">
                  -{fmtCurrency(results.revenue.vacancy_loss)}
                </td>
              </tr>
              <tr className="bg-paper">
                <td className="px-4 py-3 font-medium text-ink">
                  Effective annual revenue
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                  {fmtCurrency(results.revenue.effective_annual)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="h2 mb-4">Expense breakdown</h2>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
          <div className="border border-rule-strong rounded p-5">
            <ExpenseBreakdown
              breakdown={results.expenses.breakdown}
              total={results.expenses.total_annual_operating}
            />
          </div>
          <div className="border border-rule-strong rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-rule caps">
              Housing · monthly
            </div>
            <table className="w-full text-[13px]">
              <tbody>
                <tr className="border-b border-rule">
                  <td className="px-4 py-2 text-ink-3">
                    Principal &amp; interest
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                    {fmtCurrency(results.mortgage.monthly_pi)}
                  </td>
                </tr>
                {results.mortgage.monthly_pmi > 0 && (
                  <tr className="border-b border-rule">
                    <td className="px-4 py-2 text-ink-3">PMI</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                      {fmtCurrency(results.mortgage.monthly_pmi)}
                    </td>
                  </tr>
                )}
                <tr className="bg-paper">
                  <td className="px-4 py-3 font-medium text-ink">
                    Total monthly housing
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                    {fmtCurrency(results.mortgage.total_monthly_housing)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {sensitivity && (
        <section>
          <h2 className="h2 mb-4">Sensitivity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SensitivityCard
              title="Vacancy vs monthly cashflow"
              data={sensitivity.vacancy_sweep.map((d) => ({
                label: `${d.vacancy_pct}%`,
                value: d.monthly_cashflow,
              }))}
            />
            <SensitivityCard
              title="Monthly rent vs cashflow"
              data={sensitivity.rent_sweep.map((d) => ({
                label: `$${d.monthly_rent}`,
                value: d.monthly_cashflow,
              }))}
            />
          </div>
        </section>
      )}

      {amortization.length > 0 && (
        <Disclosure
          title="Amortization · first 5 years"
          open={showAmortization}
          onToggle={() => setShowAmortization(!showAmortization)}
        >
          <div className="border border-rule-strong rounded overflow-auto max-h-96">
            <table className="w-full text-[13px]">
              <thead className="bg-paper sticky top-0">
                <tr className="border-b border-rule">
                  <th className="px-4 py-3 text-left caps">Month</th>
                  <th className="px-4 py-3 text-right caps">Principal</th>
                  <th className="px-4 py-3 text-right caps">Interest</th>
                  <th className="px-4 py-3 text-right caps">Balance</th>
                </tr>
              </thead>
              <tbody>
                {amortization.map((entry) => (
                  <tr
                    key={entry.month}
                    className="border-b border-rule last:border-0"
                  >
                    <td className="px-4 py-2 text-ink">{entry.month}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                      {fmtCurrency(entry.principal)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                      {fmtCurrency(entry.interest)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                      {fmtCurrency(entry.remaining_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Disclosure>
      )}
    </>
  );
}

// --- Projection table with inline bars ------------------------------------

function ProjectionTable({
  projections,
  showAfterTax,
}: {
  projections: ProjectionYear[];
  showAfterTax: boolean;
}) {
  const maxAbs =
    Math.max(
      ...projections.map((y) => Math.abs(y.annual_cashflow)),
      1
    );

  return (
    <div className="border border-rule-strong rounded overflow-auto">
      <table className="w-full text-[13px]">
        <thead className="bg-paper sticky top-0">
          <tr className="border-b border-rule">
            <th className="px-3 py-3 text-left caps">Year</th>
            <th className="px-3 py-3 text-right caps">Gross</th>
            <th className="px-3 py-3 text-right caps">NOI</th>
            <th className="px-3 py-3 text-right caps">Cashflow</th>
            <th className="px-3 py-3 text-right caps">Cum CF</th>
            <th className="px-3 py-3 text-right caps">CoC</th>
            <th className="px-3 py-3 text-right caps">Value</th>
            <th className="px-3 py-3 text-right caps">Balance</th>
            <th className="px-3 py-3 text-right caps">Equity</th>
            {showAfterTax && (
              <th className="px-3 py-3 text-right caps">After-tax</th>
            )}
          </tr>
        </thead>
        <tbody>
          {projections.map((y) => {
            const pct = Math.abs(y.annual_cashflow) / maxAbs;
            const barWidth = Math.max(4, pct * 100);
            const positive = y.annual_cashflow >= 0;
            return (
              <tr
                key={y.year}
                className="border-b border-rule last:border-0"
              >
                <td className="px-3 py-2 font-medium text-ink">{y.year}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                  {fmtCurrency(y.gross_revenue)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                  {fmtCurrency(y.noi)}
                </td>
                <td className="px-3 py-2 text-right">
                  <div
                    className={`font-mono tabular-nums font-medium ${
                      positive ? "text-accent" : "text-negative"
                    }`}
                  >
                    {fmtCurrency(y.annual_cashflow)}
                  </div>
                  <div className="mt-1 flex justify-end">
                    <div
                      className="h-1 rounded-sm"
                      style={{
                        width: `${barWidth}%`,
                        maxWidth: "100%",
                        backgroundColor: positive
                          ? "var(--accent)"
                          : "var(--negative)",
                        opacity: 0.7,
                      }}
                    />
                  </div>
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${
                    y.cumulative_cashflow >= 0
                      ? "text-accent"
                      : "text-negative"
                  }`}
                >
                  {fmtCurrency(y.cumulative_cashflow)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                  {fmtPct(y.cash_on_cash_return)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                  {fmtCurrency(y.property_value)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                  {fmtCurrency(y.loan_balance)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums font-medium text-ink">
                  {fmtCurrency(y.equity)}
                </td>
                {showAfterTax && (
                  <td
                    className={`px-3 py-2 text-right font-mono tabular-nums font-medium ${
                      y.after_tax_cashflow >= 0
                        ? "text-accent"
                        : "text-negative"
                    }`}
                  >
                    {fmtCurrency(y.after_tax_cashflow)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- STR vs LTR comparison table ------------------------------------------

function ComparisonTable({
  strMetrics,
  ltrMetrics,
}: {
  strMetrics: ComputedResults["metrics"];
  ltrMetrics: LTRComputedResults["metrics"];
}) {
  const rows: Array<{
    label: string;
    strVal: number;
    ltrVal: number;
    fmt: (v: number) => string;
  }> = [
    {
      label: "Monthly cashflow",
      strVal: strMetrics.monthly_cashflow,
      ltrVal: ltrMetrics.monthly_cashflow,
      fmt: fmtCurrency,
    },
    {
      label: "Annual cashflow",
      strVal: strMetrics.annual_cashflow,
      ltrVal: ltrMetrics.annual_cashflow,
      fmt: fmtCurrency,
    },
    {
      label: "Cash-on-cash",
      strVal: strMetrics.cash_on_cash_return,
      ltrVal: ltrMetrics.cash_on_cash_return,
      fmt: fmtPct,
    },
    {
      label: "Cap rate",
      strVal: strMetrics.cap_rate,
      ltrVal: ltrMetrics.cap_rate,
      fmt: fmtPct,
    },
    {
      label: "NOI",
      strVal: strMetrics.noi,
      ltrVal: ltrMetrics.noi,
      fmt: fmtCurrency,
    },
    {
      label: "DSCR",
      strVal: strMetrics.dscr,
      ltrVal: ltrMetrics.dscr,
      fmt: (v) => v.toFixed(2),
    },
    {
      label: "Gross yield",
      strVal: strMetrics.gross_yield,
      ltrVal: ltrMetrics.gross_yield,
      fmt: fmtPct,
    },
    {
      label: "Year-1 ROI",
      strVal: strMetrics.total_roi_year1,
      ltrVal: ltrMetrics.total_roi_year1,
      fmt: fmtPct,
    },
  ];

  return (
    <div className="border border-rule-strong rounded overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-paper">
          <tr className="border-b border-rule">
            <th className="px-4 py-3 text-left caps">Metric</th>
            <th className="px-4 py-3 text-right caps">STR</th>
            <th className="px-4 py-3 text-right caps">LTR</th>
            <th className="px-4 py-3 text-right caps">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, strVal, ltrVal, fmt }) => {
            const diff = ltrVal - strVal;
            const winner =
              diff > 0.01 ? "ltr" : diff < -0.01 ? "str" : "tie";
            return (
              <tr key={label} className="border-b border-rule last:border-0">
                <td className="px-4 py-2 text-ink font-medium">{label}</td>
                <td
                  className={`px-4 py-2 text-right font-mono tabular-nums ${
                    winner === "str" ? "text-accent font-medium" : "text-ink"
                  }`}
                >
                  {fmt(strVal)}
                </td>
                <td
                  className={`px-4 py-2 text-right font-mono tabular-nums ${
                    winner === "ltr" ? "text-accent font-medium" : "text-ink"
                  }`}
                >
                  {fmt(ltrVal)}
                </td>
                <td
                  className={`px-4 py-2 text-right font-mono tabular-nums ${
                    diff > 0
                      ? "text-accent"
                      : diff < 0
                      ? "text-negative"
                      : "text-ink-3"
                  }`}
                >
                  {diff > 0 ? "+" : ""}
                  {fmt(diff)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- Monthly cashflow chart (token-colored) -------------------------------

function MonthlyCashflowChart({ data }: { data: MonthlyDetail[] }) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.cashflow);
  const maxAbs = Math.max(...values.map(Math.abs)) || 1;

  const width = 500;
  const height = 180;
  const padding = { top: 10, right: 10, bottom: 30, left: 56 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const barWidth = plotWidth / 12 - 4;

  const hasNeg = Math.min(...values) < 0;
  const hasPos = Math.max(...values) > 0;
  const zeroY =
    hasNeg && hasPos
      ? padding.top + plotHeight / 2
      : hasNeg
      ? padding.top
      : padding.top + plotHeight;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <line
        x1={padding.left}
        y1={zeroY}
        x2={width - padding.right}
        y2={zeroY}
        stroke="var(--rule-strong)"
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const barX = padding.left + i * (plotWidth / 12) + 2;
        const barH = (Math.abs(d.cashflow) / maxAbs) * (plotHeight / 2);
        const barY = d.cashflow >= 0 ? zeroY - barH : zeroY;
        const fill = d.cashflow >= 0 ? "var(--accent)" : "var(--negative)";
        return (
          <g key={i}>
            <rect
              x={barX}
              y={barY}
              width={barWidth}
              height={Math.max(barH, 1)}
              fill={fill}
              rx={2}
              opacity={0.85}
            />
            <text
              x={barX + barWidth / 2}
              y={height - 8}
              textAnchor="middle"
              fill="var(--ink-3)"
              style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
            >
              {d.month}
            </text>
          </g>
        );
      })}
      {[maxAbs, 0, -maxAbs].map((val, i) => {
        if (!hasNeg && val < 0) return null;
        if (!hasPos && val > 0) return null;
        const y =
          padding.top + plotHeight / 2 - (val / maxAbs) * (plotHeight / 2);
        return (
          <text
            key={i}
            x={padding.left - 5}
            y={y + 3}
            textAnchor="end"
            fill="var(--ink-3)"
            style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
          >
            ${Math.round(val).toLocaleString()}
          </text>
        );
      })}
    </svg>
  );
}

// --- Shared UI helpers (internal) -----------------------------------------

function WarnBanner({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-warn bg-warn-soft rounded p-4 flex items-start gap-3">
      <span className="text-warn text-lg leading-none mt-0.5" aria-hidden>
        !
      </span>
      <div>
        <p className="caps text-warn mb-1">{title}</p>
        <p className="text-[13px] text-ink-2 leading-snug">{body}</p>
      </div>
    </div>
  );
}

function InfoBanner({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-rule-strong bg-paper rounded p-4 flex items-start gap-3">
      <span className="text-accent text-lg leading-none mt-0.5" aria-hidden>
        ℹ
      </span>
      <div>
        <p className="caps text-ink mb-1">{title}</p>
        <p className="text-[13px] text-ink-2 leading-snug">{body}</p>
      </div>
    </div>
  );
}

function Disclosure({
  title,
  open,
  onToggle,
  children,
  level = "section",
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  level?: "section" | "nested";
}) {
  const TitleTag = level === "section" ? "h3" : "h4";
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 mb-4 w-full text-left"
      >
        <span className="text-ink-3 text-[14px]">{open ? "▾" : "▸"}</span>
        <TitleTag
          className={
            level === "section"
              ? "font-serif text-[22px] text-ink"
              : "caps text-ink"
          }
        >
          {title}
        </TitleTag>
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}
