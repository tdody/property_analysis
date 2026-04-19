import { useCallback, useEffect, useState } from "react";
import type {
  STRAssumptions,
  LTRAssumptions,
  MonthlyProfileEntry,
} from "../../types/index.ts";
import {
  getProfileTemplates,
  getResults,
  getLTRResults,
} from "../../api/client.ts";
import { FormSection } from "../shared/FormSection.tsx";
import { Field } from "../shared/Field.tsx";
import { SliderField } from "../shared/SliderField.tsx";
import { Toggle } from "../shared/Toggle.tsx";
import { Segmented } from "../shared/Segmented.tsx";
import { CurrencyInput } from "../shared/CurrencyInput.tsx";
import { PercentInput } from "../shared/PercentInput.tsx";
import { SeasonalBars } from "../shared/SeasonalBars.tsx";

function derivePeakMask(peakMonths: number): boolean[] {
  const mask = Array<boolean>(12).fill(false);
  if (peakMonths <= 0) return mask;
  if (peakMonths >= 12) return mask.map(() => true);
  const start = Math.max(0, Math.min(12 - peakMonths, 7 - Math.floor(peakMonths / 2)));
  for (let i = start; i < start + peakMonths; i++) mask[i] = true;
  return mask;
}

interface RevenueExpensesTabProps {
  propertyId: string;
  assumptions: STRAssumptions;
  onUpdate: (updates: Partial<STRAssumptions>) => Promise<STRAssumptions>;
  ltrAssumptions: LTRAssumptions | null;
  onUpdateLTR: (updates: Partial<LTRAssumptions>) => Promise<LTRAssumptions>;
  activeRentalType: "str" | "ltr";
  onChangeRentalType: (type: "str" | "ltr") => void;
}

interface PreviewValues {
  revenue: number;
  expenses: number;
  cashflow: number;
}

const SHARED_KEYS = [
  "insurance_annual",
  "maintenance_reserve_pct",
  "capex_reserve_pct",
  "lawn_snow_monthly",
  "other_monthly_expense",
  "accounting_annual",
  "legal_annual",
  "land_value_pct",
  "property_appreciation_pct_annual",
  "revenue_growth_pct",
  "expense_growth_pct",
  "marginal_tax_rate_pct",
  "hold_period_years",
  "selling_cost_pct",
  "capital_gains_rate_pct",
  "depreciation_recapture_rate_pct",
] as const;

const RENTAL_OPTIONS = [
  { value: "str", label: "STR" },
  { value: "ltr", label: "LTR" },
] as const;

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatCurrency(value: number): string {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  return `${rounded < 0 ? "-" : ""}$${abs.toLocaleString("en-US")}`;
}

