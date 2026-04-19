import { useState, useCallback } from "react";
import type { STRAssumptions, LTRAssumptions } from "../../types/index.ts";
import { CurrencyInput } from "../shared/CurrencyInput.tsx";
import { PercentInput } from "../shared/PercentInput.tsx";
import { TooltipIcon } from "../shared/TooltipIcon.tsx";

interface RevenueExpensesTabProps {
  assumptions: STRAssumptions;
  onUpdate: (updates: Partial<STRAssumptions>) => Promise<STRAssumptions>;
  ltrAssumptions: LTRAssumptions | null;
  onUpdateLTR: (updates: Partial<LTRAssumptions>) => Promise<LTRAssumptions>;
  activeRentalType: 'str' | 'ltr';
  onChangeRentalType: (type: 'str' | 'ltr') => void;
}

const TOOLTIPS = {
  avg_nightly_rate:
    "Your expected average nightly rate across all seasons. Research comparable STR listings in the area on Airbnb/VRBO. Look at similar bed count, amenities, and location.",
  occupancy_pct:
    "Percentage of nights booked per year. 65% is a solid benchmark for established STR markets. New listings typically start at 40-50% and ramp up over 6-12 months. Top performers hit 75-85%.",
  cleaning_fee_per_stay:
    "Fee charged to the guest per booking. US averages by bedroom count: 1BR ~$100, 2BR ~$155, 3BR ~$175, 4BR+ ~$200-$300+. Set competitively relative to your market.",
  avg_stay_length_nights:
    "Average number of nights per booking. Urban STRs average 2-3 nights. Vacation/resort areas: 4-7 nights. Longer stays = fewer turnovers = lower cleaning costs.",
  platform_fee_pct:
    "Airbnb's split-fee model charges hosts 3% per booking. VRBO charges 5-8%. If using Airbnb's host-only model (required if using channel managers), the fee is 14-15%.",
  cleaning_cost_per_turn:
    "What you pay your cleaner each turnover. Typical ranges: 1BR $50-$90, 2BR $70-$130, 3BR $100-$150, 4BR+ $150-$300. Rule of thumb: $50/bathroom + $35/bedroom.",
  property_mgmt_pct:
    "Fee paid to a property manager as a % of net revenue. 0% if self-managing. Full-service management typically charges 20-25%. Co-hosting or partial management: 10-15%.",
  utilities_monthly:
    "Total monthly utilities: electric, gas, water, sewer, internet, trash, streaming services. STRs run higher utility costs than typical homes. Budget $150-$250 for a 1-2BR, $250-$400 for a 3-4BR.",
  insurance_annual:
    "Total annual STR insurance policy cost. Standard homeowner's insurance does NOT cover STR use. You need a specialized STR policy. Typical range: $1,500-$3,000/yr.",
  maintenance_reserve_pct:
    "Percentage of gross revenue set aside for routine maintenance (plumbing, HVAC repairs, appliance fixes). Industry standard is 5%. Alternative: 1% of property value per year.",
  capex_reserve_pct:
    "Percentage of gross revenue reserved for major capital expenditures (roof, HVAC system, water heater, appliances). 5% is standard. Some investors use 10% total (combined maintenance + capex).",
  supplies_monthly:
    "Consumables replaced regularly: toiletries, paper products, coffee, cleaning supplies, light bulbs, batteries, small linens. Budget $50-$100 for a 1-2BR, $100-$200 for a 3-4BR.",
  lawn_snow_monthly:
    "Landscaping, mowing, leaf cleanup, snow removal. Highly seasonal in Vermont. Enter a monthly average across the year, e.g., $100-$150. Set to $0 for condos.",
  other_monthly_expense:
    "Catch-all for anything not covered above: pest control, pool/hot tub maintenance, security monitoring, etc.",
  marketing_monthly:
    "Photography, listing optimization, social media, direct booking website. Initial setup $200-$500, ongoing $50-$200/mo. Set to $0 if relying solely on platform traffic.",
  software_monthly:
    "PMS (Hospitable, Guesty), dynamic pricing (PriceLabs, Beyond), channel manager, smart lock software. Typical total: $30-$80/mo.",
  accounting_annual:
    "Tax preparation, bookkeeping, financial reporting. STR taxes are more complex than W-2. Typical range: $1,000-$3,000/yr for a CPA familiar with rental properties.",
  legal_annual:
    "Legal counsel, compliance reviews, lease/contract templates, permit applications. Typical: $500-$1,500/yr. Higher in heavily regulated markets.",
  state_rooms_tax_pct:
    "Vermont Meals & Rooms Tax applied to all STR bookings of < 30 nights. Collected from the guest. If you use Airbnb or VRBO, the platform collects and remits this for you automatically.",
  str_surcharge_pct:
    "Additional surcharge on STR rents enacted by Act 183 of 2024. Collected from the guest on top of the 9% rooms tax. Also remitted by major platforms.",
  local_option_tax_pct:
    "Additional municipal tax adopted by some Vermont towns. Currently 1% where adopted (Burlington, Stowe, Killington, and others). Set to 0% if your town hasn't adopted it.",
  local_str_registration_fee:
    "Annual municipal registration fee. Not all towns require it. Examples: Stowe $100/unit/yr, Dover $125/yr. Check your specific town's requirements.",
  platform_remits_tax:
    "If Yes (Airbnb, VRBO), the platform collects all VT rooms/meals taxes from guests and remits to the state on your behalf. These taxes are pass-through, not your expense.",
  rental_delay_months:
    "Months between property acquisition and first guest booking. Covers renovation, furnishing, permits, and listing setup. During this period you pay all carrying costs with zero revenue. Default: 1 month.",
  local_gross_receipts_tax_pct:
    "Burlington, VT levies a 9% gross receipts tax on STR revenue. Unlike rooms tax, this is an operator expense that directly reduces your cashflow. Set to 0% outside Burlington.",
  damage_reserve_pct:
    "Percentage of gross revenue set aside for guest damage repairs (broken furniture, stains, wall holes). 2% is typical. Airbnb's Host Guarantee covers some damage but not everything.",
  land_value_pct:
    "Percentage of the purchase price attributable to land (non-depreciable). Typical range: 15-30%. Check your county tax assessment for the land/building split. Used for depreciation calculations.",
  property_appreciation_pct_annual:
    "Expected annual property value appreciation. US historical average is ~3-4%. Conservative: 2%. Set to 0% to exclude appreciation from ROI calculations.",
  use_seasonal_occupancy:
    "Enable peak/off-peak occupancy modeling. When on, occupancy varies by season. A weighted effective occupancy is computed for all annual metrics.",
  peak_months:
    "Number of peak-season months per year. For Vermont: June-November (summer + foliage) = 6 months. Adjust based on your market's high season.",
  peak_occupancy_pct:
    "Expected occupancy during peak months. Top STR markets see 75-90% during peak season.",
  off_peak_occupancy_pct:
    "Expected occupancy during off-peak months. Winter/shoulder months in non-ski markets typically see 30-50%.",
  marginal_tax_rate_pct:
    "Your combined marginal income tax rate (federal + state). Used to estimate after-tax cashflow. Common ranges: 22-37% federal + 0-13% state. Set to 0 to hide tax analysis.",
  revenue_growth_pct:
    "Expected annual revenue growth rate for multi-year projections. Accounts for nightly rate increases, market growth, and improved occupancy over time. US STR average: 3-5%.",
  expense_growth_pct:
    "Expected annual expense growth rate for multi-year projections. Covers inflation on operating costs (cleaning, utilities, supplies, maintenance). General inflation: 2-4%.",
  hold_period_years:
    "Number of years you plan to hold the property before selling. Used for exit analysis and IRR with exit modeling. Typical hold periods: 5-10 years.",
  selling_cost_pct:
    "Total selling costs as a percentage of sale price. Includes broker commissions (5-6%), transfer taxes, and closing costs. Typical total: 7-10%.",
  capital_gains_rate_pct:
    "Combined federal and state capital gains tax rate on the profit from selling the property. Federal long-term rate: 15-20%. Add state tax if applicable.",
  depreciation_recapture_rate_pct:
    "Tax rate on accumulated depreciation when selling. Federal depreciation recapture is taxed at 25%. This applies to the total depreciation claimed during the hold period.",
};

