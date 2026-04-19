import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PropertySummary } from "../../types/index.ts";
import { PropertyThumb } from "../shared/PropertyThumb.tsx";
import type { PropertyThumbKind } from "../shared/PropertyThumb.tsx";
import { RentalBadge } from "../shared/RentalBadge.tsx";

interface PropertyCardProps {
  property: PropertySummary;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePortfolio: (id: string, current: boolean) => void;
}

function fmtCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  return `${value < 0 ? "-" : ""}$${abs.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function fmtPct(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

function cashflowToneClass(value: number | null): string {
  if (value === null) return "text-ink-3";
  if (value >= 0) return "text-accent";
  return "text-negative";
}

function thumbKindFor(propertyType: string): PropertyThumbKind {
  if (propertyType === "multi_family") return "multi-unit";
  if (propertyType === "townhouse") return "duplex";
  if (propertyType === "condo") return "cape";
  return "default";
}

export function PropertyCard({
  property,
  selected,
  onToggleSelect,
  onDelete,
  onTogglePortfolio,
}: PropertyCardProps) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const useImg = property.image_url && !imgError;

  return (
    <div
      className={`border rounded overflow-hidden bg-canvas flex flex-col transition-colors ${
        selected
          ? "border-ink"
          : property.in_portfolio
          ? "border-accent"
          : "border-rule-strong hover:border-ink"
      }`}
    >
      <div className="relative">
        {useImg ? (
          <img
            src={property.image_url ?? ""}
            alt={property.name}
            className="w-full h-40 object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-40">
            <PropertyThumb kind={thumbKindFor(property.property_type)} />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <RentalBadge
            type={property.active_rental_type === "ltr" ? "LTR" : "STR"}
            className="bg-canvas/90 backdrop-blur-sm"
          />
        </div>
        <label className="absolute top-2 left-2 inline-flex items-center justify-center w-6 h-6 border border-rule-strong rounded bg-canvas/90 cursor-pointer">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(property.id)}
            className="accent-ink"
            aria-label="Select for comparison"
          />
        </label>
      </div>

      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="font-serif text-[20px] leading-tight text-ink truncate">
            {property.name}
          </h3>
          <p className="text-[13px] text-ink-3 truncate">
            {property.city}, {property.state}
          </p>
        </div>

        <div className="font-mono tabular-nums text-[18px] text-ink">
          {fmtCurrency(property.listing_price)}
        </div>

        <div className="text-[13px] text-ink-2">
          {property.beds} bd · {property.baths} ba
          {property.sqft > 0 && ` · ${property.sqft.toLocaleString()} sqft`}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-rule">
          <div>
            <div className="caps mb-1">Cashflow</div>
            <div
              className={`font-mono tabular-nums text-[15px] ${cashflowToneClass(
                property.monthly_cashflow
              )}`}
            >
              {property.monthly_cashflow !== null
                ? `${fmtCurrency(property.monthly_cashflow)}/mo`
                : "—"}
            </div>
          </div>
          <div>
            <div className="caps mb-1">CoC</div>
            <div
              className={`font-mono tabular-nums text-[15px] ${cashflowToneClass(
                property.cash_on_cash_return
              )}`}
            >
              {fmtPct(property.cash_on_cash_return)}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-auto pt-3 border-t border-rule">
          <button
            type="button"
            onClick={() => navigate(`/property/${property.id}`)}
            className="flex-1 caps py-2 border border-rule-strong rounded hover:bg-paper transition-colors"
          >
            View
          </button>
          <button
            type="button"
            onClick={() =>
              onTogglePortfolio(property.id, property.in_portfolio)
            }
            title={
              property.in_portfolio
                ? "Remove from portfolio"
                : "Add to portfolio"
            }
            className={`px-3 py-2 rounded transition-colors text-[15px] ${
              property.in_portfolio
                ? "text-accent hover:bg-accent-soft"
                : "text-ink-3 hover:text-ink hover:bg-paper"
            }`}
          >
            {property.in_portfolio ? "★" : "☆"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(property.id)}
            className="caps px-3 py-2 text-ink-3 hover:text-negative hover:bg-negative-soft rounded transition-colors"
            aria-label="Delete"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
