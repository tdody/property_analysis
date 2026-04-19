import { useCallback, useState } from "react";
import type { Property } from "../../types/index.ts";
import { FormSection } from "../shared/FormSection.tsx";
import { Field } from "../shared/Field.tsx";
import type { FieldTag } from "../shared/Field.tsx";
import { CurrencyInput } from "../shared/CurrencyInput.tsx";
import { PercentInput } from "../shared/PercentInput.tsx";
import { Toggle } from "../shared/Toggle.tsx";

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
    "Zestimate or Redfin estimate. Useful as a sanity check against asking price, but don't rely on it — these estimates can be off by 5-15%.",
  annual_taxes:
    "This is almost certainly the homestead rate. Investment/STR properties in Vermont are taxed at the higher nonhomestead rate. See the Non-Homestead Taxes field below.",
  nonhomestead_annual_taxes:
    "The actual annual tax you'll pay as a non-owner-occupant. Look up your town's nonhomestead education tax rate on the VT Dept of Taxes website, or call the town assessor. Typically 15-40% higher than the homestead amount shown on listings.",
  hoa_monthly:
    "Monthly HOA or condo association fee. Common for condos and townhouses. Verify whether the HOA allows short-term rentals — many don't.",
};

const IMPORT_STATUS_FIELDS: Array<{ key: string; label: string }> = [
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip_code", label: "Zip" },
  { key: "beds", label: "Beds" },
  { key: "baths", label: "Baths" },
  { key: "sqft", label: "Sqft" },
  { key: "lot_sqft", label: "Lot sqft" },
  { key: "year_built", label: "Year built" },
  { key: "listing_price", label: "Listing price" },
  { key: "estimated_value", label: "Estimated value" },
  { key: "annual_taxes", label: "Annual taxes" },
  { key: "hoa_monthly", label: "HOA" },
];

function getFieldTag(
  field: string,
  currentValue: string | number | boolean | null | undefined,
  snapshot: Record<string, string | number | null> | null
): FieldTag {
  if (!snapshot) return null;
  if (!(field in snapshot)) return "missing";
  if (String(snapshot[field]) === String(currentValue)) return "redfin";
  return "redfin-edited";
}

function statusLabel(tag: FieldTag): { text: string; className: string } {
  switch (tag) {
    case "redfin":
      return { text: "Redfin", className: "text-accent" };
    case "redfin-edited":
      return { text: "Edited", className: "text-ink-2" };
    case "missing":
      return { text: "Manual", className: "text-warn" };
    default:
      return { text: "—", className: "text-ink-3" };
  }
}

