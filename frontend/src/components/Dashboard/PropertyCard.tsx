import { useNavigate } from "react-router-dom";
import type { PropertySummary } from "../../types/index.ts";

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

const borderColorMap = {
  positive: "border-green-400",
  negative: "border-red-400",
  marginal: "border-yellow-400",
};

const bgColorMap = {
  positive: "bg-green-50",
  negative: "bg-red-50",
  marginal: "bg-yellow-50",
};

export function PropertyCard({ property, selected, onToggleSelect, onDelete }: PropertyCardProps) {
  const navigate = useNavigate();
  const variant = getCashflowVariant(property.monthly_cashflow);

  return (
    <div className={`rounded-lg border-2 ${borderColorMap[variant]} ${bgColorMap[variant]} p-5 flex flex-col gap-3 transition-shadow hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{property.name}</h3>
          <p className="text-sm text-gray-500 truncate">
            {property.city}, {property.state}
          </p>
        </div>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(property.id)}
          className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 cursor-pointer"
          title="Select for comparison"
        />
      </div>

      <div className="text-xl font-bold text-gray-900">
        {formatCurrency(property.listing_price)}
      </div>

      <div className="text-sm text-gray-600">
        {property.beds} bd / {property.baths} ba
        {property.sqft > 0 && <span className="ml-2">{property.sqft.toLocaleString()} sqft</span>}
      </div>

      <div className="border-t border-gray-200 pt-3 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Cashflow</span>
          <span className={`font-semibold ${property.monthly_cashflow !== null && property.monthly_cashflow >= 0 ? "text-green-600" : "text-red-600"}`}>
            {property.monthly_cashflow !== null ? `${formatCurrency(property.monthly_cashflow)}/mo` : "N/A"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">CoC Return</span>
          <span className={`font-semibold ${property.cash_on_cash_return !== null && property.cash_on_cash_return >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatPercent(property.cash_on_cash_return)}
          </span>
        </div>
      </div>

      <div className="flex gap-2 mt-auto pt-2">
        <button
          onClick={() => navigate(`/property/${property.id}`)}
          className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
        >
          View
        </button>
        <button
          onClick={() => onDelete(property.id)}
          className="px-3 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
