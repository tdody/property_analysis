import { useCallback, useEffect, useMemo, useState } from "react";
import { getSettings, updateSettings, uploadLogo } from "../api/client.ts";
import { FormSection } from "../components/shared/FormSection.tsx";
import { Field } from "../components/shared/Field.tsx";
import { SliderField } from "../components/shared/SliderField.tsx";
import { Segmented } from "../components/shared/Segmented.tsx";
import { CurrencyInput } from "../components/shared/CurrencyInput.tsx";
import { PercentInput } from "../components/shared/PercentInput.tsx";
import { SeasonalBars } from "../components/shared/SeasonalBars.tsx";
import { useTheme } from "../context/useTheme.ts";

type Density = "comfortable" | "compact";
type PropertiesView = "cards" | "rows";
type ThemeValue = "light" | "dark";

interface VTTaxDefaults {
  rooms_tax_pct: number;
  str_surcharge_pct: number;
  local_option_tax_pct: number;
  registration_fee: number;
}

const ACCENT_SWATCHES: Array<{
  id: string;
  label: string;
  light: string;
  dark: string;
}> = [
  { id: "teal", label: "Teal", light: "oklch(0.46 0.085 175)", dark: "oklch(0.74 0.09 175)" },
  { id: "emerald", label: "Forest", light: "oklch(0.48 0.10 150)", dark: "oklch(0.74 0.10 150)" },
  { id: "amber", label: "Amber", light: "oklch(0.58 0.13 65)", dark: "oklch(0.76 0.11 65)" },
  { id: "rose", label: "Rose", light: "oklch(0.56 0.14 15)", dark: "oklch(0.74 0.12 15)" },
  { id: "violet", label: "Violet", light: "oklch(0.48 0.14 300)", dark: "oklch(0.74 0.12 300)" },
];

const DEFAULT_ACCENT = "teal";

