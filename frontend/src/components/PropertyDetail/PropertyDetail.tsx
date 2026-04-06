import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Property } from "../../types/index.ts";
import type { MortgageScenario, STRAssumptions, LTRAssumptions } from "../../types/index.ts";
import { exportPDF } from "../../api/client.ts";
import { PropertyInfoTab } from "./PropertyInfoTab.tsx";
import { FinancingTab } from "./FinancingTab.tsx";
import { RevenueExpensesTab } from "./RevenueExpensesTab.tsx";
import { ResultsTab } from "./ResultsTab.tsx";

const TABS = ["Property Info", "Financing", "Revenue & Expenses", "Results"] as const;
type TabName = (typeof TABS)[number];

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
  const navigate = useNavigate();

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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-indigo-600 hover:text-indigo-800 mb-2 inline-block"
          >
            &larr; Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{property.name}</h2>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              property.active_rental_type === 'ltr'
                ? 'bg-violet-100 text-violet-700'
                : 'bg-sky-100 text-sky-700'
            }`}>
              {property.active_rental_type === 'ltr' ? 'LTR' : 'STR'}
            </span>
          </div>
          {property.address && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {property.address}, {property.city}, {property.state} {property.zip_code}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {exportError && (
            <span className="text-sm text-red-600 dark:text-red-400">Export failed</span>
          )}
          <button
            onClick={() => void handleExportPDF()}
            disabled={exporting}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-md shadow-indigo-200 dark:shadow-indigo-900/30 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {exporting ? "Generating PDF..." : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Tabs — pill/segment style */}
      <div className="mb-6">
        <nav className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 inline-flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100 font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "Property Info" && (
          <PropertyInfoTab property={property} onUpdate={onUpdateProperty} />
        )}
        {activeTab === "Financing" && (
          scenariosLoading ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading scenarios...</div>
          ) : (
            <FinancingTab
              scenarios={scenarios}
              listingPrice={property.listing_price}
              onCreateScenario={onCreateScenario}
              onUpdateScenario={onUpdateScenario}
              onDeleteScenario={onDeleteScenario}
              onDuplicateScenario={onDuplicateScenario}
              onActivateScenario={onActivateScenario}
            />
          )
        )}
        {activeTab === "Revenue & Expenses" && (
          (assumptionsLoading || ltrLoading) ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading assumptions...</div>
          ) : assumptions ? (
            <RevenueExpensesTab
              assumptions={assumptions}
              onUpdate={onUpdateAssumptions}
              ltrAssumptions={ltrAssumptions}
              onUpdateLTR={onUpdateLTRAssumptions}
              activeRentalType={property.active_rental_type}
              onChangeRentalType={(type) => onUpdateProperty({ active_rental_type: type })}
            />
          ) : (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">No assumptions data available</div>
          )
        )}
        {activeTab === "Results" && (
          <ResultsTab propertyId={property.id} scenarios={scenarios} activeRentalType={property.active_rental_type} />
        )}
      </div>
    </div>
  );
}
