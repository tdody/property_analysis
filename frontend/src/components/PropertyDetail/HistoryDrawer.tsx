import { useState, useEffect, useCallback } from "react";
import { listSnapshots, diffSnapshot, restoreSnapshot, deleteSnapshot } from "../../api/client.ts";
import type { SnapshotListItem, DiffResponse } from "../../types/index.ts";
import { ConfirmDialog } from "../shared/ConfirmDialog.tsx";

interface HistoryDrawerProps {
  propertyId: string;
  scenarioId: string;
  scenarioName: string;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}

const MAX_SNAPSHOTS = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function formatValue(value: unknown, format: string): string {
  if (value === null || value === undefined) return "—";
  if (format === "currency") return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (format === "percent") return `${Number(value).toFixed(2)}%`;
  if (format === "number") return String(value);
  return String(value);
}

function formatDelta(oldVal: unknown, newVal: unknown, format: string, direction: string | null): string {
  if (direction === null || oldVal === null || newVal === null) return "—";
  const diff = Math.abs(Number(newVal) - Number(oldVal));
  const arrow = direction === "increased" ? "▲" : "▼";
  if (format === "currency") return `${arrow} $${diff.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (format === "percent") return `${arrow} ${diff.toFixed(2)}%`;
  return `${arrow} ${diff}`;
}

function formatScenarioSummary(s: SnapshotListItem): string {
  const parts: string[] = [];
  if (s.purchase_price != null) parts.push(`$${Math.round(s.purchase_price).toLocaleString()}`);
  if (s.interest_rate != null) parts.push(`${s.interest_rate.toFixed(2)}%`);
  if (s.loan_term_years != null) parts.push(`${s.loan_term_years}yr`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function HistoryDrawer({ propertyId, scenarioId, scenarioName, open, onClose, onRestored }: HistoryDrawerProps) {
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<SnapshotListItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SnapshotListItem | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSnapshots(propertyId, scenarioId);
      setSnapshots(data);
    } finally {
      setLoading(false);
    }
  }, [propertyId, scenarioId]);

  useEffect(() => {
    if (open) {
      loadSnapshots();
      setDiff(null);
    }
  }, [open, loadSnapshots]);

  const handleCompare = async (snapshotId: string) => {
    setDiffLoading(true);
    try {
      const data = await diffSnapshot(propertyId, scenarioId, snapshotId);
      setDiff(data);
    } finally {
      setDiffLoading(false);
    }
  };

  const handleRestore = async (snapshot: SnapshotListItem) => {
    setRestoring(true);
    try {
      await restoreSnapshot(propertyId, scenarioId, snapshot.id);
      setConfirmRestore(null);
      setDiff(null);
      onRestored();
      onClose();
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async (snapshot: SnapshotListItem) => {
    await deleteSnapshot(propertyId, scenarioId, snapshot.id);
    setConfirmDelete(null);
    loadSnapshots();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-white dark:bg-slate-800 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            {diff && (
              <button onClick={() => setDiff(null)} className="text-indigo-500 hover:text-indigo-600 text-sm mr-1">
                ← Back
              </button>
            )}
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              {diff ? "Compare" : "Version History"}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {diff ? (
            /* Diff View */
            <div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">Comparing</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  📸 "{diff.snapshot_name}" → 📍 Current
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {diff.total_changes} field{diff.total_changes !== 1 ? "s" : ""} changed
                </p>
              </div>

              {diffLoading ? (
                <div className="p-8 text-center text-slate-400">Loading diff...</div>
              ) : diff.total_changes === 0 ? (
                <div className="p-8 text-center text-slate-400">No changes detected.</div>
              ) : (
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-xs uppercase text-slate-400 dark:text-slate-500">
                        <th className="text-left py-2 px-1">Field</th>
                        <th className="text-left py-2 px-1">Snapshot</th>
                        <th className="text-left py-2 px-1">Current</th>
                        <th className="text-right py-2 px-1">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diff.changes.map((c) => (
                        <tr key={c.field} className="bg-red-50/50 dark:bg-red-900/10">
                          <td className="py-2 px-1 font-medium text-slate-700 dark:text-slate-300">{c.label}</td>
                          <td className="py-2 px-1 text-slate-500 dark:text-slate-400">{formatValue(c.old_value, c.format)}</td>
                          <td className="py-2 px-1 font-semibold text-slate-900 dark:text-slate-100">{formatValue(c.new_value, c.format)}</td>
                          <td className={`py-2 px-1 text-right ${c.direction === "increased" ? "text-green-600" : c.direction === "decreased" ? "text-red-500" : "text-slate-400"}`}>
                            {formatDelta(c.old_value, c.new_value, c.format, c.direction)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {diff.unchanged_count > 0 && (
                    <p className="mt-3 w-full text-center text-sm text-slate-400 dark:text-slate-500">
                      {diff.unchanged_count} unchanged field{diff.unchanged_count !== 1 ? "s" : ""} hidden
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Snapshot List */
            <div>
              <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                {scenarioName} · {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400">Loading...</div>
              ) : snapshots.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  No snapshots yet. Save a snapshot to start tracking changes.
                </div>
              ) : (
                snapshots.map((s) => (
                  <div key={s.id} className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatDate(s.created_at)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {formatScenarioSummary(s)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <button onClick={() => handleCompare(s.id)} className="text-indigo-500 hover:text-indigo-600">Compare</button>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <button onClick={() => setConfirmRestore(s)} disabled={restoring} className="text-indigo-500 hover:text-indigo-600 disabled:opacity-50">Restore</button>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <button onClick={() => setConfirmDelete(s)} className="text-red-400 hover:text-red-500">Delete</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400 dark:text-slate-500">
          {diff ? (
            <button
              onClick={() => { const snap = snapshots.find((s) => s.name === diff.snapshot_name); if (snap) setConfirmRestore(snap); }}
              disabled={restoring}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
            >
              {restoring ? "Restoring…" : "Restore This Snapshot"}
            </button>
          ) : (
            `${snapshots.length} of ${MAX_SNAPSHOTS} snapshots used`
          )}
        </div>
      </div>

      {/* Restore confirmation */}
      <ConfirmDialog
        open={confirmRestore !== null}
        title="Restore Snapshot"
        message={confirmRestore ? `This will save your current configuration as a snapshot and restore "${confirmRestore.name}". Continue?` : ""}
        onConfirm={() => { if (confirmRestore) handleRestore(confirmRestore); }}
        onCancel={() => setConfirmRestore(null)}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete Snapshot"
        message={confirmDelete ? `Are you sure you want to delete "${confirmDelete.name}"? This cannot be undone.` : ""}
        onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
