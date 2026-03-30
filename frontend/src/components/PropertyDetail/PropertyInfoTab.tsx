import { useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import type { Property } from "../../types/index.ts";
import { CurrencyInput } from "../shared/CurrencyInput.tsx";
import { PercentInput } from "../shared/PercentInput.tsx";
import { TooltipIcon } from "../shared/TooltipIcon.tsx";

interface PropertyInfoTabProps {
  property: Property;
  onUpdate: (updates: Partial<Property>) => Promise<Property>;
}

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
];

const TOOLTIPS = {
  listing_price:
    "The asking price from the listing. Your purchase price (set in Financing) may differ based on your offer.",
  estimated_value:
    "Zestimate or Redfin estimate. Useful as a sanity check against asking price, but don't rely on it -- these estimates can be off by 5-15%.",
  annual_taxes:
    "This is almost certainly the homestead rate. Investment/STR properties in Vermont are taxed at the higher nonhomestead rate. See the Non-Homestead Taxes field below.",
  nonhomestead_annual_taxes:
    "The actual annual tax you'll pay as a non-owner-occupant. Look up your town's nonhomestead education tax rate on the VT Dept of Taxes website, or call the town assessor. Typically 15-40% higher than the homestead amount shown on listings.",
  hoa_monthly:
    "Monthly HOA or condo association fee. Common for condos and townhouses. Verify whether the HOA allows short-term rentals -- many don't.",
};

/** Derive which fields are "missing" (at default values) when no router state is available. */
function deriveMissingFields(property: Property): string[] {
  const missing: string[] = [];
  if (!property.address) missing.push("address");
  if (!property.city) missing.push("city");
  if (!property.state) missing.push("state");
  if (!property.zip_code) missing.push("zip_code");
  if (!property.listing_price) missing.push("listing_price");
  if (property.estimated_value == null) missing.push("estimated_value");
  if (!property.beds) missing.push("beds");
  if (!property.baths) missing.push("baths");
  if (!property.sqft) missing.push("sqft");
  if (property.lot_sqft == null) missing.push("lot_sqft");
  if (property.year_built == null) missing.push("year_built");
  if (!property.hoa_monthly) missing.push("hoa_monthly");
  if (!property.annual_taxes) missing.push("annual_taxes");
  return missing;
}

