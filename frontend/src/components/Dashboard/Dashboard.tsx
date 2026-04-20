import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  listProperties,
  createProperty,
  deleteProperty,
  scrapeProperty,
  updateProperty,
} from "../../api/client.ts";
import type { PropertySummary } from "../../types/index.ts";
import { PropertyCard } from "./PropertyCard.tsx";
import { QuickTest } from "./QuickTest.tsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.tsx";
import { MetricCell, MetricStrip } from "../shared/MetricCell.tsx";
import { Segmented } from "../shared/Segmented.tsx";
import { RentalBadge } from "../shared/RentalBadge.tsx";
import { PropertyThumb } from "../shared/PropertyThumb.tsx";
import type { PropertyThumbKind } from "../shared/PropertyThumb.tsx";
import { Field } from "../shared/Field.tsx";
import { CurrencyInput } from "../shared/CurrencyInput.tsx";
import { EmptyState } from "../shared/EmptyState.tsx";
import { Skeleton, SkeletonLine } from "../shared/Skeleton.tsx";
import { PageHeader } from "../shared/PageHeader.tsx";

type SortKey =
  | "default"
  | "cashflow_desc"
  | "cashflow_asc"
  | "coc_desc"
  | "coc_asc";

type PortfolioFilter = "all" | "in" | "out";
type ViewMode = "cards" | "rows";

const PORTFOLIO_OPTIONS = [
  { value: "all", label: "All" },
  { value: "in", label: "In portfolio" },
  { value: "out", label: "Not in" },
] as const;

const VIEW_OPTIONS = [
  { value: "cards", label: "Cards" },
  { value: "rows", label: "Rows" },
] as const;

function fmtCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  return `${value < 0 ? "-" : ""}$${abs.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

function thumbKindFor(propertyType: string): PropertyThumbKind {
  if (propertyType === "multi_family") return "multi-unit";
  if (propertyType === "townhouse") return "duplex";
  if (propertyType === "condo") return "cape";
  return "default";
}

function cashflowToneClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-ink-3";
  if (value >= 0) return "text-accent";
  return "text-negative";
}

export function Dashboard() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState(0);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [portfolioFilter, setPortfolioFilter] =
    useState<PortfolioFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [showQuickTest, setShowQuickTest] = useState(false);

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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleTogglePortfolio = useCallback(
    async (id: string, current: boolean) => {
      try {
        await updateProperty(id, {
          in_portfolio: !current,
        } as Partial<import("../../types/index.ts").Property>);
        void fetchProperties();
      } catch {
        /* ignore */
      }
    },
    [fetchProperties]
  );

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
        listing_price: newPrice,
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
      setNewPrice(0);
      navigate(`/property/${property.id}`);
    } catch {
      setError("Failed to create property");
    } finally {
      setCreating(false);
    }
  }, [newName, newPrice, navigate]);

  const handleScrape = useCallback(async () => {
    if (!scrapeUrl.trim()) return;
    try {
      setScraping(true);
      setScrapeError(null);
      const result = await scrapeProperty(scrapeUrl.trim());
      if (result.property_id) {
        navigate(`/property/${result.property_id}`);
      } else {
        setScrapeError(
          result.scraper_result.error_message ??
            "Scrape failed — try creating manually."
        );
      }
    } catch {
      setScrapeError(
        "Failed to fetch property data. Check the URL and try again."
      );
    } finally {
      setScraping(false);
    }
  }, [scrapeUrl, navigate]);

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
    const portfolio = properties.filter((p) => p.in_portfolio);
    if (portfolio.length === 0)
      return { count: 0, avgCashflow: 0, bestCoC: 0, totalInvested: 0 };
    const cashflows = portfolio
      .map((p) => p.monthly_cashflow)
      .filter((v): v is number => v !== null);
    const cocReturns = portfolio
      .map((p) => p.cash_on_cash_return)
      .filter((v): v is number => v !== null);
    const totalInvested = portfolio.reduce(
      (sum, p) => sum + (p.listing_price || 0),
      0
    );
    const avgCashflow =
      cashflows.length > 0
        ? cashflows.reduce((a, b) => a + b, 0) / cashflows.length
        : 0;
    const bestCoC = cocReturns.length > 0 ? Math.max(...cocReturns) : 0;
    return {
      count: portfolio.length,
      avgCashflow,
      bestCoC,
      totalInvested,
    };
  }, [properties]);

  const displayedProperties = useMemo(() => {
    let filtered = properties;
    if (portfolioFilter === "in")
      filtered = filtered.filter((p) => p.in_portfolio);
    else if (portfolioFilter === "out")
      filtered = filtered.filter((p) => !p.in_portfolio);

    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.city.toLowerCase().includes(needle) ||
          p.state.toLowerCase().includes(needle)
      );
    }

    if (sortBy === "default") return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = sortBy.startsWith("cashflow")
        ? a.monthly_cashflow ?? -Infinity
        : a.cash_on_cash_return ?? -Infinity;
      const bVal = sortBy.startsWith("cashflow")
        ? b.monthly_cashflow ?? -Infinity
        : b.cash_on_cash_return ?? -Infinity;
      return sortBy.endsWith("_desc") ? bVal - aVal : aVal - bVal;
    });
  }, [properties, sortBy, portfolioFilter, search]);

  if (loading) {
    return (
      <div className="space-y-10" role="status" aria-label="Loading properties">
        <div className="grid grid-cols-[1fr_520px] gap-10">
          <div className="space-y-4">
            <SkeletonLine className="w-32" />
            <Skeleton className="h-14" />
            <SkeletonLine className="w-3/4" />
          </div>
          <div className="border-t border-rule-strong pt-6 grid grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <SkeletonLine className="w-20" />
                <Skeleton className="h-10" />
              </div>
            ))}
          </div>
        </div>
        <div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-5 border-t border-rule">
              <Skeleton className="h-14 w-14" />
              <div className="flex-1 space-y-2">
                <SkeletonLine className="w-1/3" />
                <SkeletonLine className="w-2/3" />
              </div>
              <SkeletonLine className="w-20" />
              <SkeletonLine className="w-24" />
              <SkeletonLine className="w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-negative mb-4 text-[14px]">{error}</p>
        <button
          type="button"
          onClick={() => void fetchProperties()}
          className="caps px-5 py-2 bg-ink text-canvas rounded hover:opacity-90 transition-opacity"
        >
          Retry
        </button>
      </div>
    );
  }

  const hasProperties = properties.length > 0;

  return (
    <div className="space-y-8">
      {/* Editorial hero */}
      <section>
        <div className="mb-6">
          <PageHeader
            eyebrow="Portfolio"
            title={
              hasProperties
                ? `${properties.length} ${
                    properties.length === 1 ? "property" : "properties"
                  } tracked`
                : "Start tracking a property"
            }
          />
        </div>

        {hasProperties && (
          <MetricStrip>
            <MetricCell
              label="Portfolio"
              value={portfolioStats.count.toString()}
              sub={
                portfolioStats.count === 1 ? "property" : "properties"
              }
            />
            <MetricCell
              label="Avg Cashflow"
              value={
                portfolioStats.count > 0
                  ? `${fmtCurrency(Math.round(portfolioStats.avgCashflow))}/mo`
                  : "—"
              }
              tone={
                portfolioStats.count === 0
                  ? "default"
                  : portfolioStats.avgCashflow >= 0
                  ? "positive"
                  : "negative"
              }
              emphasis="large"
            />
            <MetricCell
              label="Best CoC"
              value={
                portfolioStats.count > 0
                  ? `${portfolioStats.bestCoC.toFixed(1)}%`
                  : "—"
              }
              tone={
                portfolioStats.count === 0
                  ? "default"
                  : portfolioStats.bestCoC >= 0
                  ? "positive"
                  : "negative"
              }
            />
            <MetricCell
              label="Total Invested"
              value={fmtCurrency(portfolioStats.totalInvested)}
            />
          </MetricStrip>
        )}
      </section>

      {/* Toolbar */}
      {hasProperties && (
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <label className="caps text-ink-3" htmlFor="dash-search">
              Search
            </label>
            <input
              id="dash-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, city, state…"
              className="field max-w-xs"
            />
          </div>

          <Segmented
            options={[...PORTFOLIO_OPTIONS]}
            value={portfolioFilter}
            onChange={(v) => setPortfolioFilter(v as PortfolioFilter)}
            ariaLabel="Portfolio filter"
          />

          <div className="flex items-center gap-2">
            <label className="caps text-ink-3" htmlFor="dash-sort">
              Sort
            </label>
            <select
              id="dash-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="text-[13px] bg-transparent border-0 border-b border-rule-strong focus:border-accent outline-none text-ink py-0.5 cursor-pointer"
            >
              <option value="default">Default</option>
              <option value="cashflow_desc">Cashflow ↓</option>
              <option value="cashflow_asc">Cashflow ↑</option>
              <option value="coc_desc">CoC ↓</option>
              <option value="coc_asc">CoC ↑</option>
            </select>
          </div>

          <Segmented
            options={[...VIEW_OPTIONS]}
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            ariaLabel="View mode"
          />

          <div className="flex items-center gap-2 ml-auto">
            {selectedIds.size >= 2 && (
              <button
                type="button"
                onClick={handleCompare}
                className="caps px-4 py-2 border border-rule-strong rounded hover:bg-paper transition-colors"
              >
                Compare · {selectedIds.size}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShowQuickTest(true);
                setShowNewForm(false);
              }}
              className="caps px-4 py-2 border border-rule-strong rounded hover:bg-paper transition-colors"
            >
              Quick test
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewForm(true);
                setShowQuickTest(false);
              }}
              className="caps px-4 py-2 bg-ink text-canvas rounded hover:opacity-90 transition-opacity"
            >
              + New property
            </button>
          </div>
        </div>
      )}

      {showQuickTest && <QuickTest onClose={() => setShowQuickTest(false)} />}

      {showNewForm && (
        <AddPropertyForm
          scrapeUrl={scrapeUrl}
          setScrapeUrl={setScrapeUrl}
          scraping={scraping}
          scrapeError={scrapeError}
          setScrapeError={setScrapeError}
          onScrape={handleScrape}
          newName={newName}
          setNewName={setNewName}
          newPrice={newPrice}
          setNewPrice={setNewPrice}
          creating={creating}
          onCreate={handleCreate}
          onCancel={() => {
            setShowNewForm(false);
            setNewName("");
            setNewPrice(0);
            setScrapeUrl("");
            setScrapeError(null);
          }}
        />
      )}

      {/* Property list */}
      {!hasProperties ? (
        <EmptyState
          title="No properties yet"
          body="Create your first property to get started."
          actions={
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setShowQuickTest(true)}
                className="caps px-4 py-2 border border-rule-strong rounded hover:bg-paper transition-colors"
              >
                Quick test
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(true)}
                className="caps px-4 py-2 bg-ink text-canvas rounded hover:opacity-90 transition-opacity"
              >
                + New property
              </button>
            </div>
          }
        />
      ) : displayedProperties.length === 0 ? (
        <EmptyState
          title="No matching properties"
          body="Try changing the filter or search above."
        />
      ) : viewMode === "rows" ? (
        <PropertyRows
          properties={displayedProperties}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onTogglePortfolio={handleTogglePortfolio}
          onDelete={setDeleteTarget}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedProperties.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              selected={selectedIds.has(p.id)}
              onToggleSelect={handleToggleSelect}
              onDelete={setDeleteTarget}
              onTogglePortfolio={handleTogglePortfolio}
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

// --- Rows view ------------------------------------------------------------

function PropertyRows({
  properties,
  selectedIds,
  onToggleSelect,
  onTogglePortfolio,
  onDelete,
}: {
  properties: PropertySummary[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onTogglePortfolio: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="border border-rule-strong rounded overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-paper">
          <tr className="border-b border-rule">
            <th className="w-10 px-3 py-3" />
            <th className="w-16 px-3 py-3" />
            <th className="px-3 py-3 text-left caps">Property</th>
            <th className="px-3 py-3 text-right caps">Price</th>
            <th className="px-3 py-3 text-left caps">Beds · Ba · Sqft</th>
            <th className="px-3 py-3 text-right caps">Cashflow</th>
            <th className="px-3 py-3 text-right caps">CoC</th>
            <th className="px-3 py-3 text-right caps">Type</th>
            <th className="w-10 px-3 py-3" />
            <th className="w-28 px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {properties.map((p) => {
            const selected = selectedIds.has(p.id);
            return (
              <tr
                key={p.id}
                className={`border-b border-rule last:border-0 transition-colors ${
                  selected ? "bg-paper" : "hover:bg-paper"
                }`}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleSelect(p.id)}
                    className="accent-ink cursor-pointer"
                    aria-label={`Select ${p.name}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="w-14 h-10 overflow-hidden rounded-sm border border-rule">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <PropertyThumb kind={thumbKindFor(p.property_type)} />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/property/${p.id}`)}
                    className="text-left min-w-0 max-w-xs"
                  >
                    <div className="font-serif text-[16px] leading-tight text-ink truncate hover:underline">
                      {p.name}
                    </div>
                    <div className="text-[12px] text-ink-3 truncate">
                      {p.city}, {p.state}
                    </div>
                  </button>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                  {fmtCurrency(p.listing_price)}
                </td>
                <td className="px-3 py-2 text-ink-2 text-[13px] whitespace-nowrap">
                  {p.beds} · {p.baths}
                  {p.sqft > 0 && ` · ${p.sqft.toLocaleString()}`}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${cashflowToneClass(
                    p.monthly_cashflow
                  )}`}
                >
                  {p.monthly_cashflow !== null
                    ? `${fmtCurrency(p.monthly_cashflow)}/mo`
                    : "—"}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${cashflowToneClass(
                    p.cash_on_cash_return
                  )}`}
                >
                  {fmtPct(p.cash_on_cash_return)}
                </td>
                <td className="px-3 py-2 text-right">
                  <RentalBadge
                    type={p.active_rental_type === "ltr" ? "LTR" : "STR"}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => onTogglePortfolio(p.id, p.in_portfolio)}
                    title={
                      p.in_portfolio
                        ? "Remove from portfolio"
                        : "Add to portfolio"
                    }
                    className={`text-[16px] ${
                      p.in_portfolio
                        ? "text-accent"
                        : "text-ink-3 hover:text-ink"
                    }`}
                  >
                    {p.in_portfolio ? "★" : "☆"}
                  </button>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => navigate(`/property/${p.id}`)}
                    className="caps text-ink-2 hover:text-ink px-2 py-1"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(p.id)}
                    className="caps text-ink-3 hover:text-negative px-2 py-1"
                    aria-label={`Delete ${p.name}`}
                  >
                    Del
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- Add Property form ----------------------------------------------------

function AddPropertyForm({
  scrapeUrl,
  setScrapeUrl,
  scraping,
  scrapeError,
  setScrapeError,
  onScrape,
  newName,
  setNewName,
  newPrice,
  setNewPrice,
  creating,
  onCreate,
  onCancel,
}: {
  scrapeUrl: string;
  setScrapeUrl: (v: string) => void;
  scraping: boolean;
  scrapeError: string | null;
  setScrapeError: (v: string | null) => void;
  onScrape: () => void;
  newName: string;
  setNewName: (v: string) => void;
  newPrice: number;
  setNewPrice: (v: number) => void;
  creating: boolean;
  onCreate: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border border-rule-strong rounded p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-[22px] text-ink">New property</h2>
        <button
          type="button"
          onClick={onCancel}
          className="caps text-ink-3 hover:text-ink"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Field
              label="Import from Redfin"
              type="url"
              value={scrapeUrl}
              placeholder="Paste a Redfin URL…"
              disabled={scraping}
              onChange={(e) => {
                setScrapeUrl(e.target.value);
                setScrapeError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") onScrape();
              }}
            />
          </div>
          <button
            type="button"
            onClick={onScrape}
            disabled={scraping || !scrapeUrl.trim()}
            className="caps px-4 py-2 bg-ink text-canvas rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity whitespace-nowrap"
          >
            {scraping ? "Fetching…" : "Fetch"}
          </button>
        </div>
        {scraping && (
          <p className="text-[12px] text-ink-3 mt-2">
            Fetching property data from Redfin…
          </p>
        )}
        {scrapeError && (
          <p className="text-[12px] text-negative mt-2">{scrapeError}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-rule" />
        <span className="caps text-ink-3">Or enter manually</span>
        <div className="flex-1 border-t border-rule" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_200px_auto] gap-4 items-end">
        <Field
          label="Property Name"
          value={newName}
          placeholder='e.g., "Lake House"'
          onChange={(e) => setNewName(e.target.value)}
        />
        <CurrencyInput
          label="Listing Price"
          value={newPrice}
          onChange={(v) => setNewPrice(v)}
        />
        <button
          type="button"
          onClick={onCreate}
          disabled={creating || !newName.trim()}
          className="caps px-4 py-2 bg-ink text-canvas rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity whitespace-nowrap"
        >
          {creating ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  );
}

