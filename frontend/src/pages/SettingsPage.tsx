import { useState, useEffect, useCallback } from "react";
import { getSettings, updateSettings, uploadLogo } from "../api/client.ts";

export function SettingsPage() {
  const [peakMonths, setPeakMonths] = useState(6);
  const [peakOccupancy, setPeakOccupancy] = useState(80);
  const [offPeakOccupancy, setOffPeakOccupancy] = useState(45);
  const [companyName, setCompanyName] = useState("");
  const [logoFilename, setLogoFilename] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const settings = await getSettings();
      setPeakMonths(settings.default_peak_months);
      setPeakOccupancy(settings.default_peak_occupancy_pct);
      setOffPeakOccupancy(settings.default_off_peak_occupancy_pct);
      setCompanyName(settings.company_name || "");
      setLogoFilename(settings.logo_filename || null);
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setError(null);
      const updated = await uploadLogo(file);
      setLogoFilename(updated.logo_filename);
    } catch {
      setError("Failed to upload logo. Ensure it is a PNG or JPEG under 2 MB.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-lg">Loading settings...</div>
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";
  const hintClass = "text-xs text-slate-400 dark:text-slate-500 mt-1";
  const cardClass = "bg-white dark:bg-slate-800 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-none p-6 max-w-lg";

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-6">Settings</h2>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg px-4 py-3 mb-4 max-w-lg">{error}</div>
      )}

      {/* Seasonal Occupancy Defaults */}
      <div className={`${cardClass} mb-6`}>
        <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 mb-1">Seasonal Occupancy Defaults</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          These defaults are applied when creating new properties. Existing properties are not affected.
        </p>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Peak Months</label>
            <input
              type="number"
              min={1}
              max={12}
              value={peakMonths}
              onChange={(e) => setPeakMonths(parseInt(e.target.value) || 0)}
              className={inputClass}
            />
            <p className={hintClass}>Number of peak-season months per year (1–12)</p>
          </div>

          <div>
            <label className={labelClass}>Peak Occupancy %</label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={peakOccupancy}
                onChange={(e) => setPeakOccupancy(parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            <p className={hintClass}>Expected occupancy during peak season</p>
          </div>

          <div>
            <label className={labelClass}>Off-Peak Occupancy %</label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={offPeakOccupancy}
                onChange={(e) => setOffPeakOccupancy(parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            <p className={hintClass}>Expected occupancy during off-peak season</p>
          </div>
        </div>
      </div>

      {/* Lender Packet Branding */}
      <div className={`${cardClass} mb-6`}>
        <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 mb-1">Lender Packet Branding</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Customize the header of exported PDF lender packets with your company branding.
        </p>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Company / LLC Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Properties LLC"
              className={inputClass}
            />
            <p className={hintClass}>Displayed in the PDF header on every page</p>
          </div>

          <div>
            <label className={labelClass}>Logo</label>
            {logoFilename && (
              <div className="mb-2">
                <img
                  src="/api/settings/logo"
                  alt="Company logo"
                  className="h-12 object-contain rounded border border-slate-200 dark:border-slate-600 p-1"
                />
              </div>
            )}
            <input
              type="file"
              accept=".png,.jpg,.jpeg"
              onChange={(e) => void handleLogoUpload(e)}
              disabled={uploading}
              className="text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-900/30 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/50 disabled:opacity-50"
            />
            <p className={hintClass}>{uploading ? "Uploading..." : "PNG or JPEG, max 2 MB"}</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-md shadow-indigo-200 dark:shadow-indigo-900/30 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Saved!</span>
        )}
      </div>
    </div>
  );
}