export function PropertyInfoTab({ property, onUpdate }: PropertyInfoTabProps) {
  const location = useLocation();
  const locationState = location.state as { fieldsMissing?: string[] } | null;

  const [form, setForm] = useState<Property>({ ...property });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const isScraped = Boolean(property.source_url);

  // Use router state if available, otherwise derive from defaults
  const fieldsMissing: string[] = isScraped
    ? (locationState?.fieldsMissing ?? deriveMissingFields(property))
    : [];

  const isMissing = (field: string) => fieldsMissing.includes(field);
  const isFound = (field: string) => isScraped && !isMissing(field);

  const fieldClass = (field: string) =>
    `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
      isMissing(field) ? "border-amber-300" : "border-slate-200"
    }`;

  const RedfinBadge = ({ field }: { field: string }) =>
    isFound(field) ? (
      <span className="ml-1.5 text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-medium">
        Redfin
      </span>
    ) : null;

  const MissingHelper = ({ field }: { field: string }) =>
    isMissing(field) ? (
      <p className="text-xs text-amber-500 mt-1">Not found — enter manually</p>
    ) : null;

  const updateField = useCallback(<K extends keyof Property>(key: K, value: Property[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await onUpdate(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  }, [form, onUpdate]);

  return (
    <div className="space-y-8">
      {/* Redfin scrape info banner */}
      {isScraped && !bannerDismissed && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <span className="text-indigo-500 text-lg leading-none mt-0.5">ℹ</span>
              <p className="text-sm text-indigo-800 font-medium">
                Property data populated from Redfin — review highlighted fields below
              </p>
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-indigo-400 hover:text-indigo-600 transition-colors flex-shrink-0 text-lg leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Non-homestead tax warning */}
      {form.is_homestead_tax && !form.nonhomestead_annual_taxes && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <span className="text-amber-600 text-lg">!</span>
            <div>
              <p className="font-medium text-amber-800">
                Tax Warning: Listing taxes are likely at the homestead rate
              </p>
              <p className="text-sm text-amber-700 mt-1">
                STR investment properties in Vermont are taxed at the higher nonhomestead rate.
                The taxes shown on the listing are almost always the homestead rate.
                Enter the actual nonhomestead tax amount below, or look it up on the{" "}
                <a
                  href="https://tax.vermont.gov/property/tax-rates"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  VT Dept of Taxes website
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Location */}
      <section>
        <h3 className="text-base font-semibold text-slate-900 mb-4">Location</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Address<RedfinBadge field="address" />
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              className={fieldClass("address")}
            />
            <MissingHelper field="address" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              City<RedfinBadge field="city" />
            </label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              className={fieldClass("city")}
            />
            <MissingHelper field="city" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              State<RedfinBadge field="state" />
            </label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => updateField("state", e.target.value)}
              maxLength={2}
              className={fieldClass("state")}
            />
            <MissingHelper field="state" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Zip Code<RedfinBadge field="zip_code" />
            </label>
            <input
              type="text"
              value={form.zip_code}
              onChange={(e) => updateField("zip_code", e.target.value)}
              className={fieldClass("zip_code")}
            />
            <MissingHelper field="zip_code" />
          </div>
        </div>
      </section>

      {/* Details */}
      <section>
        <h3 className="text-base font-semibold text-slate-900 mb-4">Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Bedrooms<RedfinBadge field="beds" />
            </label>
            <input
              type="number"
              value={form.beds || ""}
              onChange={(e) => updateField("beds", parseInt(e.target.value) || 0)}
              className={fieldClass("beds")}
            />
            <MissingHelper field="beds" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Bathrooms<RedfinBadge field="baths" />
            </label>
            <input
              type="number"
              step="0.5"
              value={form.baths || ""}
              onChange={(e) => updateField("baths", parseFloat(e.target.value) || 0)}
              className={fieldClass("baths")}
            />
            <MissingHelper field="baths" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sqft<RedfinBadge field="sqft" />
            </label>
            <input
              type="number"
              value={form.sqft || ""}
              onChange={(e) => updateField("sqft", parseInt(e.target.value) || 0)}
              className={fieldClass("sqft")}
            />
            <MissingHelper field="sqft" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Lot Sqft<RedfinBadge field="lot_sqft" />
            </label>
            <input
              type="number"
              value={form.lot_sqft ?? ""}
              onChange={(e) => updateField("lot_sqft", e.target.value ? parseInt(e.target.value) : null)}
              className={fieldClass("lot_sqft")}
            />
            <MissingHelper field="lot_sqft" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Year Built<RedfinBadge field="year_built" />
            </label>
            <input
              type="number"
              value={form.year_built ?? ""}
              onChange={(e) => updateField("year_built", e.target.value ? parseInt(e.target.value) : null)}
              className={fieldClass("year_built")}
            />
            <MissingHelper field="year_built" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Property Type</label>
            <select
              value={form.property_type}
              onChange={(e) => updateField("property_type", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {PROPERTY_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Financials */}
      <section>
        <h3 className="text-base font-semibold text-slate-900 mb-4">Financials</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CurrencyInput
            label="Listing Price"
            value={form.listing_price}
            onChange={(v) => updateField("listing_price", v)}
            tooltip={TOOLTIPS.listing_price}
            missing={isMissing("listing_price")}
            scraped={isFound("listing_price")}
          />
          <CurrencyInput
            label="Estimated Value"
            value={form.estimated_value ?? 0}
            onChange={(v) => updateField("estimated_value", v || null)}
            tooltip={TOOLTIPS.estimated_value}
            missing={isMissing("estimated_value")}
            scraped={isFound("estimated_value")}
          />
          <CurrencyInput
            label="Annual Taxes (Listing)"
            value={form.annual_taxes}
            onChange={(v) => updateField("annual_taxes", v)}
            tooltip={TOOLTIPS.annual_taxes}
            missing={isMissing("annual_taxes")}
            scraped={isFound("annual_taxes")}
          />
          <CurrencyInput
            label="Non-Homestead Annual Taxes"
            value={form.nonhomestead_annual_taxes ?? 0}
            onChange={(v) => updateField("nonhomestead_annual_taxes", v || null)}
            tooltip={TOOLTIPS.nonhomestead_annual_taxes}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Is Homestead Tax
              <TooltipIcon text="If checked, the listing taxes shown are at the homestead rate. STR properties pay the higher nonhomestead rate." />
            </label>
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                checked={form.is_homestead_tax}
                onChange={(e) => updateField("is_homestead_tax", e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded border-slate-300"
              />
              <span className="ml-2 text-sm text-slate-600">
                Listing taxes are at homestead rate
              </span>
            </div>
          </div>
          <PercentInput
            label="Tax Rate"
            value={form.tax_rate ?? 0}
            onChange={(v) => updateField("tax_rate", v || null)}
            tooltip="Property tax rate as a percentage of assessed value."
          />
          <CurrencyInput
            label="HOA (Monthly)"
            value={form.hoa_monthly}
            onChange={(v) => updateField("hoa_monthly", v)}
            tooltip={TOOLTIPS.hoa_monthly}
            missing={isMissing("hoa_monthly")}
            scraped={isFound("hoa_monthly")}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Source URL</label>
            <input
              type="url"
              value={form.source_url ?? ""}
              onChange={(e) => updateField("source_url", e.target.value || null)}
              placeholder="https://www.zillow.com/..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </section>

      {/* Notes */}
      <section>
        <h3 className="text-base font-semibold text-slate-900 mb-4">Notes</h3>
        <textarea
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Free-form notes about this property..."
        />
      </section>

      {/* Save */}
      <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
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
