import { useCallback, useEffect, useMemo, useState } from "react";
import type { MortgageScenario } from "../../types/index.ts";
import { listSnapshots } from "../../api/client.ts";
import { FormSection } from "../shared/FormSection.tsx";
import { Field } from "../shared/Field.tsx";
import { SliderField } from "../shared/SliderField.tsx";
import { CurrencyInput } from "../shared/CurrencyInput.tsx";
import { MetricCell, MetricStrip } from "../shared/MetricCell.tsx";
import { SparklineAmort } from "../shared/SparklineAmort.tsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.tsx";
import { ScenarioCard } from "./ScenarioCard.tsx";
import { SnapshotButton } from "./SnapshotButton.tsx";
import { HistoryDrawer } from "./HistoryDrawer.tsx";

interface FinancingTabProps {
  propertyId: string;
  scenarios: MortgageScenario[];
  listingPrice: number;
  onCreateScenario: (data: Partial<MortgageScenario>) => Promise<MortgageScenario>;
  onUpdateScenario: (
    id: string,
    data: Partial<MortgageScenario>
  ) => Promise<MortgageScenario>;
  onDeleteScenario: (id: string) => Promise<void>;
  onDuplicateScenario: (id: string) => Promise<MortgageScenario>;
  onActivateScenario: (id: string) => Promise<void>;
  onRestored?: () => void;
}

const LOAN_TYPES = [
  { value: "conventional", label: "Conventional" },
  { value: "dscr", label: "DSCR" },
  { value: "fha", label: "FHA" },
  { value: "portfolio", label: "Portfolio" },
  { value: "cash", label: "Cash" },
];

