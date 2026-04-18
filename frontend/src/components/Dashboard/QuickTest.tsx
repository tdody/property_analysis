import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { quickTest, createProperty, createScenario } from "../../api/client.ts";
import type { QuickTestResult } from "../../types/index.ts";

function fmtCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = `$${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return value < 0 ? `-${formatted}` : formatted;
}

const VERDICT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  strong: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-400", label: "Strong Deal" },
  moderate: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-400", label: "Moderate" },
  weak: { bg: "bg-orange-100 dark:bg-orange-900/40", text: "text-orange-700 dark:text-orange-400", label: "Weak" },
  negative: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-400", label: "Negative" },
};

interface QuickTestProps {
  onClose: () => void;
}

export function QuickTest({ onClose }: QuickTestProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"str" | "ltr">("str");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [downPaymentPct, setDownPaymentPct] = useState("25");
  const [interestRate, setInterestRate] = useState("7.0");
  const [loanTermYears, setLoanTermYears] = useState<15 | 30>(30);
  const [nightlyRate, setNightlyRate] = useState("");
  const [occupancyPct, setOccupancyPct] = useState("65");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [result, setResult] = useState<QuickTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingFull, setCreatingFull] = useState(false);

  const canRun =
    parseFloat(purchasePrice) > 0 &&
    (mode === "str" ? parseFloat(nightlyRate) > 0 : parseFloat(monthlyRent) > 0);

  const handleRun = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await quickTest({
        purchase_price: parseFloat(purchasePrice),
        down_payment_pct: parseFloat(downPaymentPct) || 25,
        interest_rate: parseFloat(interestRate) || 7,
        loan_term_years: loanTermYears,
        ...(mode === "str"
          ? { nightly_rate: parseFloat(nightlyRate), occupancy_pct: parseFloat(occupancyPct) || 65 }
          : { monthly_rent: parseFloat(monthlyRent) }),
      });
      setResult(data);
    } catch {
      setError("Failed to compute. Check your inputs.");
    } finally {
      setLoading(false);
    }
  }, [purchasePrice, downPaymentPct, interestRate, loanTermYears, nightlyRate, occupancyPct, monthlyRent, mode]);

  const handleFullAnalysis = useCallback(async () => {
    try {
      setCreatingFull(true);
      const price = parseFloat(purchasePrice);
      const property = await createProperty({
        name: `Quick Test - ${fmtCurrency(price)}`,
        listing_price: price,
        address: "",
        city: "",
        state: "VT",
        zip_code: "",
        beds: 0,
        baths: 0,
        sqft: 0,
        hoa_monthly: 0,
        annual_taxes: Math.round(price * 0.015),
        notes: "",
        property_type: "single_family",
        active_rental_type: mode,
      });
      await createScenario(property.id, {
        name: "Primary",
        loan_type: "conventional",
        purchase_price: price,
        down_payment_pct: parseFloat(downPaymentPct) || 25,
        down_payment_amt: price * (parseFloat(downPaymentPct) || 25) / 100,
        interest_rate: parseFloat(interestRate) || 7,
        loan_term_years: loanTermYears,
        closing_cost_pct: 3,
        closing_cost_amt: price * 0.03,
        renovation_cost: 0,
        furniture_cost: 0,
        other_upfront_costs: 0,
        pmi_monthly: 0,
        origination_points_pct: 0,
        io_period_years: 0,
        is_active: true,
      });
      navigate(`/property/${property.id}`);
    } catch {
      setError("Failed to create property.");
    } finally {
      setCreatingFull(false);
    }
  }, [purchasePrice, downPaymentPct, interestRate, loanTermYears, mode, navigate]);

  const verdict = result ? VERDICT_STYLES[result.verdict] : null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 mb-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold tracking-tight dark:text-slate-100">Quick Deal Test</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* STR / LTR + loan term toggles */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="bg-slate-100 dark:bg-slate-700 rounded-xl p-1 inline-flex gap-1">
          {(["str", "ltr"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setResult(null); }}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                mode === m
                  ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-slate-100 font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="bg-slate-100 dark:bg-slate-700 rounded-xl p-1 inline-flex gap-1">
          {([30, 15] as const).map((yrs) => (
            <button
              key={yrs}
              onClick={() => { setLoanTermYears(yrs); setResult(null); }}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                loanTermYears === yrs
                  ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-slate-100 font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {yrs} yr
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        {/* Purchase Price */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Purchase Price</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              value={purchasePrice}
              onChange={(e) => { setPurchasePrice(e.target.value); setResult(null); }}
              placeholder="400,000"
              className="w-full pl-6 pr-2 py-2 text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Down Payment */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Down Payment %</label>
          <div className="relative">
            <input
              type="number"
              step="1"
              value={downPaymentPct}
              onChange={(e) => { setDownPaymentPct(e.target.value); setResult(null); }}
              className="w-full pl-2 pr-7 py-2 text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
        </div>

        {/* Interest Rate */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Interest Rate %</label>
          <div className="relative">
            <input
              type="number"
              step="0.125"
              value={interestRate}
              onChange={(e) => { setInterestRate(e.target.value); setResult(null); }}
              className="w-full pl-2 pr-7 py-2 text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
        </div>

        {/* STR: Nightly Rate + Occupancy | LTR: Monthly Rent */}
        {mode === "str" ? (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Nightly Rate</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  value={nightlyRate}
                  onChange={(e) => { setNightlyRate(e.target.value); setResult(null); }}
                  placeholder="200"
                  className="w-full pl-6 pr-2 py-2 text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Occupancy %</label>
              <div className="relative">
                <input
                  type="number"
                  step="5"
                  value={occupancyPct}
                  onChange={(e) => { setOccupancyPct(e.target.value); setResult(null); }}
                  className="w-full pl-2 pr-7 py-2 text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>
          </>
        ) : (
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Monthly Rent</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                value={monthlyRent}
                onChange={(e) => { setMonthlyRent(e.target.value); setResult(null); }}
                placeholder="2,500"
                className="w-full pl-6 pr-2 py-2 text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Run button */}
      <button
        onClick={() => void handleRun()}
        disabled={!canRun || loading}
        className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-md shadow-indigo-200 dark:shadow-none text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
      >
        {loading ? "Computing..." : "Run Quick Test"}
      </button>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      {/* Results */}
      {result && verdict && (
        <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${verdict.bg} ${verdict.text}`}>
              {verdict.label}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {result.annual_coc.toFixed(1)}% CoC &middot; {fmtCurrency(result.monthly_cashflow)}/mo
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">Monthly CF</div>
              <div className={`text-base font-bold ${result.monthly_cashflow >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {fmtCurrency(result.monthly_cashflow)}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">Cash-on-Cash</div>
              <div className={`text-base font-bold ${result.annual_coc >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {result.annual_coc.toFixed(1)}%
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">Cap Rate</div>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100">{result.cap_rate.toFixed(1)}%</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">DSCR</div>
              <div className={`text-base font-bold ${result.dscr >= 1.25 ? "text-emerald-600" : result.dscr >= 1 ? "text-amber-600" : "text-red-500"}`}>
                {result.dscr.toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">NOI</div>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100">{fmtCurrency(result.noi)}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">Cash Invested</div>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100">{fmtCurrency(result.total_cash_invested)}</div>
            </div>
          </div>

          {/* Full Analysis button */}
          <button
            onClick={() => void handleFullAnalysis()}
            disabled={creatingFull}
            className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
          >
            {creatingFull ? "Creating..." : "Full Analysis \u2192"}
          </button>
        </div>
      )}
    </div>
  );
}
