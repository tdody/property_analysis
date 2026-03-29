import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { compareProperties } from "../../api/client.ts";
import type { ComparisonProperty } from "../../types/index.ts";

interface ComparisonViewProps {
  propertyIds: string[];
}

function fmtCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = `$${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
  { label: "Price", key: "listing_price", format: fmtCurrency, higherIsBetter: false },
  { label: "Beds / Baths", key: "beds_baths", format: (v) => String(v), higherIsBetter: true },
  { label: "Sqft", key: "sqft", format: (v) => v.toLocaleString(), higherIsBetter: true },
  { label: "Cash Invested", key: "total_cash_invested", format: fmtCurrency, higherIsBetter: false },
  { label: "Monthly Cashflow", key: "monthly_cashflow", format: (v) => `${fmtCurrency(v)}/mo`, higherIsBetter: true },
  { label: "Annual Cashflow", key: "annual_cashflow", format: fmtCurrency, higherIsBetter: true },
  { label: "CoC Return", key: "cash_on_cash_return", format: fmtPct, higherIsBetter: true },
  { label: "Cap Rate", key: "cap_rate", format: fmtPct, higherIsBetter: true },
  { label: "NOI", key: "noi", format: fmtCurrency, higherIsBetter: true },
  { label: "Break-Even Occupancy", key: "break_even_occupancy", format: fmtPct, higherIsBetter: false },
  { label: "DSCR", key: "dscr", format: (v) => v.toFixed(2), higherIsBetter: true },
  { label: "Gross Yield", key: "gross_yield", format: fmtPct, higherIsBetter: true },
];

function getVerdict(p: ComparisonProperty): { label: string; color: string } {
  if (p.monthly_cashflow > 200 && p.cash_on_cash_return >= 8) {
    return { label: "Strong", color: "text-green-600" };
  }
  if (p.monthly_cashflow > 0) {
    return { label: "Marginal", color: "text-yellow-600" };
  }
  return { label: "Negative", color: "text-red-600" };
}

function getValue(p: ComparisonProperty, key: string): number {
  if (key === "beds_baths") return p.beds;
  return (p as unknown as Record<string, number>)[key] ?? 0;
}

function getBestIndex(properties: ComparisonProperty[], key: string, higherIsBetter: boolean): number {
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
      setError("Select at least 2 properties to compare");
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
        setError("Failed to load comparison data. Make sure all properties have active scenarios configured.");
      } finally {
        setLoading(false);
      }
    };
    void fetch();
  }, [propertyIds]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading comparison...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Compare Properties</h2>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 text-sm font-medium"
        >
          &larr; Back to Dashboard
        </button>
      </div>

      <div className="bg-white border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left text-gray-600 font-semibold w-48"></th>
              {properties.map((p) => (
                <th key={p.property_id} className="px-4 py-3 text-center min-w-40">
                  <div className="font-semibold text-gray-900">{p.property_name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {p.city} | {p.scenario_name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map((row) => {
              const bestIdx = getBestIndex(properties, row.key, row.higherIsBetter);
              return (
                <tr key={row.key} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-700">{row.label}</td>
                  {properties.map((p, i) => {
                    const val = getValue(p, row.key);
                    const isBest = i === bestIdx && properties.length > 1;
                    const displayValue = row.key === "beds_baths"
                      ? `${p.beds} / ${p.baths}`
                      : row.format(val);
                    return (
                      <td
                        key={p.property_id}
                        className={`px-4 py-3 text-center ${isBest ? "font-bold text-green-700 bg-green-50" : ""}`}
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Verdict row */}
            <tr className="bg-gray-50 border-t-2">
              <td className="px-4 py-3 font-semibold text-gray-700">Verdict</td>
              {properties.map((p) => {
                const verdict = getVerdict(p);
                return (
                  <td key={p.property_id} className={`px-4 py-3 text-center font-bold ${verdict.color}`}>
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
