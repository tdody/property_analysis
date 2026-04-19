import { useState } from "react";
import { createSnapshot } from "../../api/client.ts";

interface SnapshotButtonProps {
  propertyId: string;
  scenarioId: string;
  onSnapshotCreated: () => void;
}

export function SnapshotButton({ propertyId, scenarioId, onSnapshotCreated }: SnapshotButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await createSnapshot(propertyId, scenarioId, name || undefined);
      setShowDialog(false);
      setName("");
      onSnapshotCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save snapshot";
      if (typeof err === "object" && err !== null && "response" in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(axiosErr.response?.data?.detail || msg);
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-1.5"
      >
        <span>📸</span> Save Snapshot
      </button>

      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDialog(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Save Snapshot</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Capture the current scenario configuration and computed results.
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Before rate drop"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100 mb-3"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDialog(false); setName(""); setError(null); }}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
