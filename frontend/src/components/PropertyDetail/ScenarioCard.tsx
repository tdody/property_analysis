import { useState, useCallback } from "react";
import type { MortgageScenario } from "../../types/index.ts";
import { CurrencyInput } from "../shared/CurrencyInput.tsx";
import { PercentInput } from "../shared/PercentInput.tsx";
import { TooltipIcon } from "../shared/TooltipIcon.tsx";

interface ScenarioCardProps {
  scenario: MortgageScenario;
  onUpdate: (id: string, data: Partial<MortgageScenario>) => Promise<MortgageScenario>;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onActivate: (id: string) => void;
}

const LOAN_TYPES = [
  { value: "conventional", label: "Conventional" },
  { value: "dscr", label: "DSCR" },
  { value: "fha", label: "FHA" },
  { value: "cash", label: "Cash" },
];

const LOAN_TERMS = [15, 20, 25, 30];

const TOOLTIPS = {
  purchase_price:
    "Your offer price. May be above or below the listing price depending on market conditions and negotiation.",
  down_payment_pct:
    "Investment property loans typically require 20-25% down. DSCR loans usually require 20-25%. Conventional with < 20% triggers PMI.",
  down_payment_amt:
    "Auto-calculated from purchase price x down payment %. You can override this to set a specific dollar amount.",
  interest_rate:
    "Current market rate for investment property loans. Investment properties typically carry rates 0.5-0.75% higher than primary residence loans. DSCR loans run 1-2% higher than conventional.",
  loan_term:
    "Common options: 15yr (higher payment, faster equity, lower total interest), 20yr, 25yr (common for DSCR), 30yr (lowest payment, most common).",
  closing_cost_pct:
    "Typical range: 2-5% of purchase price. Includes lender fees, title insurance, appraisal, attorney fees, recording fees, and prepaid items.",
  closing_cost_amt:
    "Auto-calculated from purchase price x closing %. Override for a specific dollar amount if you have an estimate from your lender.",
  renovation_cost:
    "One-time cost to get the property STR-ready. Includes any remodeling, repairs, painting, landscaping. Even turnkey properties often need $5K-$15K in updates for STR use.",
  furniture_cost:
    "One-time cost to furnish the property for STR guests. Rule of thumb: $3K-$5K per bedroom for mid-range furnishing. A 3BR property typically runs $10K-$20K fully furnished.",
  other_upfront_costs:
    "Inspection ($300-$500), appraisal ($400-$600), home warranty, smart locks, security cameras, WiFi setup, professional photography, etc.",
  pmi_monthly:
    "Private Mortgage Insurance, required for conventional loans with < 20% down. Typically 0.5-1.0% of loan amount per year. Not applicable for DSCR or cash.",
  loan_type:
    "Conventional: Best rates, 15/20/30yr, PMI if < 20% down. DSCR: Qualifies on property income, rates ~1-2% higher. FHA: 3.5% down, requires owner-occupancy. Cash: No loan.",
  origination_points_pct:
    "Loan origination points charged by the lender at closing. Each point = 1% of the loan amount. DSCR and portfolio loans often charge 1-3 points. Conventional loans typically charge 0-1 points.",
  io_period_years:
    "Interest-only period in years. During IO, you pay only interest (no principal), resulting in a lower monthly payment. Common for DSCR loans: 1-5 years. After IO ends, payments increase to fully amortize the remaining balance over the remaining term.",
};