function formatCurrency(value: number): string {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  const formatted = `$${abs.toLocaleString("en-US")}`;
  return rounded < 0 ? `-${formatted}` : formatted;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function calcMonthlyPI(
  loanAmount: number,
  annualRate: number,
  termYears: number
): number {
  if (loanAmount <= 0 || annualRate <= 0 || termYears <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  return (loanAmount * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

export function FinancingTab({
  propertyId,
  scenarios,
  listingPrice,
  onCreateScenario,
  onUpdateScenario,
  onDeleteScenario,
  onDuplicateScenario,
  onActivateScenario,
  onRestored,
}: FinancingTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<MortgageScenario | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snapshotCount, setSnapshotCount] = useState(0);

  // Pick default selected scenario: active, else first.
  useEffect(() => {
    if (scenarios.length === 0) {
      setSelectedId(null);
      setForm(null);
      return;
    }
    if (!selectedId || !scenarios.find((s) => s.id === selectedId)) {
      const preferred = scenarios.find((s) => s.is_active) ?? scenarios[0];
      setSelectedId(preferred.id);
    }
  }, [scenarios, selectedId]);

  // Sync form to the selected scenario whenever it changes upstream.
  useEffect(() => {
    if (!selectedId) {
      setForm(null);
      return;
    }
    const next = scenarios.find((s) => s.id === selectedId);
    if (next) {
      setForm({ ...next });
      setSaved(false);
    }
  }, [selectedId, scenarios]);

  // Load snapshot count for the selected scenario.
  const loadSnapshotCount = useCallback(async () => {
    if (!selectedId) {
      setSnapshotCount(0);
      return;
    }
    try {
      const snaps = await listSnapshots(propertyId, selectedId);
      setSnapshotCount(snaps.length);
    } catch {
      /* ignore */
    }
  }, [propertyId, selectedId]);

  useEffect(() => {
    void loadSnapshotCount();
  }, [loadSnapshotCount]);

  const selectedScenario = useMemo(
    () => scenarios.find((s) => s.id === selectedId) ?? null,
    [scenarios, selectedId]
  );

  const updateField = useCallback(
    <K extends keyof MortgageScenario>(key: K, value: MortgageScenario[K]) => {
      setForm((prev) => {
        if (!prev) return prev;
        const next = { ...prev, [key]: value };
        if (key === "down_payment_pct") {
          next.down_payment_amt = Math.round(
            (next.purchase_price * (value as number)) / 100
          );
        } else if (key === "down_payment_amt") {
          next.down_payment_pct =
            next.purchase_price > 0
              ? Math.round(((value as number) / next.purchase_price) * 10000) / 100
              : 0;
        } else if (key === "purchase_price") {
          next.down_payment_amt = Math.round(
            ((value as number) * next.down_payment_pct) / 100
          );
          next.closing_cost_amt = Math.round(
            ((value as number) * next.closing_cost_pct) / 100
          );
        } else if (key === "closing_cost_amt") {
          next.closing_cost_pct =
            next.purchase_price > 0
              ? Math.round(((value as number) / next.purchase_price) * 10000) / 100
              : 0;
        }
        return next;
      });
      setSaved(false);
    },
    []
  );

  const handleAdd = useCallback(async () => {
    const downPct = 25;
    const downAmt = Math.round((listingPrice * downPct) / 100);
    const closingPct = 3;
    const closingAmt = Math.round((listingPrice * closingPct) / 100);
    const created = await onCreateScenario({
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
    setSelectedId(created.id);
  }, [listingPrice, scenarios.length, onCreateScenario]);

  const handleSave = useCallback(async () => {
    if (!form || !selectedId) return;
    try {
      setSaving(true);
      await onUpdateScenario(selectedId, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [form, onUpdateScenario, selectedId]);

  const handleDuplicate = useCallback(async () => {
    if (!selectedId) return;
    const dup = await onDuplicateScenario(selectedId);
    setSelectedId(dup.id);
  }, [selectedId, onDuplicateScenario]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const remainingBefore = scenarios.filter((s) => s.id !== deleteTarget);
    await onDeleteScenario(deleteTarget);
    if (deleteTarget === selectedId) {
      const fallback =
        remainingBefore.find((s) => s.is_active) ?? remainingBefore[0] ?? null;
      setSelectedId(fallback?.id ?? null);
    }
    setDeleteTarget(null);
  }, [deleteTarget, onDeleteScenario, scenarios, selectedId]);

  const handleActivate = useCallback(
    (id: string) => {
      void onActivateScenario(id);
    },
    [onActivateScenario]
  );

  // Derived live summary values
  const loanAmount = form ? form.purchase_price - form.down_payment_amt : 0;
  const isCash = form?.loan_type === "cash";
  const monthlyPI = form ? calcMonthlyPI(loanAmount, form.interest_rate, form.loan_term_years) : 0;
  const originationFee = form ? loanAmount * (form.origination_points_pct / 100) : 0;
  const cashIn = form
    ? form.down_payment_amt +
      form.closing_cost_amt +
      form.renovation_cost +
      form.furniture_cost +
      form.other_upfront_costs +
      originationFee
    : 0;
  const ltv = form && form.purchase_price > 0 ? (loanAmount / form.purchase_price) * 100 : 0;

  const isDirty =
    form !== null &&
    selectedScenario !== null &&
    JSON.stringify(form) !== JSON.stringify(selectedScenario);

  if (scenarios.length === 0 || !form || !selectedScenario) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-8">
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void handleAdd()}
            className="w-full caps py-3 border border-rule-strong rounded hover:bg-paper transition-colors"
          >
            + New scenario
          </button>
        </div>
        <div className="border border-rule rounded p-10 text-center">
          <p className="font-serif text-[20px] text-ink mb-2">
            No financing scenarios yet
          </p>
          <p className="text-[13px] text-ink-3 mb-6">
            Add a scenario to model different financing options.
          </p>
          <button
            type="button"
            onClick={() => void handleAdd()}
            className="caps px-5 py-2 bg-ink text-canvas rounded hover:opacity-90 transition-opacity"
          >
            + New scenario
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-8">
      {/* Scenario rail */}
      <aside className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="caps">Scenarios</h3>
          <span className="text-[12px] text-ink-3 font-mono tabular-nums">
            {scenarios.length}
          </span>
        </div>
        {scenarios.map((s) => (
          <ScenarioCard
            key={s.id}
            scenario={s}
            selected={s.id === selectedId}
            onSelect={setSelectedId}
            onActivate={handleActivate}
          />
        ))}
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="w-full caps py-3 border border-rule-strong rounded hover:bg-paper transition-colors"
        >
          + New scenario
        </button>
      </aside>

      {/* Editor */}
      <div className="min-w-0 space-y-10">
        {/* Top bar */}
        <div className="flex items-start justify-between gap-4 border-b border-rule-strong pb-5">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Untitled scenario"
              className="font-serif text-[32px] leading-tight text-ink bg-transparent border-0 outline-none w-full placeholder:text-ink-3"
              aria-label="Scenario name"
            />
            <div className="flex items-center gap-2 mt-2">
              <label className="caps text-ink-3" htmlFor="loan-type">
                Loan type
              </label>
              <select
                id="loan-type"
                value={form.loan_type}
                onChange={(e) => updateField("loan_type", e.target.value)}
                className="text-[13px] bg-transparent border-0 border-b border-rule-strong focus:border-accent outline-none text-ink py-0.5 cursor-pointer"
              >
                {LOAN_TYPES.map((lt) => (
                  <option key={lt.value} value={lt.value}>
                    {lt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!selectedScenario.is_active && (
              <button
                type="button"
                onClick={() => handleActivate(selectedScenario.id)}
                className="caps px-3 py-1.5 border border-rule-strong rounded hover:bg-paper transition-colors"
              >
                Make primary
              </button>
            )}
            {selectedScenario.is_active && (
              <span className="caps text-accent px-3 py-1.5 border border-accent rounded">
                Primary
              </span>
            )}
          </div>
        </div>

        {/* Purchase price */}
        <div className="max-w-xs">
          <CurrencyInput
            label="Purchase Price"
            value={form.purchase_price}
            onChange={(v) => updateField("purchase_price", v)}
            tooltip="Your offer price. May differ from the listing price."
          />
        </div>

        {/* Live summary */}
        <MetricStrip>
          <MetricCell
            label="Loan Amount"
            value={formatCurrency(isCash ? 0 : loanAmount)}
          />
          <MetricCell
            label={isCash ? "Cash Outlay" : "Monthly P&I"}
            value={formatCurrency(isCash ? cashIn : monthlyPI)}
            emphasis="large"
            tone={isCash ? "default" : "default"}
          />
          <MetricCell label="Cash In" value={formatCurrency(cashIn)} />
          <MetricCell
            label="LTV"
            value={isCash ? "—" : formatPercent(ltv)}
          />
        </MetricStrip>

        {/* Amortization sparkline */}
        {!isCash && (
          <div>
            <div className="caps text-ink-3 mb-2">Balance over time</div>
            <SparklineAmort
              key={`${selectedId}-${form.loan_term_years}`}
              loanAmount={loanAmount}
              interestRate={form.interest_rate}
              termYears={form.loan_term_years}
              ioPeriodYears={form.io_period_years}
              height={90}
            />
            <div className="flex justify-between text-[11px] text-ink-3 mt-1 font-mono tabular-nums">
              <span>Today</span>
              <span>Year {form.loan_term_years}</span>
            </div>
          </div>
        )}

        {/* Loan terms */}
        {!isCash && (
          <FormSection
            title="Loan Terms"
            subtitle="Drag to explore the impact on payment and equity."
          >
            <SliderField
              label="Interest Rate"
              value={form.interest_rate}
              min={2}
              max={12}
              step={0.125}
              suffix="%"
              onChange={(v) => updateField("interest_rate", v)}
            />
            <SliderField
              label="Loan Term"
              value={form.loan_term_years}
              min={5}
              max={40}
              step={1}
              suffix=" yr"
              onChange={(v) => updateField("loan_term_years", v)}
            />
            <SliderField
              label="Down Payment %"
              value={form.down_payment_pct}
              min={0}
              max={100}
              step={1}
              suffix="%"
              sub={`= ${formatCurrency(form.down_payment_amt)}`}
              onChange={(v) => updateField("down_payment_pct", v)}
            />
            <SliderField
              label="Origination Points %"
              value={form.origination_points_pct}
              min={0}
              max={5}
              step={0.25}
              suffix="%"
              sub={`= ${formatCurrency(originationFee)}`}
              onChange={(v) => updateField("origination_points_pct", v)}
            />
          </FormSection>
        )}

        {/* Upfront costs */}
        <FormSection
          title="Upfront Costs"
          subtitle="One-time cash to close and get STR-ready."
        >
          <CurrencyInput
            label="Closing Costs"
            value={form.closing_cost_amt}
            onChange={(v) => updateField("closing_cost_amt", v)}
            tooltip="Lender fees, title, appraisal, recording, prepaids. Typical 2–5% of price."
          />
          <CurrencyInput
            label="Renovation"
            value={form.renovation_cost}
            onChange={(v) => updateField("renovation_cost", v)}
            tooltip="One-time cost to get the property STR-ready."
          />
          <CurrencyInput
            label="Furniture"
            value={form.furniture_cost}
            onChange={(v) => updateField("furniture_cost", v)}
            tooltip="Rule of thumb: $3–5K per bedroom for mid-range furnishing."
          />
          <CurrencyInput
            label="Other Upfront"
            value={form.other_upfront_costs}
            onChange={(v) => updateField("other_upfront_costs", v)}
            tooltip="Inspection, warranty, smart locks, photography, etc."
          />
        </FormSection>

        {/* Conditional advanced fields */}
        {form.loan_type === "conventional" && form.down_payment_pct < 20 && (
          <div className="max-w-xs">
            <CurrencyInput
              label="PMI (Monthly)"
              value={form.pmi_monthly}
              onChange={(v) => updateField("pmi_monthly", v)}
              tooltip="Required for conventional loans with <20% down."
            />
          </div>
        )}
        {(form.loan_type === "dscr" || form.loan_type === "portfolio") && (
          <div className="max-w-xs">
            <Field
              label="IO Period (years)"
              type="number"
              min={0}
              max={10}
              step={1}
              value={form.io_period_years}
              onChange={(e) =>
                updateField("io_period_years", parseInt(e.target.value) || 0)
              }
            />
          </div>
        )}

        {/* Action row */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-rule">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="caps px-5 py-2 bg-ink text-canvas rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => void handleDuplicate()}
            className="caps px-4 py-2 border border-rule-strong rounded hover:bg-paper transition-colors"
          >
            Duplicate
          </button>
          <SnapshotButton
            propertyId={propertyId}
            scenarioId={selectedScenario.id}
            dirty={isDirty}
            onPersistForm={handleSave}
            onSnapshotCreated={loadSnapshotCount}
          />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="caps px-4 py-2 border border-rule-strong rounded hover:bg-paper transition-colors inline-flex items-center gap-2"
          >
            History
            {snapshotCount > 0 && (
              <span className="font-mono tabular-nums text-[11px] text-ink-3">
                ({snapshotCount})
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(selectedScenario.id)}
            className="caps px-4 py-2 text-negative hover:bg-negative-soft rounded transition-colors ml-auto"
          >
            Delete
          </button>
          {saved && <span className="caps text-accent">Saved</span>}
        </div>
      </div>

      <HistoryDrawer
        propertyId={propertyId}
        scenarioId={selectedScenario.id}
        scenarioName={form.name || "Untitled scenario"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRestored={() => {
          void loadSnapshotCount();
          onRestored?.();
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Scenario"
        message="Are you sure you want to delete this scenario?"
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
