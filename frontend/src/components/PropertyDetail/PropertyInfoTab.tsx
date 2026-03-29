import { useState, useCallback } from "react";
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

export function PropertyInfoTab({ property, onUpdate }: PropertyInfoTabProps) {
  const [form, setForm] = useState<Property>({ ...property });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      {/* Non-homestead tax warning */}
      {form.is_homestead_tax && !form.nonhomestead_annual_taxes && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Location</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => updateField("state", e.target.value)}
              maxLength={2}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
            <input
              type="text"
              value={form.zip_code}
              onChange={(e) => updateField("zip_code", e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Details */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
            <input
              type="number"
              value={form.beds || ""}
              onChange={(e) => updateField("beds", parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
            <input
              type="number"
              step="0.5"
              value={form.baths || ""}
              onChange={(e) => updateField("baths", parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sqft</label>
            <input
              type="number"
              value={form.sqft || ""}
              onChange={(e) => updateField("sqft", parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lot Sqft</label>
            <input
              type="number"
              value={form.lot_sqft ?? ""}
              onChange={(e) => updateField("lot_sqft", e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year Built</label>
            <input
              type="number"
              value={form.year_built ?? ""}
              onChange={(e) => updateField("year_built", e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
            <select
              value={form.property_type}
              onChange={(e) => updateField("property_type", e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Financials</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CurrencyInput
            label="Listing Price"
            value={form.listing_price}
            onChange={(v) => updateField("listing_price", v)}
            tooltip={TOOLTIPS.listing_price}
          />
          <CurrencyInput
            label="Estimated Value"
            value={form.estimated_value ?? 0}
            onChange={(v) => updateField("estimated_value", v || null)}
            tooltip={TOOLTIPS.estimated_value}
          />
          <CurrencyInput
            label="Annual Taxes (Listing)"
            value={form.annual_taxes}
            onChange={(v) => updateField("annual_taxes", v)}
            tooltip={TOOLTIPS.annual_taxes}
          />
          <CurrencyInput
            label="Non-Homestead Annual Taxes"
            value={form.nonhomestead_annual_taxes ?? 0}
            onChange={(v) => updateField("nonhomestead_annual_taxes", v || null)}
            tooltip={TOOLTIPS.nonhomestead_annual_taxes}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Is Homestead Tax
              <TooltipIcon text="If checked, the listing taxes shown are at the homestead rate. STR properties pay the higher nonhomestead rate." />
            </label>
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                checked={form.is_homestead_tax}
                onChange={(e) => updateField("is_homestead_tax", e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-600">
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
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source URL</label>
            <input
              type="url"
              value={form.source_url ?? ""}
              onChange={(e) => updateField("source_url", e.target.value || null)}
              placeholder="https://www.zillow.com/..."
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Notes */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Notes</h3>
        <textarea
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Free-form notes about this property..."
        />
      </section>

      {/* Save */}
      <div className="flex items-center gap-4 pt-4 border-t">
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {saved && <span className="text-green-600 text-sm font-medium">Saved successfully</span>}
      </div>
    </div>
  );
}
