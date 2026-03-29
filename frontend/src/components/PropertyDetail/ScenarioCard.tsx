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

  const totalCashToClose =
    form.down_payment_amt + form.closing_cost_amt + form.renovation_cost + form.furniture_cost + form.other_upfront_costs;

  return (
    <div className={`border rounded-lg ${scenario.is_active ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"} bg-white`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onActivate(scenario.id); }}
            className={`text-xl ${scenario.is_active ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400"}`}
            title={scenario.is_active ? "Active scenario" : "Set as active"}
          >
            {scenario.is_active ? "\u2605" : "\u2606"}
          </button>
          <div>
            <h4 className="font-semibold text-gray-900">{form.name || "Untitled Scenario"}</h4>
            <p className="text-sm text-gray-500">
              {LOAN_TYPES.find((t) => t.value === form.loan_type)?.label ?? form.loan_type}
              {!isCash && ` | ${form.loan_term_years}yr | ${form.interest_rate}%`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right mr-4">
            <p className="text-sm text-gray-500">{isCash ? "Total Investment" : "Monthly P&I"}</p>
            <p className="font-semibold text-gray-900">
              ${isCash ? totalCashToClose.toLocaleString() : Math.round(monthlyPI).toLocaleString()}
            </p>
          </div>
          <span className="text-gray-400">{expanded ? "\u25B2" : "\u25BC"}</span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t p-4 space-y-6">
          {/* Name and loan type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scenario Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Loan Type
                <TooltipIcon text={TOOLTIPS.loan_type} />
              </label>
              <select
                value={form.loan_type}
                onChange={(e) => updateField("loan_type", e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loan Term
                  <TooltipIcon text={TOOLTIPS.loan_term} />
                </label>
                <select
                  value={form.loan_term_years}
                  onChange={(e) => updateField("loan_term_years", parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h5 className="text-sm font-semibold text-gray-700 mb-3">Summary</h5>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Loan Amount</p>
                <p className="font-semibold">${isCash ? 0 : loanAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Monthly P&I</p>
                <p className="font-semibold">${isCash ? 0 : Math.round(monthlyPI).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Total Cash to Close</p>
                <p className="font-semibold">${totalCashToClose.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => onDuplicate(scenario.id)}
              className="px-4 py-2 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 text-sm font-medium"
            >
              Duplicate
            </button>
            <button
              onClick={() => onDelete(scenario.id)}
              className="px-4 py-2 text-red-600 bg-red-50 rounded-md hover:bg-red-100 text-sm font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
