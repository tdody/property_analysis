import { useState, useEffect, useCallback } from "react";
import { getSettings, updateSettings } from "../api/client.ts";

export function SettingsPage() {
  const [peakMonths, setPeakMonths] = useState(6);
  const [peakOccupancy, setPeakOccupancy] = useState(80);
  const [offPeakOccupancy, setOffPeakOccupancy] = useState(45);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const settings = await getSettings();
      setPeakMonths(settings.default_peak_months);
      setPeakOccupancy(settings.default_peak_occupancy_pct);
      setOffPeakOccupancy(settings.default_off_peak_occupancy_pct);
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
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-lg">Loading settings...</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-6">Settings</h2>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-none p-6 max-w-lg">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 mb-1">Seasonal Occupancy Defaults</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          These defaults are applied when creating new properties. Existing properties are not affected.
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Peak Months</label>
            <input
              type="number"
              min={1}
              max={12}
              value={peakMonths}
              onChange={(e) => setPeakMonths(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Number of peak-season months per year (1–12)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Peak Occupancy %</label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={peakOccupancy}
                onChange={(e) => setPeakOccupancy(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Expected occupancy during peak season</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Off-Peak Occupancy %</label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={offPeakOccupancy}
                onChange={(e) => setOffPeakOccupancy(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Expected occupancy during off-peak season</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
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
    </div>
  );
}
