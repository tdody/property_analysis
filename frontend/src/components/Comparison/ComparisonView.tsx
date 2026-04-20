import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { compareProperties } from "../../api/client.ts";
import type { ComparisonProperty } from "../../types/index.ts";
import { Skeleton, SkeletonLine } from "../shared/Skeleton.tsx";

interface ComparisonViewProps {
  propertyIds: string[];
}

function fmtCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = `$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
  return value < 0 ? `-${formatted}` : formatted;
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface MetricRow {
  label: string;
  key: string;
  format: (val: number) => string;
  higherIsBetter: boolean;
}

const METRIC_ROWS: MetricRow[] = [
  {
    label: "Price",
    key: "listing_price",
    format: fmtCurrency,
    higherIsBetter: false,
  },
  {
    label: "Beds / Baths",
    key: "beds_baths",
    format: (v) => String(v),
    higherIsBetter: true,
  },
  {
    label: "Sqft",
    key: "sqft",
    format: (v) => v.toLocaleString(),
    higherIsBetter: true,
  },
  {
    label: "Cash Invested",
    key: "total_cash_invested",
    format: fmtCurrency,
    higherIsBetter: false,
  },
  {
    label: "Monthly Cashflow",
    key: "monthly_cashflow",
    format: (v) => `${fmtCurrency(v)}/mo`,
    higherIsBetter: true,
  },
  {
    label: "Annual Cashflow",
    key: "annual_cashflow",
    format: fmtCurrency,
    higherIsBetter: true,
  },
  {
    label: "CoC Return",
    key: "cash_on_cash_return",
    format: fmtPct,
    higherIsBetter: true,
  },
  {
    label: "Cap Rate",
    key: "cap_rate",
    format: fmtPct,
    higherIsBetter: true,
  },
  { label: "NOI", key: "noi", format: fmtCurrency, higherIsBetter: true },
  {
    label: "Break-Even Occupancy",
    key: "break_even_occupancy",
    format: fmtPct,
    higherIsBetter: false,
  },
  {
    label: "DSCR",
    key: "dscr",
    format: (v) => v.toFixed(2),
    higherIsBetter: true,
  },
  {
    label: "Gross Yield",
    key: "gross_yield",
    format: fmtPct,
    higherIsBetter: true,
  },
];

function getVerdict(
  p: ComparisonProperty
): { label: string; toneClass: string } {
  if (p.monthly_cashflow > 200 && p.cash_on_cash_return >= 8) {
    return { label: "Strong", toneClass: "text-accent" };
  }
  if (p.monthly_cashflow > 0) {
    return { label: "Marginal", toneClass: "text-warn" };
  }
  return { label: "Negative", toneClass: "text-negative" };
}

function getValue(p: ComparisonProperty, key: string): number {
  if (key === "beds_baths") return p.beds;
  return (p as unknown as Record<string, number>)[key] ?? 0;
}

function getBestIndex(
  properties: ComparisonProperty[],
  key: string,
  higherIsBetter: boolean
): number {
  if (properties.length === 0) return -1;
  const values = properties.map((p) => getValue(p, key));
  const best = higherIsBetter ? Math.max(...values) : Math.min(...values);
  return values.indexOf(best);
}

export function ComparisonView({ propertyIds }: ComparisonViewProps) {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<ComparisonProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyIds.length < 2) {
      setError("Select at least 2 properties to compare.");
      setLoading(false);
      return;
    }

    const fetch = async () => {
      try {
        setLoading(true);
        const data = await compareProperties(propertyIds);
        setProperties(data);
        setError(null);
      } catch {
        setError(
          "Failed to load comparison data. Make sure all properties have active scenarios configured."
        );
      } finally {
        setLoading(false);
      }
    };
    void fetch();
  }, [propertyIds]);

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading comparison">
        <SkeletonLine className="w-24" />
        <Skeleton className="h-14 w-64" />
        <div>
          <div className="grid grid-cols-[220px_200px_200px] gap-4 py-4 border-t border-rule">
            <div />
            <div className="space-y-2">
              <Skeleton className="h-7" />
              <SkeletonLine className="w-20" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-7" />
              <SkeletonLine className="w-20" />
            </div>
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[220px_200px_200px] gap-4 py-4 border-t border-rule"
            >
              <SkeletonLine className="w-32" />
              <SkeletonLine className="w-24" />
              <SkeletonLine className="w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Breadcrumb onClick={() => navigate("/")} />
        <div className="text-center py-12">
          <p className="text-negative mb-4 text-[14px]">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="caps px-5 py-2 bg-ink text-canvas rounded hover:opacity-90 transition-opacity"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb onClick={() => navigate("/")} />
      <div>
        <p className="caps text-ink-3 mb-2">Compare · {properties.length}</p>
        <h1 className="font-serif text-[44px] leading-tight text-ink">
          Side by side
        </h1>
      </div>

      <div className="border border-rule-strong rounded overflow-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-paper border-b border-rule">
              <th className="px-4 py-4 text-left w-[220px] caps">Metric</th>
              {properties.map((p) => (
                <th
                  key={p.property_id}
                  className="px-4 py-4 text-left min-w-48 align-top"
                >
                  <div className="font-serif text-[18px] leading-tight text-ink">
                    {p.property_name}
                  </div>
                  <div className="text-[12px] text-ink-3 mt-1 truncate">
                    {p.city} · {p.scenario_name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map((row) => {
              const bestIdx = getBestIndex(
                properties,
                row.key,
                row.higherIsBetter
              );
              return (
                <tr
                  key={row.key}
                  className="border-b border-rule last:border-0"
                >
                  <td className="px-4 py-3 text-ink-2 w-[220px]">
                    {row.label}
                  </td>
                  {properties.map((p, i) => {
                    const val = getValue(p, row.key);
                    const isBest = i === bestIdx && properties.length > 1;
                    const displayValue =
                      row.key === "beds_baths"
                        ? `${p.beds} / ${p.baths}`
                        : row.format(val);
                    return (
                      <td
                        key={p.property_id}
                        className={`px-4 py-3 font-mono tabular-nums ${
                          isBest ? "text-accent font-medium" : "text-ink"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{displayValue}</span>
                          {isBest && (
                            <span className="caps text-accent border border-accent rounded px-1.5 py-px text-[10px]">
                              Best
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Verdict row */}
            <tr className="bg-paper border-t border-rule-strong">
              <td className="px-4 py-4 caps w-[220px]">Verdict</td>
              {properties.map((p) => {
                const verdict = getVerdict(p);
                return (
                  <td
                    key={p.property_id}
                    className={`px-4 py-4 caps ${verdict.toneClass}`}
                  >
                    {verdict.label}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Breadcrumb({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="caps text-ink-3 hover:text-ink inline-flex items-center gap-1 transition-colors"
    >
      ← All properties
    </button>
  );
}