export function RevenueExpensesTab({
  propertyId,
  assumptions,
  onUpdate,
  ltrAssumptions,
  onUpdateLTR,
  activeRentalType,
  onChangeRentalType,
}: RevenueExpensesTabProps) {
  const [form, setForm] = useState<STRAssumptions>({ ...assumptions });
  const [ltrForm, setLtrForm] = useState<LTRAssumptions | null>(
    ltrAssumptions ? { ...ltrAssumptions } : null
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<PreviewValues | null>(null);

  const updateField = useCallback(
    <K extends keyof STRAssumptions>(key: K, value: STRAssumptions[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setSaved(false);
    },
    []
  );

  const updateLTRField = useCallback(
    <K extends keyof LTRAssumptions>(key: K, value: LTRAssumptions[K]) => {
      setLtrForm((prev) => (prev ? { ...prev, [key]: value } : prev));
      setSaved(false);
    },
    []
  );

  const updateSharedField = useCallback(
    <K extends (typeof SHARED_KEYS)[number]>(key: K, value: number) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setLtrForm((prev) => (prev ? { ...prev, [key]: value } : prev));
      setSaved(false);
    },
    []
  );

  const loadPreview = useCallback(async () => {
    try {
      if (activeRentalType === "ltr") {
        const res = await getLTRResults(propertyId);
        setPreview({
          revenue: res.revenue.effective_annual / 12,
          expenses: res.expenses.total_annual_operating / 12,
          cashflow: res.metrics.monthly_cashflow,
        });
      } else {
        const res = await getResults(propertyId);
        setPreview({
          revenue: res.revenue.net_annual / 12,
          expenses: res.expenses.total_annual_operating / 12,
          cashflow: res.metrics.monthly_cashflow,
        });
      }
    } catch {
      setPreview(null);
    }
  }, [propertyId, activeRentalType]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      const sharedValues: Record<string, number> = {};
      for (const key of SHARED_KEYS) {
        sharedValues[key] = form[key] as number;
      }
      if (activeRentalType === "ltr" && ltrForm) {
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
      void loadPreview();
    } finally {
      setSaving(false);
    }
  }, [form, ltrForm, onUpdate, onUpdateLTR, activeRentalType, loadPreview]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-10">
      {/* Main column */}
      <div className="min-w-0 space-y-10">
        <div className="flex items-center gap-3">
          <span className="caps text-ink-3">Rental type</span>
          <Segmented
            options={[...RENTAL_OPTIONS]}
            value={activeRentalType}
            onChange={(v) => onChangeRentalType(v as "str" | "ltr")}
          />
        </div>

        {activeRentalType === "str" ? (
          <STRSections
            form={form}
            updateField={updateField}
            updateSharedField={updateSharedField}
          />
        ) : ltrForm ? (
          <LTRSections
            form={ltrForm}
            updateLTRField={updateLTRField}
            strForm={form}
            updateSharedField={updateSharedField}
          />
        ) : (
          <div className="text-[14px] text-ink-3 py-6">
            LTR assumptions unavailable. Save STR assumptions first to
            initialize.
          </div>
        )}

        {/* Save */}
        <div className="flex items-center gap-4 pt-4 border-t border-rule">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="caps px-5 py-2 bg-ink text-canvas rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="caps text-accent">Saved</span>}
        </div>
      </div>

      {/* Sticky preview aside */}
      <aside className="lg:sticky lg:top-4 lg:self-start space-y-6">
        <div className="border border-rule-strong rounded p-5">
          <h4 className="caps mb-4">Live preview</h4>
          {preview ? (
            <div className="space-y-4">
              <PreviewRow label="Monthly revenue" value={preview.revenue} />
              <PreviewRow
                label="Monthly expenses"
                value={-Math.abs(preview.expenses)}
              />
              <div className="pt-3 border-t border-rule">
                <PreviewRow
                  label="Monthly cashflow"
                  value={preview.cashflow}
                  emphasis
                  tone={
                    preview.cashflow >= 0 ? "positive" : "negative"
                  }
                />
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-ink-3 leading-snug">
              Preview unavailable. Make sure you have an active scenario and
              saved assumptions.
            </p>
          )}
          <p className="text-[11px] text-ink-3 mt-4 leading-snug">
            Reflects the last saved assumptions for the active scenario.
            Re-runs on save.
          </p>
        </div>
      </aside>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  emphasis = false,
  tone,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-accent"
      : tone === "negative"
      ? "text-negative"
      : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="caps text-ink-3">{label}</span>
      <span
        className={`font-mono tabular-nums ${
          emphasis ? "text-[22px]" : "text-[16px]"
        } ${toneClass}`}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}

// --- STR sections ---------------------------------------------------------

function STRSections({
  form,
  updateField,
  updateSharedField,
}: {
  form: STRAssumptions;
  updateField: <K extends keyof STRAssumptions>(
    key: K,
    value: STRAssumptions[K]
  ) => void;
  updateSharedField: <K extends (typeof SHARED_KEYS)[number]>(
    key: K,
    value: number
  ) => void;
}) {
  const peakMask = derivePeakMask(form.peak_months);
  const occValues = Array.from({ length: 12 }, (_, i) =>
    peakMask[i] ? form.peak_occupancy_pct : form.off_peak_occupancy_pct
  );
  const weightedOcc =
    (form.peak_months * form.peak_occupancy_pct +
      (12 - form.peak_months) * form.off_peak_occupancy_pct) /
    12;

  const useSeasonal = form.use_seasonal_occupancy;
  const useMonthlyProfile = form.monthly_revenue_profile !== null;

  return (
    <>
      <FormSection
        title="Revenue"
        subtitle="Nightly pricing and guest-side fees."
      >
        <CurrencyInput
          label="Avg Nightly Rate"
          value={form.avg_nightly_rate}
          onChange={(v) => updateField("avg_nightly_rate", v)}
        />
        <CurrencyInput
          label="Cleaning Fee per Stay"
          value={form.cleaning_fee_per_stay}
          onChange={(v) => updateField("cleaning_fee_per_stay", v)}
        />
        <Field
          label="Avg Stay Length (nights)"
          type="number"
          step="0.5"
          value={form.avg_stay_length_nights || ""}
          onChange={(e) =>
            updateField(
              "avg_stay_length_nights",
              parseFloat(e.target.value) || 0
            )
          }
        />
        <Field
          label="Rental Delay (months)"
          type="number"
          min={0}
          max={12}
          step={1}
          value={form.rental_delay_months ?? 1}
          onChange={(e) =>
            updateField("rental_delay_months", parseInt(e.target.value) || 0)
          }
        />
        <PercentInput
          label="Platform Fee %"
          value={form.platform_fee_pct}
          onChange={(v) => updateField("platform_fee_pct", v)}
        />
        <PercentInput
          label="Property Mgmt %"
          value={form.property_mgmt_pct}
          onChange={(v) => updateField("property_mgmt_pct", v)}
        />
      </FormSection>

      {/* Occupancy panel */}
      <section className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-8">
        <div>
          <h3 className="font-serif text-[22px] leading-none mb-2">
            Occupancy
          </h3>
          <p className="text-ink-3 text-[13px] leading-snug">
            Pick a flat rate, a peak / off-peak split, or month-level
            overrides.
          </p>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <label className="field-label">Use seasonal occupancy</label>
              <p className="text-[12px] text-ink-3 mt-1 leading-snug">
                Blend peak + off-peak occupancy through the year.
              </p>
            </div>
            <Toggle
              value={useSeasonal}
              onChange={(v) => updateField("use_seasonal_occupancy", v)}
              label="Use seasonal occupancy"
            />
          </div>

          {!useSeasonal ? (
            <SliderField
              label="Annual Occupancy"
              value={form.occupancy_pct}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={(v) => updateField("occupancy_pct", v)}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                <SliderField
                  label="Peak Months"
                  value={form.peak_months}
                  min={0}
                  max={12}
                  step={1}
                  suffix=" mo"
                  onChange={(v) => updateField("peak_months", v)}
                />
                <SliderField
                  label="Weighted Effective"
                  value={Math.round(weightedOcc * 10) / 10}
                  min={0}
                  max={100}
                  step={0.1}
                  suffix="%"
                  disabled
                  onChange={() => undefined}
                />
                <SliderField
                  label="Peak Occupancy"
                  value={form.peak_occupancy_pct}
                  min={0}
                  max={100}
                  step={1}
                  suffix="%"
                  onChange={(v) => updateField("peak_occupancy_pct", v)}
                />
                <SliderField
                  label="Off-Peak Occupancy"
                  value={form.off_peak_occupancy_pct}
                  min={0}
                  max={100}
                  step={1}
                  suffix="%"
                  onChange={(v) => updateField("off_peak_occupancy_pct", v)}
                />
              </div>
              <SeasonalBars
                values={occValues}
                peak={peakMask}
                valueSuffix="%"
                ariaLabel="Occupancy by month"
              />
              <div className="flex gap-4 text-[11px] text-ink-3 mt-1">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 h-2 bg-accent rounded-sm" />
                  Peak
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 h-2 bg-ink-3 opacity-50 rounded-sm" />
                  Off-peak
                </span>
              </div>
            </>
          )}

          <details className="border-t border-rule pt-4">
            <summary className="caps cursor-pointer text-ink-2 hover:text-ink select-none">
              Advanced · monthly rate &amp; occupancy overrides
            </summary>
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <p className="text-[12px] text-ink-3 leading-snug">
                  Overrides the flat or seasonal model with per-month
                  values.
                </p>
                <Toggle
                  value={useMonthlyProfile}
                  onChange={(v) => {
                    if (v) {
                      const defaultProfile: MonthlyProfileEntry[] =
                        Array.from({ length: 12 }, (_, i) => ({
                          month: i + 1,
                          nightly_rate: form.avg_nightly_rate,
                          occupancy_pct: form.occupancy_pct,
                        }));
                      updateField("monthly_revenue_profile", defaultProfile);
                      updateField("profile_template_name", "Custom");
                    } else {
                      updateField("monthly_revenue_profile", null);
                      updateField("profile_template_name", null);
                    }
                  }}
                  label="Use monthly overrides"
                />
              </div>
              {useMonthlyProfile && form.monthly_revenue_profile && (
                <MonthlyProfileEditor
                  profile={form.monthly_revenue_profile}
                  templateName={form.profile_template_name}
                  onProfileChange={(p) =>
                    updateField("monthly_revenue_profile", p)
                  }
                  onTemplateChange={(n) =>
                    updateField("profile_template_name", n)
                  }
                />
              )}
            </div>
          </details>
        </div>
      </section>

      <FormSection
        title="Operating Expenses"
        subtitle="Variable and monthly fixed costs."
      >
        <CurrencyInput
          label="Cleaning Cost per Turn"
          value={form.cleaning_cost_per_turn}
          onChange={(v) => updateField("cleaning_cost_per_turn", v)}
        />
        <CurrencyInput
          label="Utilities (Monthly)"
          value={form.utilities_monthly}
          onChange={(v) => updateField("utilities_monthly", v)}
        />
        <CurrencyInput
          label="Supplies (Monthly)"
          value={form.supplies_monthly}
          onChange={(v) => updateField("supplies_monthly", v)}
        />
        <CurrencyInput
          label="Marketing (Monthly)"
          value={form.marketing_monthly}
          onChange={(v) => updateField("marketing_monthly", v)}
        />
        <CurrencyInput
          label="Software / PMS (Monthly)"
          value={form.software_monthly}
          onChange={(v) => updateField("software_monthly", v)}
        />
        <CurrencyInput
          label="Lawn &amp; Snow (Monthly)"
          value={form.lawn_snow_monthly}
          onChange={(v) => updateSharedField("lawn_snow_monthly", v)}
        />
        <CurrencyInput
          label="Other Monthly"
          value={form.other_monthly_expense}
          onChange={(v) => updateSharedField("other_monthly_expense", v)}
        />
        <CurrencyInput
          label="Insurance (Annual)"
          value={form.insurance_annual}
          onChange={(v) => updateSharedField("insurance_annual", v)}
        />
      </FormSection>

      <FormSection
        title="Reserves"
        subtitle="Percent of gross revenue set aside."
        contentClassName="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5"
      >
        <SliderField
          label="Maintenance"
          value={form.maintenance_reserve_pct}
          min={0}
          max={15}
          step={0.5}
          suffix="%"
          onChange={(v) => updateSharedField("maintenance_reserve_pct", v)}
        />
        <SliderField
          label="CapEx"
          value={form.capex_reserve_pct}
          min={0}
          max={15}
          step={0.5}
          suffix="%"
          onChange={(v) => updateSharedField("capex_reserve_pct", v)}
        />
        <SliderField
          label="Damage"
          value={form.damage_reserve_pct}
          min={0}
          max={10}
          step={0.5}
          suffix="%"
          onChange={(v) => updateField("damage_reserve_pct", v)}
        />
      </FormSection>

      <FormSection
        title="Professional Fees"
        subtitle="Accounting and legal costs."
      >
        <CurrencyInput
          label="Accounting (Annual)"
          value={form.accounting_annual}
          onChange={(v) => updateSharedField("accounting_annual", v)}
        />
        <CurrencyInput
          label="Legal (Annual)"
          value={form.legal_annual}
          onChange={(v) => updateSharedField("legal_annual", v)}
        />
      </FormSection>

      {/* VT Tax collapsible (STR only) */}
      <details className="border border-rule-strong rounded p-5 open:pb-6">
        <summary className="caps cursor-pointer text-ink flex items-center justify-between select-none">
          <span>Vermont tax configuration</span>
          <span className="text-[11px] text-ink-3 font-normal normal-case tracking-normal">
            Rooms tax, surcharge, local options
          </span>
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 mt-5">
          <PercentInput
            label="VT Rooms Tax %"
            value={form.state_rooms_tax_pct}
            onChange={(v) => updateField("state_rooms_tax_pct", v)}
          />
          <PercentInput
            label="STR Surcharge %"
            value={form.str_surcharge_pct}
            onChange={(v) => updateField("str_surcharge_pct", v)}
          />
          <PercentInput
            label="Local Option Tax %"
            value={form.local_option_tax_pct}
            onChange={(v) => updateField("local_option_tax_pct", v)}
          />
          <PercentInput
            label="Local Gross Receipts Tax %"
            value={form.local_gross_receipts_tax_pct}
            onChange={(v) => updateField("local_gross_receipts_tax_pct", v)}
          />
          <CurrencyInput
            label="STR Registration Fee"
            value={form.local_str_registration_fee}
            onChange={(v) => updateField("local_str_registration_fee", v)}
          />
          <div className="flex items-center justify-between gap-3">
            <div>
              <label className="field-label">Platform Remits Tax</label>
              <p className="text-[12px] text-ink-3 mt-1 leading-snug">
                Airbnb / VRBO collect &amp; remit on your behalf.
              </p>
            </div>
            <Toggle
              value={form.platform_remits_tax}
              onChange={(v) => updateField("platform_remits_tax", v)}
              label="Platform remits tax"
            />
          </div>
        </div>
      </details>

      {/* Growth & Exit collapsible (shared fields) */}
      <details className="border border-rule-strong rounded p-5 open:pb-6">
        <summary className="caps cursor-pointer text-ink flex items-center justify-between select-none">
          <span>Growth &amp; exit assumptions</span>
          <span className="text-[11px] text-ink-3 font-normal normal-case tracking-normal">
            Shared across STR / LTR
          </span>
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 mt-5">
          <PercentInput
            label="Annual Appreciation %"
            value={form.property_appreciation_pct_annual}
            onChange={(v) =>
              updateSharedField("property_appreciation_pct_annual", v)
            }
          />
          <PercentInput
            label="Revenue Growth %"
            value={form.revenue_growth_pct}
            onChange={(v) => updateSharedField("revenue_growth_pct", v)}
          />
          <PercentInput
            label="Expense Growth %"
            value={form.expense_growth_pct}
            onChange={(v) => updateSharedField("expense_growth_pct", v)}
          />
          <PercentInput
            label="Land Value %"
            value={form.land_value_pct}
            onChange={(v) => updateSharedField("land_value_pct", v)}
          />
          <PercentInput
            label="Marginal Tax Rate %"
            value={form.marginal_tax_rate_pct}
            onChange={(v) => updateSharedField("marginal_tax_rate_pct", v)}
          />
          <Field
            label="Hold Period (years)"
            type="number"
            min={1}
            max={30}
            step={1}
            value={form.hold_period_years || ""}
            onChange={(e) =>
              updateSharedField(
                "hold_period_years",
                parseInt(e.target.value) || 5
              )
            }
          />
          <PercentInput
            label="Selling Costs %"
            value={form.selling_cost_pct}
            onChange={(v) => updateSharedField("selling_cost_pct", v)}
          />
          <PercentInput
            label="Capital Gains Rate %"
            value={form.capital_gains_rate_pct}
            onChange={(v) => updateSharedField("capital_gains_rate_pct", v)}
          />
          <PercentInput
            label="Depreciation Recapture %"
            value={form.depreciation_recapture_rate_pct}
            onChange={(v) =>
              updateSharedField("depreciation_recapture_rate_pct", v)
            }
          />
        </div>
      </details>
    </>
  );
}

// --- LTR sections ---------------------------------------------------------

function LTRSections({
  form,
  updateLTRField,
  strForm,
  updateSharedField,
}: {
  form: LTRAssumptions;
  updateLTRField: <K extends keyof LTRAssumptions>(
    key: K,
    value: LTRAssumptions[K]
  ) => void;
  strForm: STRAssumptions;
  updateSharedField: <K extends (typeof SHARED_KEYS)[number]>(
    key: K,
    value: number
  ) => void;
}) {
  return (
    <>
      <FormSection
        title="Revenue"
        subtitle="Rent, duration, and pass-through fees."
      >
        <CurrencyInput
          label="Monthly Rent"
          value={form.monthly_rent}
          onChange={(v) => updateLTRField("monthly_rent", v)}
        />
        <Field
          label="Lease Duration (months)"
          type="number"
          min={1}
          max={36}
          step={1}
          value={form.lease_duration_months}
          onChange={(e) =>
            updateLTRField(
              "lease_duration_months",
              parseInt(e.target.value) || 12
            )
          }
        />
        <CurrencyInput
          label="Pet Rent (Monthly)"
          value={form.pet_rent_monthly}
          onChange={(v) => updateLTRField("pet_rent_monthly", v)}
        />
        <CurrencyInput
          label="Late Fee Income (Monthly avg)"
          value={form.late_fee_monthly}
          onChange={(v) => updateLTRField("late_fee_monthly", v)}
        />
        <PercentInput
          label="Vacancy Rate %"
          value={form.vacancy_rate_pct}
          onChange={(v) => updateLTRField("vacancy_rate_pct", v)}
        />
        <Field
          label="Lease-Up Period (months)"
          type="number"
          min={0}
          max={12}
          step={1}
          value={form.lease_up_period_months}
          onChange={(e) =>
            updateLTRField(
              "lease_up_period_months",
              parseInt(e.target.value) || 0
            )
          }
        />
      </FormSection>

      <FormSection
        title="Operating Expenses"
        subtitle="Management and ongoing costs."
      >
        <PercentInput
          label="Property Mgmt %"
          value={form.property_mgmt_pct}
          onChange={(v) => updateLTRField("property_mgmt_pct", v)}
        />
        <CurrencyInput
          label="Tenant Turnover Cost"
          value={form.tenant_turnover_cost}
          onChange={(v) => updateLTRField("tenant_turnover_cost", v)}
        />
        <CurrencyInput
          label="Utilities (Monthly)"
          value={form.utilities_monthly}
          onChange={(v) => updateLTRField("utilities_monthly", v)}
        />
        <CurrencyInput
          label="Landlord Repairs (Annual)"
          value={form.landlord_repairs_annual}
          onChange={(v) => updateLTRField("landlord_repairs_annual", v)}
        />
        <CurrencyInput
          label="Insurance (Annual)"
          value={form.insurance_annual}
          onChange={(v) => updateSharedField("insurance_annual", v)}
        />
        <CurrencyInput
          label="Lawn &amp; Snow (Monthly)"
          value={form.lawn_snow_monthly}
          onChange={(v) => updateSharedField("lawn_snow_monthly", v)}
        />
        <CurrencyInput
          label="Other Monthly"
          value={form.other_monthly_expense}
          onChange={(v) => updateSharedField("other_monthly_expense", v)}
        />
        <CurrencyInput
          label="Accounting (Annual)"
          value={form.accounting_annual}
          onChange={(v) => updateSharedField("accounting_annual", v)}
        />
      </FormSection>

      <FormSection
        title="Reserves"
        subtitle="Percent of gross revenue set aside."
        contentClassName="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5"
      >
        <SliderField
          label="Maintenance"
          value={form.maintenance_reserve_pct}
          min={0}
          max={15}
          step={0.5}
          suffix="%"
          onChange={(v) => updateSharedField("maintenance_reserve_pct", v)}
        />
        <SliderField
          label="CapEx"
          value={form.capex_reserve_pct}
          min={0}
          max={15}
          step={0.5}
          suffix="%"
          onChange={(v) => updateSharedField("capex_reserve_pct", v)}
        />
      </FormSection>

      <FormSection title="Professional Fees" subtitle="Legal counsel.">
        <CurrencyInput
          label="Legal (Annual)"
          value={form.legal_annual}
          onChange={(v) => updateSharedField("legal_annual", v)}
        />
      </FormSection>

      <details className="border border-rule-strong rounded p-5 open:pb-6">
        <summary className="caps cursor-pointer text-ink flex items-center justify-between select-none">
          <span>Growth &amp; exit assumptions</span>
          <span className="text-[11px] text-ink-3 font-normal normal-case tracking-normal">
            Shared across STR / LTR
          </span>
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 mt-5">
          <PercentInput
            label="Annual Appreciation %"
            value={form.property_appreciation_pct_annual}
            onChange={(v) =>
              updateSharedField("property_appreciation_pct_annual", v)
            }
          />
          <PercentInput
            label="Revenue Growth %"
            value={form.revenue_growth_pct}
            onChange={(v) => updateSharedField("revenue_growth_pct", v)}
          />
          <PercentInput
            label="Expense Growth %"
            value={form.expense_growth_pct}
            onChange={(v) => updateSharedField("expense_growth_pct", v)}
          />
          <PercentInput
            label="Land Value %"
            value={form.land_value_pct}
            onChange={(v) => updateSharedField("land_value_pct", v)}
          />
          <PercentInput
            label="Marginal Tax Rate %"
            value={form.marginal_tax_rate_pct}
            onChange={(v) => updateSharedField("marginal_tax_rate_pct", v)}
          />
          <Field
            label="Hold Period (years)"
            type="number"
            min={1}
            max={30}
            step={1}
            value={strForm.hold_period_years || ""}
            onChange={(e) =>
              updateSharedField(
                "hold_period_years",
                parseInt(e.target.value) || 5
              )
            }
          />
          <PercentInput
            label="Selling Costs %"
            value={strForm.selling_cost_pct}
            onChange={(v) => updateSharedField("selling_cost_pct", v)}
          />
          <PercentInput
            label="Capital Gains Rate %"
            value={strForm.capital_gains_rate_pct}
            onChange={(v) => updateSharedField("capital_gains_rate_pct", v)}
          />
          <PercentInput
            label="Depreciation Recapture %"
            value={strForm.depreciation_recapture_rate_pct}
            onChange={(v) =>
              updateSharedField("depreciation_recapture_rate_pct", v)
            }
          />
        </div>
      </details>
    </>
  );
}

// --- Monthly Profile Editor (preserved) -----------------------------------

function MonthlyProfileEditor({
  profile,
  templateName,
  onProfileChange,
  onTemplateChange,
}: {
  profile: MonthlyProfileEntry[];
  templateName: string | null;
  onProfileChange: (profile: MonthlyProfileEntry[]) => void;
  onTemplateChange: (name: string | null) => void;
}) {
  const [templates, setTemplates] = useState<
    Record<string, MonthlyProfileEntry[] | null>
  >({});

  useEffect(() => {
    getProfileTemplates()
      .then(setTemplates)
      .catch(() => undefined);
  }, []);

  const handleTemplateSelect = (name: string) => {
    const tpl = templates[name];
    if (tpl === null || tpl === undefined) return;
    onProfileChange([...tpl]);
    onTemplateChange(name);
  };

  const updateEntry = (
    month: number,
    field: "nightly_rate" | "occupancy_pct",
    value: number
  ) => {
    const updated = profile.map((e) =>
      e.month === month ? { ...e, [field]: value } : e
    );
    onProfileChange(updated);
    onTemplateChange("Custom");
  };

  const maxRate = Math.max(...profile.map((e) => e.nightly_rate), 1);
  const maxOcc = 100;
  const chartH = 72;
  const barW = 10;
  const gap = 4;
  const totalW = 12 * (barW * 2 + gap) + 11 * gap + 24;

  const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const totalOccupied = profile.reduce(
    (sum, e) => sum + (e.occupancy_pct / 100) * DAYS[e.month - 1],
    0
  );
  const effectiveOcc = (totalOccupied / 365) * 100;

  return (
    <div className="space-y-4 pl-5 border-l border-rule">
      <div className="flex items-center gap-3">
        <label className="caps text-ink-3">Template</label>
        <select
          value={templateName || "Custom"}
          onChange={(e) => handleTemplateSelect(e.target.value)}
          className="text-[13px] bg-transparent border-0 border-b border-rule-strong focus:border-accent outline-none text-ink py-0.5 cursor-pointer"
        >
          <option value="Custom">Custom</option>
          {Object.keys(templates)
            .filter((k) => k !== "flat")
            .map((name) => (
              <option key={name} value={name}>
                {name.replace(/_/g, " ").replace(/\bvt\b/g, "VT")}
              </option>
            ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <svg width={totalW} height={chartH + 18} className="block">
          {profile.map((e, i) => {
            const x = i * (barW * 2 + gap + gap) + 12;
            const rateH = (e.nightly_rate / maxRate) * chartH;
            const occH = (e.occupancy_pct / maxOcc) * chartH;
            return (
              <g key={e.month}>
                <rect
                  x={x}
                  y={chartH - rateH}
                  width={barW}
                  height={rateH}
                  rx={2}
                  fill="var(--accent)"
                  opacity={0.85}
                />
                <rect
                  x={x + barW}
                  y={chartH - occH}
                  width={barW}
                  height={occH}
                  rx={2}
                  fill="var(--ink-2)"
                  opacity={0.7}
                />
                <text
                  x={x + barW}
                  y={chartH + 12}
                  textAnchor="middle"
                  fill="var(--ink-3)"
                  style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
                >
                  {MONTH_NAMES[i].slice(0, 1)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex gap-4 text-[11px] text-ink-3 mt-1">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-2 bg-accent rounded-sm" />
            Rate
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-2 bg-ink-2 opacity-70 rounded-sm" />
            Occupancy
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-ink-3">
              <th className="text-left py-1 pr-2 font-medium caps">Month</th>
              <th className="text-right py-1 px-2 font-medium caps">
                Nightly ($)
              </th>
              <th className="text-right py-1 pl-2 font-medium caps">
                Occupancy (%)
              </th>
            </tr>
          </thead>
          <tbody>
            {profile.map((e) => (
              <tr key={e.month} className="border-t border-rule">
                <td className="py-1 pr-2 text-ink font-medium">
                  {MONTH_NAMES[e.month - 1]}
                </td>
                <td className="py-1 px-2">
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={e.nightly_rate}
                    onChange={(ev) =>
                      updateEntry(
                        e.month,
                        "nightly_rate",
                        parseFloat(ev.target.value) || 0
                      )
                    }
                    className="w-24 px-2 py-1 text-right border-b border-rule-strong focus:border-accent focus:outline-none bg-transparent font-mono tabular-nums"
                  />
                </td>
                <td className="py-1 pl-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={e.occupancy_pct}
                    onChange={(ev) =>
                      updateEntry(
                        e.month,
                        "occupancy_pct",
                        parseFloat(ev.target.value) || 0
                      )
                    }
                    className="w-20 px-2 py-1 text-right border-b border-rule-strong focus:border-accent focus:outline-none bg-transparent font-mono tabular-nums"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[13px] text-ink-3">
        Effective Occupancy:{" "}
        <span className="font-mono tabular-nums text-ink">
          {effectiveOcc.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
