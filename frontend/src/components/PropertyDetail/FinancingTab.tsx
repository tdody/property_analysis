import { useCallback, useState } from "react";
import type { MortgageScenario } from "../../types/index.ts";
import { ScenarioCard } from "./ScenarioCard.tsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.tsx";

interface FinancingTabProps {
  scenarios: MortgageScenario[];
  listingPrice: number;
  onCreateScenario: (data: Partial<MortgageScenario>) => Promise<MortgageScenario>;
  onUpdateScenario: (id: string, data: Partial<MortgageScenario>) => Promise<MortgageScenario>;
  onDeleteScenario: (id: string) => Promise<void>;
  onDuplicateScenario: (id: string) => Promise<MortgageScenario>;
  onActivateScenario: (id: string) => Promise<void>;
}

export function FinancingTab({
  scenarios,
  listingPrice,
  onCreateScenario,
  onUpdateScenario,
  onDeleteScenario,
  onDuplicateScenario,
  onActivateScenario,
}: FinancingTabProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    const downPct = 25;
    const downAmt = Math.round(listingPrice * downPct / 100);
    const closingPct = 3;
    const closingAmt = Math.round(listingPrice * closingPct / 100);
    await onCreateScenario({
      name: `Scenario ${scenarios.length + 1}`,
      loan_type: "conventional",
      purchase_price: listingPrice,
      down_payment_pct: downPct,
      down_payment_amt: downAmt,
      interest_rate: 7.25,
      loan_term_years: 30,
      closing_cost_pct: closingPct,
      closing_cost_amt: closingAmt,
      renovation_cost: 0,
      furniture_cost: 0,
      other_upfront_costs: 0,
      pmi_monthly: 0,
    });
  }, [listingPrice, scenarios.length, onCreateScenario]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await onDeleteScenario(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, onDeleteScenario]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">Mortgage Scenarios</h3>
        <button
          onClick={() => void handleAdd()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          + Add Scenario
        </button>
      </div>

      {scenarios.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500 mb-2">No financing scenarios yet</p>
          <p className="text-gray-400 text-sm mb-4">Add a scenario to model different financing options</p>
          <button
            onClick={() => void handleAdd()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            + Add Scenario
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {scenarios.map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              onUpdate={onUpdateScenario}
              onDelete={setDeleteTarget}
              onDuplicate={(id) => void onDuplicateScenario(id)}
              onActivate={(id) => void onActivateScenario(id)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Scenario"
        message="Are you sure you want to delete this scenario?"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