export function ScenarioCard({ scenario, onUpdate, onDelete, onDuplicate, onActivate }: ScenarioCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<MortgageScenario>({ ...scenario });
  const [saving, setSaving] = useState(false);

  const updateField = useCallback(<K extends keyof MortgageScenario>(key: K, value: MortgageScenario[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Linked fields: down payment
      if (key === "down_payment_pct") {
        next.down_payment_amt = Math.round(next.purchase_price * (value as number) / 100);
      } else if (key === "down_payment_amt") {
        next.down_payment_pct = next.purchase_price > 0
          ? Math.round((value as number) / next.purchase_price * 10000) / 100
          : 0;
      } else if (key === "purchase_price") {
        next.down_payment_amt = Math.round((value as number) * next.down_payment_pct / 100);
        next.closing_cost_amt = Math.round((value as number) * next.closing_cost_pct / 100);
      }
      // Linked fields: closing costs
      if (key === "closing_cost_pct") {
        next.closing_cost_amt = Math.round(next.purchase_price * (value as number) / 100);
      } else if (key === "closing_cost_amt") {
        next.closing_cost_pct = next.purchase_price > 0
          ? Math.round((value as number) / next.purchase_price * 10000) / 100
          : 0;
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await onUpdate(scenario.id, form);
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  }, [form, onUpdate, scenario.id]);

  const loanAmount = form.purchase_price - form.down_payment_amt;
  const isCash = form.loan_type === "cash";

  // Simple P&I estimate
  let monthlyPI = 0;
  if (!isCash && loanAmount > 0 && form.interest_rate > 0 && form.loan_term_years > 0) {
    const r = form.interest_rate / 100 / 12;
    const n = form.loan_term_years * 12;
    monthlyPI = loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  const originationFee = loanAmount * (form.origination_points_pct / 100);
  const totalCashToClose =
    form.down_payment_amt + form.closing_cost_amt + form.renovation_cost + form.furniture_cost + form.other_upfront_costs + originationFee;

  return (
    <div className={`rounded-2xl shadow-sm dark:shadow-slate-900/20 bg-white dark:bg-slate-800 ${scenario.is_active ? "border-l-4 border-indigo-500" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onActivate(scenario.id); }}
            className={`text-xl ${scenario.is_active ? "text-yellow-500" : "text-slate-300 dark:text-slate-600 hover:text-yellow-400"}`}
            title={scenario.is_active ? "Active scenario" : "Set as active"}
          >
            {scenario.is_active ? "\u2605" : "\u2606"}
          </button>
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">{form.name || "Untitled Scenario"}</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {LOAN_TYPES.find((t) => t.value === form.loan_type)?.label ?? form.loan_type}
              {!isCash && ` | ${form.loan_term_years}yr | ${form.interest_rate}%`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right mr-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">{isCash ? "Total Investment" : "Monthly P&I"}</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              ${isCash ? totalCashToClose.toLocaleString() : Math.round(monthlyPI).toLocaleString()}
            </p>
          </div>
          <span className="text-slate-400 dark:text-slate-500">{expanded ? "\u25B2" : "\u25BC"}</span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-4 space-y-6">
          {/* Name and loan type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Scenario Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Loan Type
                <TooltipIcon text={TOOLTIPS.loan_type} />
              </label>
              <select
                value={form.loan_type}
                onChange={(e) => updateField("loan_type", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100"
              >
                {LOAN_TYPES.map((lt) => (
                  <option key={lt.value} value={lt.value}>
                    {lt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Purchase and down payment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CurrencyInput
              label="Purchase Price"
              value={form.purchase_price}
              onChange={(v) => updateField("purchase_price", v)}
              tooltip={TOOLTIPS.purchase_price}
            />
            <PercentInput
              label="Down Payment %"
              value={form.down_payment_pct}
              onChange={(v) => updateField("down_payment_pct", v)}
              tooltip={TOOLTIPS.down_payment_pct}
            />
            <CurrencyInput
              label="Down Payment $"
              value={form.down_payment_amt}
              onChange={(v) => updateField("down_payment_amt", v)}
              tooltip={TOOLTIPS.down_payment_amt}
            />
          </div>

          {/* Rate and term (hidden for cash) */}
          {!isCash && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PercentInput
                label="Interest Rate"
                value={form.interest_rate}
                onChange={(v) => updateField("interest_rate", v)}
                tooltip={TOOLTIPS.interest_rate}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Loan Term
                  <TooltipIcon text={TOOLTIPS.loan_term} />
                </label>
                <select
                  value={form.loan_term_years}
                  onChange={(e) => updateField("loan_term_years", parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100"
                >
                  {LOAN_TERMS.map((t) => (
                    <option key={t} value={t}>
                      {t} years
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Closing costs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PercentInput
              label="Closing Costs %"
              value={form.closing_cost_pct}
              onChange={(v) => updateField("closing_cost_pct", v)}
              tooltip={TOOLTIPS.closing_cost_pct}
            />
            <CurrencyInput
              label="Closing Costs $"
              value={form.closing_cost_amt}
              onChange={(v) => updateField("closing_cost_amt", v)}
              tooltip={TOOLTIPS.closing_cost_amt}
            />
          </div>

          {/* One-time costs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CurrencyInput
              label="Renovation Cost"
              value={form.renovation_cost}
              onChange={(v) => updateField("renovation_cost", v)}
              tooltip={TOOLTIPS.renovation_cost}
            />
            <CurrencyInput
              label="Furniture Cost"
              value={form.furniture_cost}
              onChange={(v) => updateField("furniture_cost", v)}
              tooltip={TOOLTIPS.furniture_cost}
            />
            <CurrencyInput
              label="Other Upfront Costs"
              value={form.other_upfront_costs}
              onChange={(v) => updateField("other_upfront_costs", v)}
              tooltip={TOOLTIPS.other_upfront_costs}
            />
          </div>

          {/* PMI (conventional only, < 20% down) */}
          {form.loan_type === "conventional" && form.down_payment_pct < 20 && (
            <CurrencyInput
              label="PMI (Monthly)"
              value={form.pmi_monthly}
              onChange={(v) => updateField("pmi_monthly", v)}
              tooltip={TOOLTIPS.pmi_monthly}
            />
          )}

          {/* Origination Points & IO Period (dscr/portfolio loans) */}
          {(form.loan_type === "dscr" || form.loan_type === "portfolio") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PercentInput
                label="Origination Points %"
                value={form.origination_points_pct}
                onChange={(v) => updateField("origination_points_pct", v)}
                tooltip={TOOLTIPS.origination_points_pct}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  IO Period (years)
                  <TooltipIcon text={TOOLTIPS.io_period_years} />
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="1"
                  value={form.io_period_years}
                  onChange={(e) => updateField("io_period_years", parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
            <h5 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium mb-3">Summary</h5>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Loan Amount</p>
                <p className="font-semibold dark:text-slate-100">${isCash ? 0 : loanAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Monthly P&I</p>
                <p className="font-semibold dark:text-slate-100">${isCash ? 0 : Math.round(monthlyPI).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Total Cash to Close</p>
                <p className="font-semibold dark:text-slate-100">${totalCashToClose.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-md shadow-indigo-200 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => onDuplicate(scenario.id)}
              className="px-4 py-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 text-sm font-medium"
            >
              Duplicate
            </button>
            <button
              onClick={() => onDelete(scenario.id)}
              className="px-4 py-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