const THEME_OPTIONS: Array<{ value: ThemeValue; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const DENSITY_OPTIONS: Array<{ value: Density; label: string }> = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

const VIEW_OPTIONS: Array<{ value: PropertiesView; label: string }> = [
  { value: "cards", label: "Cards" },
  { value: "rows", label: "Rows" },
];

const DEFAULT_VT_TAX: VTTaxDefaults = {
  rooms_tax_pct: 9,
  str_surcharge_pct: 3,
  local_option_tax_pct: 1,
  registration_fee: 0,
};

function loadVTDefaults(): VTTaxDefaults {
  try {
    const raw = localStorage.getItem("settings.vtTax");
    if (!raw) return DEFAULT_VT_TAX;
    const parsed = JSON.parse(raw) as Partial<VTTaxDefaults>;
    return { ...DEFAULT_VT_TAX, ...parsed };
  } catch {
    return DEFAULT_VT_TAX;
  }
}

function loadAccent(): string {
  return localStorage.getItem("settings.accent") ?? DEFAULT_ACCENT;
}

function loadDensity(): Density {
  const v = localStorage.getItem("settings.density");
  return v === "compact" ? "compact" : "comfortable";
}

function loadPropertiesView(): PropertiesView {
  const v = localStorage.getItem("settings.propertiesView");
  return v === "rows" ? "rows" : "cards";
}

function applyAccent(id: string) {
  const swatch = ACCENT_SWATCHES.find((s) => s.id === id);
  if (!swatch) return;
  const isDark = document.documentElement.classList.contains("dark");
  document.documentElement.style.setProperty(
    "--accent",
    isDark ? swatch.dark : swatch.light
  );
}

function applyDensity(density: Density) {
  document.documentElement.dataset.density = density;
}

function derivePeakMask(peakMonths: number): boolean[] {
  const mask = Array<boolean>(12).fill(false);
  if (peakMonths <= 0) return mask;
  if (peakMonths >= 12) return mask.map(() => true);
  const start = Math.max(
    0,
    Math.min(12 - peakMonths, 7 - Math.floor(peakMonths / 2))
  );
  for (let i = start; i < start + peakMonths; i++) mask[i] = true;
  return mask;
}

export function SettingsPage() {
  const theme = useTheme();

  // Backend-persisted
  const [peakMonths, setPeakMonths] = useState(6);
  const [peakOccupancy, setPeakOccupancy] = useState(80);
  const [offPeakOccupancy, setOffPeakOccupancy] = useState(45);
  const [companyName, setCompanyName] = useState("");
  const [logoFilename, setLogoFilename] = useState<string | null>(null);

  // localStorage-persisted
  const [accent, setAccent] = useState<string>(() => loadAccent());
  const [density, setDensity] = useState<Density>(() => loadDensity());
  const [propertiesView, setPropertiesView] = useState<PropertiesView>(() =>
    loadPropertiesView()
  );
  const [vtTax, setVtTax] = useState<VTTaxDefaults>(() => loadVTDefaults());

  // Loading / saving state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initial, setInitial] =
    useState<{
      peakMonths: number;
      peakOccupancy: number;
      offPeakOccupancy: number;
      companyName: string;
      logoFilename: string | null;
      vtTax: VTTaxDefaults;
    } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const settings = await getSettings();
      const next = {
        peakMonths: settings.default_peak_months,
        peakOccupancy: settings.default_peak_occupancy_pct,
        offPeakOccupancy: settings.default_off_peak_occupancy_pct,
        companyName: settings.company_name || "",
        logoFilename: settings.logo_filename || null,
        vtTax: loadVTDefaults(),
      };
      setPeakMonths(next.peakMonths);
      setPeakOccupancy(next.peakOccupancy);
      setOffPeakOccupancy(next.offPeakOccupancy);
      setCompanyName(next.companyName);
      setLogoFilename(next.logoFilename);
      setVtTax(next.vtTax);
      setInitial(next);
      setError(null);
    } catch {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  // Apply appearance settings live.
  useEffect(() => {
    applyAccent(accent);
    localStorage.setItem("settings.accent", accent);
  }, [accent, theme.dark]);

  useEffect(() => {
    applyDensity(density);
    localStorage.setItem("settings.density", density);
  }, [density]);

  useEffect(() => {
    localStorage.setItem("settings.propertiesView", propertiesView);
  }, [propertiesView]);

  const handleThemeChange = (value: ThemeValue) => {
    const shouldBeDark = value === "dark";
    if (shouldBeDark !== theme.dark) {
      theme.toggle();
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaved(false);
      await updateSettings({
        default_peak_months: peakMonths,
        default_peak_occupancy_pct: peakOccupancy,
        default_off_peak_occupancy_pct: offPeakOccupancy,
        company_name: companyName || null,
      });
      localStorage.setItem("settings.vtTax", JSON.stringify(vtTax));
      setInitial((prev) =>
        prev
          ? {
              ...prev,
              peakMonths,
              peakOccupancy,
              offPeakOccupancy,
              companyName,
              vtTax,
            }
          : prev
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!initial) return;
    setPeakMonths(initial.peakMonths);
    setPeakOccupancy(initial.peakOccupancy);
    setOffPeakOccupancy(initial.offPeakOccupancy);
    setCompanyName(initial.companyName);
    setVtTax(initial.vtTax);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setError(null);
      const updated = await uploadLogo(file);
      setLogoFilename(updated.logo_filename);
      setInitial((prev) =>
        prev ? { ...prev, logoFilename: updated.logo_filename } : prev
      );
    } catch {
      setError("Failed to upload logo. Ensure it is a PNG or JPEG under 2 MB.");
    } finally {
      setUploading(false);
    }
  };

  const peakMask = useMemo(() => derivePeakMask(peakMonths), [peakMonths]);
  const occValues = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        peakMask[i] ? peakOccupancy : offPeakOccupancy
      ),
    [peakMask, peakOccupancy, offPeakOccupancy]
  );

  const isDirty =
    initial !== null &&
    (peakMonths !== initial.peakMonths ||
      peakOccupancy !== initial.peakOccupancy ||
      offPeakOccupancy !== initial.offPeakOccupancy ||
      companyName !== initial.companyName ||
      JSON.stringify(vtTax) !== JSON.stringify(initial.vtTax));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-ink-3 text-[14px]">Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-16">
      <header>
        <p className="caps text-ink-3 mb-2">Workspace</p>
        <h1 className="font-serif text-[44px] leading-tight text-ink">
          Settings
        </h1>
        <p className="text-[14px] text-ink-3 mt-2 max-w-2xl">
          Defaults and appearance for this workspace. Seasonal occupancy and
          lender-packet branding persist on the server; appearance and tax
          defaults are stored locally.
        </p>
      </header>

      {error && (
        <div className="border border-negative bg-negative-soft text-negative text-[13px] rounded px-4 py-3 max-w-2xl">
          {error}
        </div>
      )}

      {/* Appearance */}
      <FormSection
        title="Appearance"
        subtitle="Live — changes apply immediately."
        contentClassName="space-y-6"
      >
        <div>
          <label className="field-label">Theme</label>
          <Segmented
            options={THEME_OPTIONS}
            value={theme.dark ? "dark" : "light"}
            onChange={(v) => handleThemeChange(v as ThemeValue)}
            ariaLabel="Theme"
          />
        </div>

        <div>
          <label className="field-label">Accent</label>
          <div className="flex flex-wrap gap-2">
            {ACCENT_SWATCHES.map((swatch) => {
              const selected = swatch.id === accent;
              return (
                <button
                  key={swatch.id}
                  type="button"
                  onClick={() => setAccent(swatch.id)}
                  aria-pressed={selected}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border transition-colors ${
                    selected
                      ? "border-ink"
                      : "border-rule-strong hover:border-ink"
                  }`}
                >
                  <span
                    className="inline-block w-4 h-4 rounded-sm"
                    style={{
                      backgroundColor: theme.dark
                        ? swatch.dark
                        : swatch.light,
                    }}
                    aria-hidden
                  />
                  <span className="caps">{swatch.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="field-label">Density</label>
          <Segmented
            options={DENSITY_OPTIONS}
            value={density}
            onChange={(v) => setDensity(v as Density)}
            ariaLabel="Density"
          />
        </div>

        <div>
          <label className="field-label">Properties view</label>
          <Segmented
            options={VIEW_OPTIONS}
            value={propertiesView}
            onChange={(v) => setPropertiesView(v as PropertiesView)}
            ariaLabel="Default properties view"
          />
          <p className="text-[12px] text-ink-3 mt-1">
            Default view on the dashboard.
          </p>
        </div>
      </FormSection>

      {/* Seasonal occupancy defaults */}
      <FormSection
        title="Seasonal Defaults"
        subtitle="Applied to new properties. Existing properties are not affected."
        contentClassName="space-y-6"
      >
        <SliderField
          label="Peak Months"
          value={peakMonths}
          min={0}
          max={12}
          step={1}
          suffix=" mo"
          onChange={setPeakMonths}
        />
        <SliderField
          label="Peak Occupancy"
          value={peakOccupancy}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={setPeakOccupancy}
        />
        <SliderField
          label="Off-Peak Occupancy"
          value={offPeakOccupancy}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={setOffPeakOccupancy}
        />
        <div>
          <div className="caps text-ink-3 mb-2">Preview</div>
          <SeasonalBars
            values={occValues}
            peak={peakMask}
            valueSuffix="%"
            ariaLabel="Occupancy by month"
          />
          <div className="flex gap-4 text-[11px] text-ink-3 mt-2">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-2 bg-accent rounded-sm" />
              Peak
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-2 bg-ink-3 opacity-50 rounded-sm" />
              Off-peak
            </span>
          </div>
        </div>
      </FormSection>

      {/* Vermont tax defaults */}
      <FormSection
        title="Vermont Tax Defaults"
        subtitle="Seed values for new VT properties. Saved locally."
      >
        <PercentInput
          label="VT Rooms Tax %"
          value={vtTax.rooms_tax_pct}
          onChange={(v) =>
            setVtTax((prev) => ({ ...prev, rooms_tax_pct: v }))
          }
        />
        <PercentInput
          label="STR Surcharge %"
          value={vtTax.str_surcharge_pct}
          onChange={(v) =>
            setVtTax((prev) => ({ ...prev, str_surcharge_pct: v }))
          }
        />
        <PercentInput
          label="Local Option Tax %"
          value={vtTax.local_option_tax_pct}
          onChange={(v) =>
            setVtTax((prev) => ({ ...prev, local_option_tax_pct: v }))
          }
        />
        <CurrencyInput
          label="STR Registration Fee"
          value={vtTax.registration_fee}
          onChange={(v) =>
            setVtTax((prev) => ({ ...prev, registration_fee: v }))
          }
        />
      </FormSection>

      {/* Lender packet branding (preserved) */}
      <FormSection
        title="Lender Packet Branding"
        subtitle="Customize the header of exported PDF lender packets."
        contentClassName="space-y-4"
      >
        <Field
          label="Company / LLC Name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="e.g. Acme Properties LLC"
          hint="Displayed in the PDF header on every page."
        />
        <div>
          <label className="field-label">Logo</label>
          {logoFilename && (
            <div className="mb-3">
              <img
                src="/api/settings/logo"
                alt="Company logo"
                className="h-12 object-contain rounded border border-rule-strong p-1"
              />
            </div>
          )}
          <input
            type="file"
            aria-label="Upload company logo"
            accept=".png,.jpg,.jpeg"
            onChange={(e) => void handleLogoUpload(e)}
            disabled={uploading}
            className="text-[13px] text-ink-3 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-rule-strong file:bg-transparent file:text-[13px] file:text-ink file:caps hover:file:bg-paper file:cursor-pointer disabled:opacity-50"
          />
          <p className="text-[12px] text-ink-3 mt-1">
            {uploading ? "Uploading…" : "PNG or JPEG, max 2 MB."}
          </p>
        </div>
      </FormSection>

      {/* Footer */}
      <div className="flex items-center gap-3 pt-6 border-t border-rule">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !isDirty}
          className="caps px-5 py-2 bg-ink text-canvas rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={!isDirty}
          className="caps px-4 py-2 border border-rule-strong rounded hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Reset
        </button>
        {saved && <span className="caps text-accent">Saved</span>}
      </div>
    </div>
  );
}
