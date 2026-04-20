import { useState, useId } from "react";
import { createSnapshot } from "../../api/client.ts";
import { useFocusTrap } from "../shared/useFocusTrap.ts";
import { useEscapeKey } from "../shared/useEscapeKey.ts";

interface SnapshotButtonProps {
  propertyId: string;
  scenarioId: string;
  dirty?: boolean;
  onPersistForm?: () => Promise<void>;
  onSnapshotCreated: () => void;
}

export function SnapshotButton({ propertyId, scenarioId, dirty = false, onPersistForm, onSnapshotCreated }: SnapshotButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleId = useId();
  const closeDialog = () => { setShowDialog(false); setName(""); setError(null); };
  const dialogRef = useFocusTrap<HTMLDivElement>(showDialog);
  useEscapeKey(closeDialog, showDialog);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      if (dirty && onPersistForm) {
        await onPersistForm();
      }
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeDialog}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Save Snapshot</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Capture the current scenario configuration.
            </p>
            {dirty && (
              <div className="mb-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                You have unsaved scenario edits. They will be saved before the snapshot is taken.
              </div>
            )}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Before rate drop"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100 mb-3"
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
                {saving ? "Saving..." : dirty ? "Save changes & Snapshot" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
