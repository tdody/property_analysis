import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PropertySummary } from "../../types/index.ts";
import { PropertyTypeIcon } from "../shared/PropertyTypeIcon.tsx";

interface PropertyCardProps {
  property: PropertySummary;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  const abs = Math.abs(value);
  const formatted = abs >= 1000
    ? `$${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `$${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return value < 0 ? `-${formatted}` : formatted;
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return `${value.toFixed(1)}%`;
}

function getCashflowVariant(cashflow: number | null): "positive" | "negative" | "marginal" {
  if (cashflow === null) return "marginal";
  if (cashflow > 100) return "positive";
  if (cashflow < -100) return "negative";
  return "marginal";
}

const gradientBarMap = {
  positive: "bg-gradient-to-r from-emerald-500 to-emerald-400",
  negative: "bg-gradient-to-r from-red-500 to-red-400",
  marginal: "bg-gradient-to-r from-amber-400 to-yellow-400",
};

export function PropertyCard({ property, selected, onToggleSelect, onDelete }: PropertyCardProps) {
  const navigate = useNavigate();
  const variant = getCashflowVariant(property.monthly_cashflow);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-all flex flex-col">
      {/* Property image or type icon */}
      {property.image_url && !imgError ? (
        <img
          src={property.image_url}
          alt={property.name}
          className="w-full h-40 object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <PropertyTypeIcon propertyType={property.property_type} className="w-full h-40 rounded-t-2xl" />
      )}

      {/* Gradient bar */}
      <div className={`h-1 ${gradientBarMap[variant]}`} />

      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900 truncate">{property.name}</h3>
            <p className="text-sm text-slate-500 truncate">
              {property.city}, {property.state}
            </p>
          </div>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(property.id)}
            className="mt-1 h-4 w-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
            title="Select for comparison"
          />
        </div>

        <div className="text-xl font-bold tracking-tight text-slate-900">
          {formatCurrency(property.listing_price)}
        </div>

        <div className="text-sm text-slate-600">
          {property.beds} bd / {property.baths} ba
          {property.sqft > 0 && <span className="ml-2">{property.sqft.toLocaleString()} sqft</span>}
        </div>

        <div className="pt-3 space-y-2">
          <div className={`${property.monthly_cashflow !== null && property.monthly_cashflow >= 0 ? "bg-emerald-50" : "bg-red-50"} rounded-xl p-3 flex justify-between items-center`}>
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Cashflow</span>
            <span className={`font-bold ${property.monthly_cashflow !== null && property.monthly_cashflow >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {property.monthly_cashflow !== null ? `${formatCurrency(property.monthly_cashflow)}/mo` : "N/A"}
            </span>
          </div>
          <div className="bg-indigo-50 rounded-xl p-3 flex justify-between items-center">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">CoC Return</span>
            <span className={`font-bold text-indigo-600`}>
              {formatPercent(property.cash_on_cash_return)}
            </span>
          </div>
        </div>

        <div className="flex gap-2 mt-auto pt-2">
          <button
            onClick={() => navigate(`/property/${property.id}`)}
            className="flex-1 px-3 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            View
          </button>
          <button
            onClick={() => onDelete(property.id)}
            className="px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