const SHARED_KEYS = [
  'insurance_annual', 'maintenance_reserve_pct', 'capex_reserve_pct',
  'lawn_snow_monthly', 'other_monthly_expense', 'accounting_annual',
  'legal_annual', 'land_value_pct', 'property_appreciation_pct_annual',
  'revenue_growth_pct', 'expense_growth_pct', 'marginal_tax_rate_pct',
  'hold_period_years', 'selling_cost_pct', 'capital_gains_rate_pct',
  'depreciation_recapture_rate_pct',
] as const;

export function RevenueExpensesTab({ assumptions, onUpdate, ltrAssumptions, onUpdateLTR, activeRentalType, onChangeRentalType }: RevenueExpensesTabProps) {
  const [form, setForm] = useState<STRAssumptions>({ ...assumptions });
  const [ltrForm, setLtrForm] = useState<LTRAssumptions | null>(ltrAssumptions ? { ...ltrAssumptions } : null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateField = useCallback(<K extends keyof STRAssumptions>(key: K, value: STRAssumptions[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const updateLTRField = useCallback(<K extends keyof LTRAssumptions>(key: K, value: LTRAssumptions[K]) => {
    setLtrForm((prev) => prev ? ({ ...prev, [key]: value }) : prev);
    setSaved(false);
  }, []);

  // Update a shared field in both form states
  const updateSharedField = useCallback(<K extends typeof SHARED_KEYS[number]>(key: K, value: number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setLtrForm((prev) => prev ? ({ ...prev, [key]: value }) : prev);
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      // Build shared field values from the STR form (source of truth for shared fields)
      const sharedValues: Record<string, number> = {};
      for (const key of SHARED_KEYS) {
        sharedValues[key] = form[key] as number;
      }

      // Save active type first (triggers cache recompute), then sync shared fields to the other
      if (activeRentalType === 'ltr' && ltrForm) {
        await onUpdateLTR({ ...ltrForm, ...sharedValues });
        await onUpdate(sharedValues as Partial<STRAssumptions>);
      } else {
        await onUpdate(form);
        if (ltrForm) {
          await onUpdateLTR(sharedValues as Partial<LTRAssumptions>);
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  }, [form, ltrForm, onUpdate, onUpdateLTR, activeRentalType]);

  return (
    <div className="space-y-8">
      {/* Rental Type Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-2">Rental Type:</span>
        <button
          onClick={() => onChangeRentalType('str')}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            activeRentalType === 'str'
              ? 'bg-sky-100 text-sky-700 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          STR
        </button>
        <button
          onClick={() => onChangeRentalType('ltr')}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            activeRentalType === 'ltr'
              ? 'bg-violet-100 text-violet-700 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          LTR
        </button>
      </div>

      {activeRentalType === 'ltr' && ltrForm ? (
        <LTRForm ltrForm={ltrForm} updateLTRField={updateLTRField} />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column: Revenue */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/20 p-6 space-y-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Revenue</h3>
          <CurrencyInput
            label="Avg Nightly Rate"
            value={form.avg_nightly_rate}
            onChange={(v) => updateField("avg_nightly_rate", v)}
            tooltip={TOOLTIPS.avg_nightly_rate}
          />
          {/* Occupancy: single or seasonal */}
          <div>
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                checked={form.use_seasonal_occupancy}
                onChange={(e) => updateField("use_seasonal_occupancy", e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600"
              />
              <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Use Seasonal Occupancy
                <TooltipIcon text={TOOLTIPS.use_seasonal_occupancy} />
              </span>
            </div>
            {form.use_seasonal_occupancy ? (
              <div className="space-y-4 pl-6 border-l-2 border-indigo-100">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Peak Months
                    <TooltipIcon text={TOOLTIPS.peak_months} />
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="11"
                    step="1"
                    value={form.peak_months}
                    onChange={(e) => updateField("peak_months", parseInt(e.target.value) || 6)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>
                <PercentInput
                  label="Peak Occupancy %"
                  value={form.peak_occupancy_pct}
                  onChange={(v) => updateField("peak_occupancy_pct", v)}
                  tooltip={TOOLTIPS.peak_occupancy_pct}
                />
                <PercentInput
                  label="Off-Peak Occupancy %"
                  value={form.off_peak_occupancy_pct}
                  onChange={(v) => updateField("off_peak_occupancy_pct", v)}
                  tooltip={TOOLTIPS.off_peak_occupancy_pct}
                />
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Effective Occupancy: <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {((form.peak_months * form.peak_occupancy_pct + (12 - form.peak_months) * form.off_peak_occupancy_pct) / 12).toFixed(1)}%
                  </span>
                </div>
              </div>
            ) : (
              <PercentInput
                label="Occupancy %"
                value={form.occupancy_pct}
                onChange={(v) => updateField("occupancy_pct", v)}
                tooltip={TOOLTIPS.occupancy_pct}
              />
            )}
          </div>
          <CurrencyInput
            label="Cleaning Fee per Stay"
            value={form.cleaning_fee_per_stay}
            onChange={(v) => updateField("cleaning_fee_per_stay", v)}
            tooltip={TOOLTIPS.cleaning_fee_per_stay}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Avg Stay Length (nights)
              <TooltipIcon text={TOOLTIPS.avg_stay_length_nights} />
            </label>
            <input
              type="number"
              step="0.5"
              value={form.avg_stay_length_nights || ""}
              onChange={(e) => updateField("avg_stay_length_nights", parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Rental Delay (months)
              <TooltipIcon text={TOOLTIPS.rental_delay_months} />
            </label>
            <input
              type="number"
              min="0"
              max="12"
              step="1"
              value={form.rental_delay_months ?? 1}
              onChange={(e) => updateField("rental_delay_months", parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Right column: Expenses */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/20 p-6 space-y-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Expenses</h3>

          {/* Platform & Management */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium mb-3">Platform & Management</h4>
            <div className="space-y-4">
              <PercentInput
                label="Platform Fee %"
                value={form.platform_fee_pct}
                onChange={(v) => updateField("platform_fee_pct", v)}
                tooltip={TOOLTIPS.platform_fee_pct}
              />
              <PercentInput
                label="Property Mgmt %"
                value={form.property_mgmt_pct}
                onChange={(v) => updateField("property_mgmt_pct", v)}
                tooltip={TOOLTIPS.property_mgmt_pct}
              />
            </div>
          </div>

          {/* Turnover Costs */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium mb-3">Turnover Costs</h4>
            <CurrencyInput
              label="Cleaning Cost per Turnover"
              value={form.cleaning_cost_per_turn}
              onChange={(v) => updateField("cleaning_cost_per_turn", v)}
              tooltip={TOOLTIPS.cleaning_cost_per_turn}
            />
          </div>

          {/* Monthly Fixed */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium mb-3">Monthly Fixed</h4>
            <div className="space-y-4">
              <CurrencyInput
                label="Utilities (Monthly)"
                value={form.utilities_monthly}
                onChange={(v) => updateField("utilities_monthly", v)}
                tooltip={TOOLTIPS.utilities_monthly}
              />
              <CurrencyInput
                label="Supplies (Monthly)"
                value={form.supplies_monthly}
                onChange={(v) => updateField("supplies_monthly", v)}
                tooltip={TOOLTIPS.supplies_monthly}
              />
              <CurrencyInput
                label="Marketing (Monthly)"
                value={form.marketing_monthly}
                onChange={(v) => updateField("marketing_monthly", v)}
                tooltip={TOOLTIPS.marketing_monthly}
              />
              <CurrencyInput
                label="Software / PMS (Monthly)"
                value={form.software_monthly}
                onChange={(v) => updateField("software_monthly", v)}
                tooltip={TOOLTIPS.software_monthly}
              />
            </div>
          </div>

          {/* Reserves (STR-specific) */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium mb-3">Reserves</h4>
            <div className="space-y-4">
              <PercentInput
                label="Damage Reserve %"
                value={form.damage_reserve_pct}
                onChange={(v) => updateField("damage_reserve_pct", v)}
                tooltip={TOOLTIPS.damage_reserve_pct}
              />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Shared Assumptions (always visible) */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/20 p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Shared Assumptions</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">These values apply to both STR and LTR calculations and are kept in sync.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
          {/* Reserves */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">Reserves</h4>
            <PercentInput
              label="Maintenance Reserve %"
              value={form.maintenance_reserve_pct}
              onChange={(v) => updateSharedField("maintenance_reserve_pct", v)}
              tooltip={TOOLTIPS.maintenance_reserve_pct}
            />
            <PercentInput
              label="CapEx Reserve %"
              value={form.capex_reserve_pct}
              onChange={(v) => updateSharedField("capex_reserve_pct", v)}
              tooltip={TOOLTIPS.capex_reserve_pct}
            />
          </div>

          {/* Fixed Costs */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">Fixed Costs</h4>
            <CurrencyInput
              label="Insurance (Annual)"
              value={form.insurance_annual}
              onChange={(v) => updateSharedField("insurance_annual", v)}
              tooltip={TOOLTIPS.insurance_annual}
            />
            <CurrencyInput
              label="Lawn & Snow (Monthly)"
              value={form.lawn_snow_monthly}
              onChange={(v) => updateSharedField("lawn_snow_monthly", v)}
              tooltip={TOOLTIPS.lawn_snow_monthly}
            />
            <CurrencyInput
              label="Other Monthly Expense"
              value={form.other_monthly_expense}
              onChange={(v) => updateSharedField("other_monthly_expense", v)}
              tooltip={TOOLTIPS.other_monthly_expense}
            />
            <CurrencyInput
              label="Accounting (Annual)"
              value={form.accounting_annual}
              onChange={(v) => updateSharedField("accounting_annual", v)}
              tooltip={TOOLTIPS.accounting_annual}
            />
            <CurrencyInput
              label="Legal (Annual)"
              value={form.legal_annual}
              onChange={(v) => updateSharedField("legal_annual", v)}
              tooltip={TOOLTIPS.legal_annual}
            />
          </div>

          {/* Growth & Tax */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">Growth & Tax</h4>
            <PercentInput
              label="Annual Appreciation %"
              value={form.property_appreciation_pct_annual}
              onChange={(v) => updateSharedField("property_appreciation_pct_annual", v)}
              tooltip={TOOLTIPS.property_appreciation_pct_annual}
            />
            <PercentInput
              label="Revenue Growth % / yr"
              value={form.revenue_growth_pct}
              onChange={(v) => updateSharedField("revenue_growth_pct", v)}
              tooltip={TOOLTIPS.revenue_growth_pct}
            />
            <PercentInput
              label="Expense Growth % / yr"
              value={form.expense_growth_pct}
              onChange={(v) => updateSharedField("expense_growth_pct", v)}
              tooltip={TOOLTIPS.expense_growth_pct}
            />
            <PercentInput
              label="Land Value %"
              value={form.land_value_pct}
              onChange={(v) => updateSharedField("land_value_pct", v)}
              tooltip={TOOLTIPS.land_value_pct}
            />
            <PercentInput
              label="Marginal Tax Rate %"
              value={form.marginal_tax_rate_pct}
              onChange={(v) => updateSharedField("marginal_tax_rate_pct", v)}
              tooltip={TOOLTIPS.marginal_tax_rate_pct}
            />
          </div>

          {/* Exit & IRR */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">Exit & IRR</h4>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Hold Period (years)
                <TooltipIcon text={TOOLTIPS.hold_period_years} />
              </label>
              <input
                type="number"
                min={1}
                max={30}
                step={1}
                value={form.hold_period_years || ""}
                onChange={(e) => updateSharedField("hold_period_years", parseInt(e.target.value) || 5)}
                className="w-full pl-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <PercentInput
              label="Selling Costs %"
              value={form.selling_cost_pct}
              onChange={(v) => updateSharedField("selling_cost_pct", v)}
              tooltip={TOOLTIPS.selling_cost_pct}
            />
            <PercentInput
              label="Capital Gains Rate %"
              value={form.capital_gains_rate_pct}
              onChange={(v) => updateSharedField("capital_gains_rate_pct", v)}
              tooltip={TOOLTIPS.capital_gains_rate_pct}
            />
            <PercentInput
              label="Depreciation Recapture Rate %"
              value={form.depreciation_recapture_rate_pct}
              onChange={(v) => updateSharedField("depreciation_recapture_rate_pct", v)}
              tooltip={TOOLTIPS.depreciation_recapture_rate_pct}
            />
          </div>
        </div>
      </section>

      {/* Vermont / State Taxes (STR-only) */}
      {activeRentalType === 'str' && (
      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/20 p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Vermont / State Taxes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PercentInput
            label="VT Rooms Tax %"
            value={form.state_rooms_tax_pct}
            onChange={(v) => updateField("state_rooms_tax_pct", v)}
            tooltip={TOOLTIPS.state_rooms_tax_pct}
          />
          <PercentInput
            label="STR Surcharge %"
            value={form.str_surcharge_pct}
            onChange={(v) => updateField("str_surcharge_pct", v)}
            tooltip={TOOLTIPS.str_surcharge_pct}
          />
          <PercentInput
            label="Local Option Tax %"
            value={form.local_option_tax_pct}
            onChange={(v) => updateField("local_option_tax_pct", v)}
            tooltip={TOOLTIPS.local_option_tax_pct}
          />
          <PercentInput
            label="Local Gross Receipts Tax %"
            value={form.local_gross_receipts_tax_pct}
            onChange={(v) => updateField("local_gross_receipts_tax_pct", v)}
            tooltip={TOOLTIPS.local_gross_receipts_tax_pct}
          />
          <CurrencyInput
            label="STR Registration Fee"
            value={form.local_str_registration_fee}
            onChange={(v) => updateField("local_str_registration_fee", v)}
            tooltip={TOOLTIPS.local_str_registration_fee}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Platform Remits Tax
              <TooltipIcon text={TOOLTIPS.platform_remits_tax} />
            </label>
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                checked={form.platform_remits_tax}
                onChange={(e) => updateField("platform_remits_tax", e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600"
              />
              <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">
                Platform collects and remits taxes
              </span>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Save */}
      <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-md shadow-indigo-200 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {saved && <span className="text-emerald-600 text-sm font-medium">Saved successfully</span>}
      </div>
    </div>
  );
}

const LTR_TOOLTIPS = {
  monthly_rent: "Expected monthly rent for the property. Research comparable long-term rentals in the area on Zillow, Apartments.com, or local listings.",
  lease_duration_months: "Length of the lease in months. Standard is 12 months. Shorter leases (6-9 months) may command higher rent but increase turnover costs.",
  pet_rent_monthly: "Additional monthly pet rent. Typical range: $25-$50 per pet. Set to $0 if not accepting pets.",
  late_fee_monthly: "Average monthly late fee income across all months. Most landlords charge $50-$100 per late payment; multiply by expected frequency.",
  vacancy_rate_pct: "Ongoing vacancy rate as a percentage. Accounts for time between tenants after the initial lease-up. US average: 5-8%. Hot markets: 2-4%.",
  lease_up_period_months: "Months to find the first tenant after purchase. Typically 1-2 months. Only affects Year 1 calculations.",
  property_mgmt_pct: "Property management fee as % of collected rent. 0% if self-managing. Typical full-service: 8-12%.",
  insurance_annual: "Annual landlord insurance premium. Typically $1,500-$3,000. May differ from STR insurance.",
  maintenance_reserve_pct: "Percentage of gross revenue set aside for routine maintenance. Standard: 5%. Alternative: 1% of property value per year.",
  capex_reserve_pct: "Percentage of gross revenue reserved for major capital expenditures (roof, HVAC, appliances). Standard: 5%.",
  landlord_repairs_annual: "Annual budget for landlord-responsible repairs not covered by reserves. Includes plumbing, electrical, appliance repairs.",
  tenant_turnover_cost: "Cost to prepare the unit between tenants: cleaning, painting, minor repairs, listing fees. Typical: $1,000-$3,000.",
  utilities_monthly: "Monthly utilities paid by the landlord. Many LTR tenants pay their own utilities. Common landlord-paid: water, trash, common area electric.",
  lawn_snow_monthly: "Monthly average for landscaping and snow removal. Set to $0 if tenant-responsible or for condos.",
  other_monthly_expense: "Catch-all for expenses not covered above: pest control, common area maintenance, etc.",
  accounting_annual: "Annual accounting and tax preparation costs. Typical: $500-$1,500.",
  legal_annual: "Annual legal costs: lease preparation, eviction proceedings, compliance. Typical: $500-$1,500.",
  land_value_pct: "Percentage of purchase price attributable to land (non-depreciable). Check county tax assessment. Typical: 15-30%.",
  property_appreciation_pct_annual: "Expected annual property value appreciation. US historical average: 3-4%. Conservative: 2%.",
  revenue_growth_pct: "Expected annual rent increase at lease renewal. US average: 3-5%. Tied to market conditions and lease terms.",
  expense_growth_pct: "Expected annual expense growth rate. Covers inflation on operating costs. General inflation: 2-4%.",
  marginal_tax_rate_pct: "Your combined marginal income tax rate (federal + state). Used to estimate after-tax cashflow. Set to 0 to hide tax analysis.",
};

function LTRForm({ ltrForm, updateLTRField }: {
  ltrForm: LTRAssumptions;
  updateLTRField: <K extends keyof LTRAssumptions>(key: K, value: LTRAssumptions[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left column: Revenue */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/20 p-6 space-y-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">LTR Revenue</h3>
        <CurrencyInput
          label="Monthly Rent"
          value={ltrForm.monthly_rent}
          onChange={(v) => updateLTRField("monthly_rent", v)}
          tooltip={LTR_TOOLTIPS.monthly_rent}
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Lease Duration (months)
            <TooltipIcon text={LTR_TOOLTIPS.lease_duration_months} />
          </label>
          <input
            type="number"
            min="1"
            max="36"
            step="1"
            value={ltrForm.lease_duration_months}
            onChange={(e) => updateLTRField("lease_duration_months", parseInt(e.target.value) || 12)}
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100"
          />
        </div>
        <CurrencyInput
          label="Pet Rent (Monthly)"
          value={ltrForm.pet_rent_monthly}
          onChange={(v) => updateLTRField("pet_rent_monthly", v)}
          tooltip={LTR_TOOLTIPS.pet_rent_monthly}
        />
        <CurrencyInput
          label="Late Fee Income (Monthly Avg)"
          value={ltrForm.late_fee_monthly}
          onChange={(v) => updateLTRField("late_fee_monthly", v)}
          tooltip={LTR_TOOLTIPS.late_fee_monthly}
        />
        <PercentInput
          label="Vacancy Rate %"
          value={ltrForm.vacancy_rate_pct}
          onChange={(v) => updateLTRField("vacancy_rate_pct", v)}
          tooltip={LTR_TOOLTIPS.vacancy_rate_pct}
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Lease-Up Period (months)
            <TooltipIcon text={LTR_TOOLTIPS.lease_up_period_months} />
          </label>
          <input
            type="number"
            min="0"
            max="12"
            step="1"
            value={ltrForm.lease_up_period_months}
            onChange={(e) => updateLTRField("lease_up_period_months", parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100"
          />
        </div>

      </div>

      {/* Right column: Expenses */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/20 p-6 space-y-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">LTR Expenses</h3>

        {/* Management */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium mb-3">Management</h4>
          <PercentInput
            label="Property Mgmt %"
            value={ltrForm.property_mgmt_pct}
            onChange={(v) => updateLTRField("property_mgmt_pct", v)}
            tooltip={LTR_TOOLTIPS.property_mgmt_pct}
          />
        </div>

        {/* Turnover */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium mb-3">Turnover</h4>
          <CurrencyInput
            label="Tenant Turnover Cost"
            value={ltrForm.tenant_turnover_cost}
            onChange={(v) => updateLTRField("tenant_turnover_cost", v)}
            tooltip={LTR_TOOLTIPS.tenant_turnover_cost}
          />
        </div>

        {/* Monthly Fixed */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium mb-3">Monthly Fixed</h4>
          <div className="space-y-4">
            <CurrencyInput
              label="Utilities (Monthly)"
              value={ltrForm.utilities_monthly}
              onChange={(v) => updateLTRField("utilities_monthly", v)}
              tooltip={LTR_TOOLTIPS.utilities_monthly}
            />
          </div>
        </div>

        {/* Annual (LTR-specific) */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium mb-3">Annual</h4>
          <div className="space-y-4">
            <CurrencyInput
              label="Landlord Repairs (Annual)"
              value={ltrForm.landlord_repairs_annual}
              onChange={(v) => updateLTRField("landlord_repairs_annual", v)}
              tooltip={LTR_TOOLTIPS.landlord_repairs_annual}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
