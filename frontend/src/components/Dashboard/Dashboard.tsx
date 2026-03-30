import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { listProperties, createProperty, deleteProperty } from "../../api/client.ts";
import type { PropertySummary } from "../../types/index.ts";
import { PropertyCard } from "./PropertyCard.tsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.tsx";

function fmtCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = `$${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return value < 0 ? `-${formatted}` : formatted;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listProperties();
      setProperties(data);
      setError(null);
    } catch {
      setError("Failed to load properties");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProperties();
  }, [fetchProperties]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCompare = useCallback(() => {
    if (selectedIds.size < 2) return;
    const ids = Array.from(selectedIds).join(",");
    navigate(`/compare?ids=${ids}`);
  }, [selectedIds, navigate]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      setCreating(true);
      const property = await createProperty({
        name: newName.trim(),
        listing_price: parseFloat(newPrice) || 0,
        address: "",
        city: "",
        state: "VT",
        zip_code: "",
        beds: 0,
        baths: 0,
        sqft: 0,
        hoa_monthly: 0,
        annual_taxes: 0,
        notes: "",
        property_type: "single_family",
      });
      setShowNewForm(false);
      setNewName("");
      setNewPrice("");
      navigate(`/property/${property.id}`);
    } catch {
      setError("Failed to create property");
    } finally {
      setCreating(false);
    }
  }, [newName, newPrice, navigate]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteProperty(deleteTarget);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget);
        return next;
      });
      setDeleteTarget(null);
      await fetchProperties();
    } catch {
      setError("Failed to delete property");
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchProperties]);

  const portfolioStats = useMemo(() => {
    if (properties.length === 0) return null;
    const cashflows = properties
      .map((p) => p.monthly_cashflow)
      .filter((v): v is number => v !== null);
    const cocReturns = properties
      .map((p) => p.cash_on_cash_return)
      .filter((v): v is number => v !== null);
    const totalInvested = properties.reduce((sum, p) => sum + (p.listing_price || 0), 0);
    const avgCashflow = cashflows.length > 0 ? cashflows.reduce((a, b) => a + b, 0) / cashflows.length : 0;
    const bestCoC = cocReturns.length > 0 ? Math.max(...cocReturns) : 0;
    return {
      count: properties.length,
      avgCashflow,
      bestCoC,
      totalInvested,
    };
  }, [properties]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-lg">Loading properties...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => void fetchProperties()}
          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-md shadow-indigo-200 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Properties</h2>
          <p className="text-sm text-slate-500 mt-1">
            {properties.length} {properties.length === 1 ? "property" : "properties"}
          </p>
        </div>
        <div className="flex gap-3">
          {selectedIds.size >= 2 && (
            <button
              onClick={handleCompare}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
            >
              Compare Selected ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => setShowNewForm(true)}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-md shadow-indigo-200 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 transition-colors text-sm font-medium"
          >
            + New Property
          </button>
        </div>
      </div>

      {/* Portfolio Summary Stats */}
      {portfolioStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] p-4">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-1">Properties</div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">{portfolioStats.count}</div>
          </div>
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] p-4">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-1">Avg Cashflow</div>
            <div className={`text-2xl font-bold tracking-tight ${portfolioStats.avgCashflow >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {fmtCurrency(Math.round(portfolioStats.avgCashflow))}/mo
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] p-4">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-1">Best CoC</div>
            <div className="text-2xl font-bold tracking-tight text-indigo-600">{portfolioStats.bestCoC.toFixed(1)}%</div>
          </div>
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] p-4">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-1">Total Invested</div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">{fmtCurrency(portfolioStats.totalInvested)}</div>
          </div>
        </div>
      )}

      {showNewForm && (
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
          <h3 className="text-lg font-semibold tracking-tight mb-4">New Property</h3>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Property Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder='e.g., "Lake House"'
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                autoFocus
              />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Listing Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <button
              onClick={() => void handleCreate()}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-md shadow-indigo-200 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewName(""); setNewPrice(""); }}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {properties.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
          <p className="text-slate-500 text-lg mb-2">No properties yet</p>
          <p className="text-slate-400 text-sm mb-6">Create your first property to get started</p>
          <button
            onClick={() => setShowNewForm(true)}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-md shadow-indigo-200 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 transition-colors text-sm font-medium"
          >
            + New Property
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              selected={selectedIds.has(p.id)}
              onToggleSelect={handleToggleSelect}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Property"
        message="Are you sure you want to delete this property? This action cannot be undone."
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
