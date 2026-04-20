import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type {
  Property,
  MortgageScenario,
  STRAssumptions,
  LTRAssumptions,
} from "../../types/index.ts";
import {
  exportPDF,
  getResults,
  getResultsForScenario,
  getLTRResults,
} from "../../api/client.ts";
import { RentalBadge } from "../shared/RentalBadge.tsx";
import { MetricCell, MetricStrip } from "../shared/MetricCell.tsx";
import { Skeleton, SkeletonLine } from "../shared/Skeleton.tsx";
import { PropertyInfoTab } from "./PropertyInfoTab.tsx";
import { FinancingTab } from "./FinancingTab.tsx";
import { RevenueExpensesTab } from "./RevenueExpensesTab.tsx";
import { ResultsTab } from "./ResultsTab.tsx";
import { SensitivityTab } from "./SensitivityTab.tsx";

const TABS = [
  "Property Info",
  "Financing",
  "Revenue & Expenses",
  "Results",
  "Sensitivity",
] as const;
type TabName = (typeof TABS)[number];

interface HeadlineMetrics {
  monthly_cashflow: number;
  cash_on_cash_return: number;
  cap_rate: number;
  dscr: number;
}

interface PropertyDetailProps {
  property: Property;
  onUpdateProperty: (updates: Partial<Property>) => Promise<Property>;
  scenarios: MortgageScenario[];
  scenariosLoading: boolean;
  onCreateScenario: (data: Partial<MortgageScenario>) => Promise<MortgageScenario>;
  onUpdateScenario: (id: string, data: Partial<MortgageScenario>) => Promise<MortgageScenario>;
  onDeleteScenario: (id: string) => Promise<void>;
  onDuplicateScenario: (id: string) => Promise<MortgageScenario>;
  onActivateScenario: (id: string) => Promise<void>;
  assumptions: STRAssumptions | null;
  assumptionsLoading: boolean;
  onUpdateAssumptions: (updates: Partial<STRAssumptions>) => Promise<STRAssumptions>;
  ltrAssumptions: LTRAssumptions | null;
  ltrLoading: boolean;
  onUpdateLTRAssumptions: (updates: Partial<LTRAssumptions>) => Promise<LTRAssumptions>;
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = `$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return value < 0 ? `-${formatted}` : formatted;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function dscrTone(value: number): "positive" | "warn" | "negative" {
  if (value >= 1.25) return "positive";
  if (value >= 1.0) return "warn";
  return "negative";
}

export function PropertyDetail({
  property,
  onUpdateProperty,
  scenarios,
  scenariosLoading,
  onCreateScenario,
  onUpdateScenario,
  onDeleteScenario,
  onDuplicateScenario,
  onActivateScenario,
  assumptions,
  assumptionsLoading,
  onUpdateAssumptions,
  ltrAssumptions,
  ltrLoading,
  onUpdateLTRAssumptions,
}: PropertyDetailProps) {
  const [activeTab, setActiveTab] = useState<TabName>("Property Info");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [metrics, setMetrics] = useState<HeadlineMetrics | null>(null);
  const navigate = useNavigate();

  const activeScenario = scenarios.find((s) => s.is_active);
  const activeScenarioId = activeScenario?.id;

  useEffect(() => {
    let cancelled = false;

    async function loadMetrics() {
      try {
        if (property.active_rental_type === "ltr") {
          const result = await getLTRResults(property.id);
          if (!cancelled) setMetrics(result.metrics);
        } else if (activeScenarioId) {
          const result = await getResultsForScenario(property.id, activeScenarioId);
          if (!cancelled) setMetrics(result.metrics);
        } else if (scenarios.length === 0) {
          setMetrics(null);
        } else {
          const result = await getResults(property.id);
          if (!cancelled) setMetrics(result.metrics);
        }
      } catch {
        if (!cancelled) setMetrics(null);
      }
    }

    void loadMetrics();
    return () => {
      cancelled = true;
    };
  }, [property.id, property.active_rental_type, activeScenarioId, scenarios.length]);

  const handleExportPDF = async () => {
    setExporting(true);
    setExportError(false);
    try {
      const blob = await exportPDF(property.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${property.name.replace(/ /g, "_")}_lender_packet.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
      setTimeout(() => setExportError(false), 4000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="pb-12">
      {/* Breadcrumb */}
      <button
        type="button"
        onClick={() => navigate("/")}
        className="caps text-ink-3 hover:text-ink mb-4 inline-flex items-center gap-1 transition-colors"
      >
        ← All properties
      </button>

      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <RentalBadge
              type={property.active_rental_type === "ltr" ? "LTR" : "STR"}
            />
            <h1 className="font-serif text-[40px] leading-tight text-ink">
              {property.name}
            </h1>
          </div>
          {property.address && (
            <p className="text-[14px] text-ink-3">
              {property.address}, {property.city}, {property.state}{" "}
              {property.zip_code}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {exportError && (
            <span className="text-[13px] text-negative">Export failed</span>
          )}
          <button
            type="button"
            onClick={() => void handleExportPDF()}
            disabled={exporting}
            className="caps px-4 py-2 border border-rule-strong rounded hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {exporting ? "Generating…" : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Metric strip */}
      {metrics && (
        <MetricStrip className="mb-8">
          <MetricCell
            label="Monthly Cashflow"
            value={formatCurrency(metrics.monthly_cashflow)}
            emphasis="large"
            tone={metrics.monthly_cashflow >= 0 ? "positive" : "negative"}
          />
          <MetricCell
            label="Cash-on-Cash"
            value={formatPercent(metrics.cash_on_cash_return)}
            tone={metrics.cash_on_cash_return >= 0 ? "default" : "negative"}
          />
          <MetricCell
            label="Cap Rate"
            value={formatPercent(metrics.cap_rate)}
          />
          <MetricCell
            label="DSCR"
            value={metrics.dscr.toFixed(2)}
            tone={dscrTone(metrics.dscr)}
          />
        </MetricStrip>
      )}

      {/* Underlined tab bar */}
      <div className="border-b border-rule-strong mb-6 overflow-x-auto">
        <nav
          className="flex gap-6 min-w-max"
          role="tablist"
          aria-label="Property detail sections"
        >
          {TABS.map((tab, i) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => setActiveTab(tab)}
                onKeyDown={(e) => {
                  let next: number | null = null;
                  if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
                  else if (e.key === "ArrowLeft")
                    next = (i - 1 + TABS.length) % TABS.length;
                  else if (e.key === "Home") next = 0;
                  else if (e.key === "End") next = TABS.length - 1;
                  if (next === null) return;
                  e.preventDefault();
                  setActiveTab(TABS[next]);
                  const buttons =
                    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                      '[role="tab"]',
                    );
                  buttons?.[next]?.focus();
                }}
                className={`pb-3 -mb-px text-[14px] whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? "text-ink border-ink font-medium"
                    : "text-ink-3 border-transparent hover:text-ink-2"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content (fade-up on every tab switch via key remount) */}
      <div key={activeTab} className="tab-panel">
        {activeTab === "Property Info" && (
          <PropertyInfoTab property={property} onUpdate={onUpdateProperty} />
        )}
        {activeTab === "Financing" &&
          (scenariosLoading ? (
            <div className="grid grid-cols-[280px_1fr] gap-8" role="status" aria-label="Loading scenarios">
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
              <div className="space-y-6">
                <Skeleton className="h-10 w-2/3" />
                <Skeleton className="h-24" />
                <Skeleton className="h-48" />
              </div>
            </div>
          ) : (
            <FinancingTab
              propertyId={property.id}
              scenarios={scenarios}
              listingPrice={property.listing_price}
              onCreateScenario={onCreateScenario}
              onUpdateScenario={onUpdateScenario}
              onDeleteScenario={onDeleteScenario}
              onDuplicateScenario={onDuplicateScenario}
              onActivateScenario={onActivateScenario}
            />
          ))}
        {activeTab === "Revenue & Expenses" &&
          (assumptionsLoading || ltrLoading ? (
            <div className="space-y-8" role="status" aria-label="Loading assumptions">
              {Array.from({ length: 3 }).map((_, section) => (
                <div key={section} className="grid grid-cols-[200px_1fr] gap-8">
                  <div className="space-y-2">
                    <SkeletonLine className="w-32" />
                    <SkeletonLine className="w-24" />
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <SkeletonLine className="w-20" />
                        <Skeleton className="h-8" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : assumptions ? (
            <RevenueExpensesTab
              propertyId={property.id}
              assumptions={assumptions}
              onUpdate={onUpdateAssumptions}
              ltrAssumptions={ltrAssumptions}
              onUpdateLTR={onUpdateLTRAssumptions}
              activeRentalType={property.active_rental_type}
              onChangeRentalType={(type) =>
                onUpdateProperty({ active_rental_type: type })
              }
            />
          ) : (
            <div className="text-center py-12 text-ink-3">
              No assumptions data available
            </div>
          ))}
        {activeTab === "Results" && (
          <ResultsTab
            propertyId={property.id}
            scenarios={scenarios}
            activeRentalType={property.active_rental_type}
          />
        )}
        {activeTab === "Sensitivity" && (
          <SensitivityTab
            propertyId={property.id}
            activeRentalType={property.active_rental_type}
          />
        )}
      </div>
    </div>
  );
}
