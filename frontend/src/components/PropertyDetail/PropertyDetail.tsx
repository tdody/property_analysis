import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Property } from "../../types/index.ts";
import type { MortgageScenario } from "../../types/index.ts";
import { PropertyInfoTab } from "./PropertyInfoTab.tsx";
import { FinancingTab } from "./FinancingTab.tsx";

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
}: PropertyDetailProps) {
  const [activeTab, setActiveTab] = useState<TabName>("Property Info");
  const navigate = useNavigate();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            &larr; Back to Dashboard
          </button>
          <h2 className="text-2xl font-bold text-gray-900">{property.name}</h2>
          {property.address && (
            <p className="text-sm text-gray-500">
              {property.address}, {property.city}, {property.state} {property.zip_code}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex gap-0 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
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
            <div className="text-center py-12 text-gray-500">Loading scenarios...</div>
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
          <div className="text-center py-12 text-gray-500">Revenue & Expenses tab coming soon</div>
        )}
        {activeTab === "Results" && (
          <div className="text-center py-12 text-gray-500">Results tab coming soon</div>
        )}
      </div>
    </div>
  );
}