export function PropertyInfoTab({ property, onUpdate }: PropertyInfoTabProps) {
  const [form, setForm] = useState<Property>({ ...property });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [taxBannerDismissed, setTaxBannerDismissed] = useState(false);

  const snapshot = property.scraped_snapshot;

  const tag = (field: string): FieldTag =>
    getFieldTag(
      field,
      form[field as keyof Property] as string | number | boolean | null | undefined,
      snapshot
    );

  const updateField = useCallback(
    <K extends keyof Property>(key: K, value: Property[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setSaved(false);
    },
    []
  );

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

  const showTaxWarning =
    form.is_homestead_tax &&
    !form.nonhomestead_annual_taxes &&
    !taxBannerDismissed;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10">
      {/* Main column */}
      <div className="space-y-10 min-w-0">
        {showTaxWarning && (
          <div className="border border-warn bg-warn-soft rounded p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="text-warn text-lg leading-none mt-0.5" aria-hidden>
                !
              </span>
              <div>
                <p className="caps text-warn mb-1">Tax warning</p>
                <p className="text-[13px] text-ink-2 leading-snug">
                  Listing taxes are likely at the homestead rate. STR investment
                  properties in Vermont are taxed at the higher nonhomestead
                  rate. Enter the actual nonhomestead amount below, or look it
                  up on the{" "}
                  <a
                    href="https://tax.vermont.gov/property/tax-rates"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline"
                  >
                    VT Dept of Taxes
                  </a>
                  .
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTaxBannerDismissed(true)}
              className="text-ink-3 hover:text-ink text-lg leading-none shrink-0"
              aria-label="Dismiss tax warning"
            >
              ×
            </button>
          </div>
        )}

        <FormSection
          title="Location"
          subtitle="Street address and jurisdiction."
        >
          <Field
            label="Address"
            type="text"
            value={form.address}
            onChange={(e) => updateField("address", e.target.value)}
            tag={tag("address")}
          />
          <Field
            label="City"
            type="text"
            value={form.city}
            onChange={(e) => updateField("city", e.target.value)}
            tag={tag("city")}
          />
          <Field
            label="State"
            type="text"
            value={form.state}
            maxLength={2}
            onChange={(e) => updateField("state", e.target.value)}
            tag={tag("state")}
          />
          <Field
            label="Zip Code"
            type="text"
            value={form.zip_code}
            onChange={(e) => updateField("zip_code", e.target.value)}
            tag={tag("zip_code")}
          />
        </FormSection>

        <FormSection
          title="Details"
          subtitle="Size and build."
          contentClassName="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5"
        >
          <Field
            label="Bedrooms"
            type="number"
            value={form.beds || ""}
            onChange={(e) =>
              updateField("beds", parseInt(e.target.value) || 0)
            }
            tag={tag("beds")}
          />
          <Field
            label="Bathrooms"
            type="number"
            step="0.5"
            value={form.baths || ""}
            onChange={(e) =>
              updateField("baths", parseFloat(e.target.value) || 0)
            }
            tag={tag("baths")}
          />
          <Field
            label="Sqft"
            type="number"
            value={form.sqft || ""}
            onChange={(e) =>
              updateField("sqft", parseInt(e.target.value) || 0)
            }
            tag={tag("sqft")}
          />
          <Field
            label="Lot Sqft"
            type="number"
            value={form.lot_sqft ?? ""}
            onChange={(e) =>
              updateField(
                "lot_sqft",
                e.target.value ? parseInt(e.target.value) : null
              )
            }
            tag={tag("lot_sqft")}
          />
          <Field
            label="Year Built"
            type="number"
            value={form.year_built ?? ""}
            onChange={(e) =>
              updateField(
                "year_built",
                e.target.value ? parseInt(e.target.value) : null
              )
            }
            tag={tag("year_built")}
          />
          <div>
            <label className="field-label">Property Type</label>
            <select
              value={form.property_type}
              onChange={(e) => updateField("property_type", e.target.value)}
              className="field cursor-pointer"
            >
              {PROPERTY_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label}
                </option>
              ))}
            </select>
          </div>
        </FormSection>

        <FormSection title="Financials" subtitle="Price, taxes, carrying costs.">
          <CurrencyInput
            label="Listing Price"
            value={form.listing_price}
            onChange={(v) => updateField("listing_price", v)}
            tooltip={TOOLTIPS.listing_price}
            tag={tag("listing_price")}
          />
          <CurrencyInput
            label="Estimated Value"
            value={form.estimated_value ?? 0}
            onChange={(v) => updateField("estimated_value", v || null)}
            tooltip={TOOLTIPS.estimated_value}
            tag={tag("estimated_value")}
          />
          <CurrencyInput
            label="Annual Taxes (Listing)"
            value={form.annual_taxes}
            onChange={(v) => updateField("annual_taxes", v)}
            tooltip={TOOLTIPS.annual_taxes}
            tag={tag("annual_taxes")}
          />
          <CurrencyInput
            label="Non-Homestead Annual Taxes"
            value={form.nonhomestead_annual_taxes ?? 0}
            onChange={(v) =>
              updateField("nonhomestead_annual_taxes", v || null)
            }
            tooltip={TOOLTIPS.nonhomestead_annual_taxes}
          />
          <div className="flex items-center justify-between gap-3">
            <div>
              <label className="field-label">Listing at Homestead Rate</label>
              <p className="text-[12px] text-ink-3 mt-1 leading-snug">
                STR properties pay the higher nonhomestead rate.
              </p>
            </div>
            <Toggle
              value={form.is_homestead_tax}
              onChange={(v) => updateField("is_homestead_tax", v)}
              label="Listing at homestead rate"
            />
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
            tag={tag("hoa_monthly")}
          />
          <Field
            label="Source URL"
            type="url"
            value={form.source_url ?? ""}
            placeholder="https://www.redfin.com/…"
            onChange={(e) =>
              updateField("source_url", e.target.value || null)
            }
          />
        </FormSection>

        <FormSection
          title="Notes"
          subtitle="Free-form notes about this property."
          contentClassName=""
        >
          <textarea
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            rows={5}
            className="field resize-y"
            placeholder="Anything worth remembering for this deal…"
          />
        </FormSection>

        <div className="flex items-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="caps px-5 py-2 bg-ink text-canvas rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span className="caps text-accent">Saved</span>
          )}
        </div>
      </div>

      {/* Aside */}
      <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
        <div className="border border-rule-strong rounded p-5">
          <h4 className="caps mb-3">Import status</h4>
          {snapshot ? (
            <ul className="space-y-2 text-[13px]">
              {IMPORT_STATUS_FIELDS.map(({ key, label }) => {
                const t = tag(key);
                const { text, className } = statusLabel(t);
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-ink">{label}</span>
                    <span className={`font-mono text-[12px] ${className}`}>
                      {text}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-3 leading-snug">
              No import data — all fields were entered manually.
            </p>
          )}
        </div>

        <div className="border border-rule-strong rounded p-5">
          <h4 className="caps mb-3">Shortcuts</h4>
          <ul className="space-y-2 text-[13px]">
            <li>
              <a
                href="https://tax.vermont.gov/property/tax-rates"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                VT tax rates ↗
              </a>
            </li>
            {form.source_url && (
              <li>
                <a
                  href={form.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline truncate block"
                >
                  Listing source ↗
                </a>
              </li>
            )}
            <li className="text-ink-3">
              Fields with a <span className="text-accent">Redfin</span> tag came
              from the import. Edits are marked <em>Redfin (edited)</em>.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
