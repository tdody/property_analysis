import type { MortgageScenario } from "../../types/index.ts";

interface ScenarioCardProps {
  scenario: MortgageScenario;
  selected: boolean;
  onSelect: (id: string) => void;
  onActivate: (id: string) => void;
}

const LOAN_TYPE_LABELS: Record<string, string> = {
  conventional: "Conventional",
  dscr: "DSCR",
  fha: "FHA",
  cash: "Cash",
  portfolio: "Portfolio",
};

function monthlyPI(scenario: MortgageScenario): number {
  if (scenario.loan_type === "cash") return 0;
  const loanAmount = scenario.purchase_price - scenario.down_payment_amt;
  if (loanAmount <= 0 || scenario.interest_rate <= 0 || scenario.loan_term_years <= 0) {
    return 0;
  }
  const r = scenario.interest_rate / 100 / 12;
  const n = scenario.loan_term_years * 12;
  return (loanAmount * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

export function ScenarioCard({ scenario, selected, onSelect, onActivate }: ScenarioCardProps) {
  const pi = Math.round(monthlyPI(scenario));
  const loanLabel =
    LOAN_TYPE_LABELS[scenario.loan_type] ?? scenario.loan_type;
  const subtitle =
    scenario.loan_type === "cash"
      ? "Cash"
      : `${loanLabel} · ${scenario.loan_term_years}yr · ${scenario.interest_rate}%`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(scenario.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(scenario.id);
        }
      }}
      className={`block w-full text-left border rounded p-3 cursor-pointer transition-colors ${
        selected
          ? "border-ink bg-paper"
          : "border-rule hover:border-rule-strong"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onActivate(scenario.id);
          }}
          aria-label={scenario.is_active ? "Active scenario" : "Make active"}
          title={scenario.is_active ? "Active scenario" : "Make active"}
          className={`text-[15px] leading-none mt-0.5 ${
            scenario.is_active ? "text-accent" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          {scenario.is_active ? "★" : "☆"}
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[17px] leading-tight text-ink truncate">
            {scenario.name || "Untitled scenario"}
          </div>
          <div className="text-[12px] text-ink-3 mt-0.5 truncate">
            {subtitle}
          </div>
        </div>
      </div>
      <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-rule">
        <span className="caps text-ink-3">
          {scenario.loan_type === "cash" ? "Cash" : "Monthly P&I"}
        </span>
        <span className="font-mono tabular-nums text-[13px] text-ink">
          ${pi.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
