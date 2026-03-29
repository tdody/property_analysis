import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { listProperties, createProperty, deleteProperty } from "../../api/client.ts";
import type { PropertySummary } from "../../types/index.ts";
import { PropertyCard } from "./PropertyCard.tsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.tsx";

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500 text-lg">Loading properties...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => void fetchProperties()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
          <h2 className="text-2xl font-bold text-gray-900">Properties</h2>
          <p className="text-sm text-gray-500 mt-1">
            {properties.length} {properties.length === 1 ? "property" : "properties"}
          </p>
        </div>
        <div className="flex gap-3">
          {selectedIds.size >= 2 && (
            <button
              onClick={handleCompare}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              Compare Selected ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => setShowNewForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            + New Property
          </button>
        </div>
      </div>

      {showNewForm && (
        <div className="bg-white border rounded-lg p-6 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">New Property</h3>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder='e.g., "Lake House"'
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Listing Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <button
              onClick={() => void handleCreate()}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewName(""); setNewPrice(""); }}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {properties.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg border">
          <p className="text-gray-500 text-lg mb-2">No properties yet</p>
          <p className="text-gray-400 text-sm mb-6">Create your first property to get started</p>
          <button
            onClick={() => setShowNewForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
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
