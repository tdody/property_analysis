"""Snapshot creation, diffing, and restore logic."""

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.scenario import MortgageScenario
from app.models.assumptions import STRAssumptions
from app.models.ltr_assumptions import LTRAssumptions
from app.models.snapshot import ScenarioSnapshot
from app.schemas.scenario import ScenarioResponse
from app.schemas.assumptions import AssumptionsResponse
from app.schemas.ltr_assumptions import LTRAssumptionsResponse
from app.services.analysis import compute_for_scenario, compute_for_scenario_ltr

MAX_SNAPSHOTS = 20

# --- Field registry for diff labeling ---
# Maps dotted field paths to (label, category, format)
FIELD_REGISTRY: dict[str, tuple[str, str, str]] = {
    # Scenario / Mortgage fields
    "scenario.loan_type": ("Loan Type", "Mortgage", "text"),
    "scenario.purchase_price": ("Purchase Price", "Mortgage", "currency"),
    "scenario.down_payment_pct": ("Down Payment %", "Mortgage", "percent"),
    "scenario.down_payment_amt": ("Down Payment $", "Mortgage", "currency"),
    "scenario.interest_rate": ("Interest Rate", "Mortgage", "percent"),
    "scenario.loan_term_years": ("Loan Term", "Mortgage", "number"),
    "scenario.io_period_years": ("IO Period", "Mortgage", "number"),
    "scenario.closing_cost_pct": ("Closing Costs %", "Mortgage", "percent"),
    "scenario.closing_cost_amt": ("Closing Costs $", "Mortgage", "currency"),
    "scenario.renovation_cost": ("Renovation Cost", "Mortgage", "currency"),
    "scenario.furniture_cost": ("Furniture Cost", "Mortgage", "currency"),
    "scenario.other_upfront_costs": ("Other Upfront Costs", "Mortgage", "currency"),
    "scenario.pmi_monthly": ("PMI Monthly", "Mortgage", "currency"),
    "scenario.origination_points_pct": ("Origination Points %", "Mortgage", "percent"),
    # STR Revenue & Occupancy
    "assumptions.avg_nightly_rate": (
        "Avg Nightly Rate",
        "Revenue & Occupancy",
        "currency",
    ),
    "assumptions.occupancy_pct": ("Occupancy %", "Revenue & Occupancy", "percent"),
    "assumptions.cleaning_fee_per_stay": (
        "Cleaning Fee / Stay",
        "Revenue & Occupancy",
        "currency",
    ),
    "assumptions.avg_stay_length_nights": (
        "Avg Stay Length",
        "Revenue & Occupancy",
        "number",
    ),
    "assumptions.platform_fee_pct": (
        "Platform Fee %",
        "Revenue & Occupancy",
        "percent",
    ),
    "assumptions.use_seasonal_occupancy": (
        "Seasonal Occupancy",
        "Revenue & Occupancy",
        "text",
    ),
    "assumptions.peak_months": ("Peak Months", "Revenue & Occupancy", "number"),
    "assumptions.peak_occupancy_pct": (
        "Peak Occupancy %",
        "Revenue & Occupancy",
        "percent",
    ),
    "assumptions.off_peak_occupancy_pct": (
        "Off-Peak Occupancy %",
        "Revenue & Occupancy",
        "percent",
    ),
    # LTR Revenue
    "assumptions.monthly_rent": ("Monthly Rent", "Revenue & Occupancy", "currency"),
    "assumptions.lease_duration_months": (
        "Lease Duration",
        "Revenue & Occupancy",
        "number",
    ),
    "assumptions.pet_rent_monthly": ("Pet Rent", "Revenue & Occupancy", "currency"),
    "assumptions.late_fee_monthly": ("Late Fee", "Revenue & Occupancy", "currency"),
    "assumptions.vacancy_rate_pct": (
        "Vacancy Rate %",
        "Revenue & Occupancy",
        "percent",
    ),
    "assumptions.lease_up_period_months": (
        "Lease-Up Period",
        "Revenue & Occupancy",
        "number",
    ),
    # STR Expenses
    "assumptions.cleaning_cost_per_turn": (
        "Cleaning Cost / Turn",
        "Expenses",
        "currency",
    ),
    "assumptions.property_mgmt_pct": ("Property Mgmt %", "Expenses", "percent"),
    "assumptions.utilities_monthly": ("Utilities / Month", "Expenses", "currency"),
    "assumptions.insurance_annual": ("Insurance / Year", "Expenses", "currency"),
    "assumptions.maintenance_reserve_pct": (
        "Maintenance Reserve %",
        "Expenses",
        "percent",
    ),
    "assumptions.capex_reserve_pct": ("CapEx Reserve %", "Expenses", "percent"),
    "assumptions.damage_reserve_pct": ("Damage Reserve %", "Expenses", "percent"),
    "assumptions.supplies_monthly": ("Supplies / Month", "Expenses", "currency"),
    "assumptions.lawn_snow_monthly": ("Lawn & Snow / Month", "Expenses", "currency"),
    "assumptions.other_monthly_expense": ("Other Monthly", "Expenses", "currency"),
    "assumptions.marketing_monthly": ("Marketing / Month", "Expenses", "currency"),
    "assumptions.software_monthly": ("Software / Month", "Expenses", "currency"),
    "assumptions.accounting_annual": ("Accounting / Year", "Expenses", "currency"),
    "assumptions.legal_annual": ("Legal / Year", "Expenses", "currency"),
    "assumptions.vacancy_reserve_pct": ("Vacancy Reserve %", "Expenses", "percent"),
    "assumptions.rental_delay_months": ("Rental Delay", "Expenses", "number"),
    # LTR-specific Expenses
    "assumptions.landlord_repairs_annual": ("Repairs / Year", "Expenses", "currency"),
    "assumptions.tenant_turnover_cost": (
        "Tenant Turnover Cost",
        "Expenses",
        "currency",
    ),
    # Tax fields (STR)
    "assumptions.state_rooms_tax_pct": ("State Rooms Tax %", "Expenses", "percent"),
    "assumptions.str_surcharge_pct": ("STR Surcharge %", "Expenses", "percent"),
    "assumptions.local_option_tax_pct": ("Local Option Tax %", "Expenses", "percent"),
    "assumptions.local_str_registration_fee": (
        "Registration Fee",
        "Expenses",
        "currency",
    ),
    "assumptions.local_gross_receipts_tax_pct": (
        "Gross Receipts Tax %",
        "Expenses",
        "percent",
    ),
    "assumptions.platform_remits_tax": ("Platform Remits Tax", "Expenses", "text"),
    # Growth / Depreciation / Tax
    "assumptions.land_value_pct": ("Land Value %", "Expenses", "percent"),
    "assumptions.property_appreciation_pct_annual": (
        "Appreciation %",
        "Expenses",
        "percent",
    ),
    "assumptions.revenue_growth_pct": ("Revenue Growth %", "Expenses", "percent"),
    "assumptions.expense_growth_pct": ("Expense Growth %", "Expenses", "percent"),
    "assumptions.marginal_tax_rate_pct": ("Marginal Tax Rate %", "Expenses", "percent"),
    # Exit & Sale (STR)
    "assumptions.hold_period_years": ("Hold Period (years)", "Exit & Sale", "number"),
    "assumptions.selling_cost_pct": ("Selling Cost %", "Exit & Sale", "percent"),
    "assumptions.capital_gains_rate_pct": (
        "Capital Gains Rate %",
        "Exit & Sale",
        "percent",
    ),
    "assumptions.depreciation_recapture_rate_pct": (
        "Depreciation Recapture Rate %",
        "Exit & Sale",
        "percent",
    ),
    # Monthly Revenue Profile (STR)
    "assumptions.profile_template_name": (
        "Revenue Profile Template",
        "Revenue & Occupancy",
        "text",
    ),
    "assumptions.monthly_revenue_profile": (
        "12-Month Revenue Profile",
        "Revenue & Occupancy",
        "profile",
    ),
    # Computed Metrics (flat key metrics from results)
    "results.metrics.monthly_cashflow": ("Monthly Cashflow", "Metrics", "currency"),
    "results.metrics.annual_cashflow": ("Annual Cashflow", "Metrics", "currency"),
    "results.metrics.cash_on_cash_return": (
        "Cash-on-Cash Return",
        "Metrics",
        "percent",
    ),
    "results.metrics.cap_rate": ("Cap Rate", "Metrics", "percent"),
    "results.metrics.noi": ("NOI", "Metrics", "currency"),
    "results.metrics.dscr": ("DSCR", "Metrics", "number"),
    "results.metrics.gross_yield": ("Gross Yield", "Metrics", "percent"),
    "results.metrics.total_roi_year1": ("Total ROI Year 1", "Metrics", "percent"),
    "results.metrics.break_even_occupancy": (
        "Break-Even Occupancy",
        "Metrics",
        "percent",
    ),
    "results.metrics.break_even_vacancy_pct": (
        "Break-Even Vacancy",
        "Metrics",
        "percent",
    ),
    "results.mortgage.loan_amount": ("Loan Amount", "Metrics", "currency"),
    "results.mortgage.monthly_pi": ("Monthly P&I", "Metrics", "currency"),
    "results.mortgage.total_monthly_housing": (
        "Total Monthly Housing",
        "Metrics",
        "currency",
    ),
    "results.mortgage.total_cash_invested": (
        "Total Cash Invested",
        "Metrics",
        "currency",
    ),
    "results.revenue.gross_annual": ("Gross Revenue", "Metrics", "currency"),
    "results.revenue.net_annual": ("Net Revenue", "Metrics", "currency"),
    "results.revenue.effective_annual": ("Effective Revenue", "Metrics", "currency"),
    "results.expenses.total_annual_operating": (
        "Total Operating Expenses",
        "Metrics",
        "currency",
    ),
}


def _get_nested(d: dict, dotted_key: str):
    """Retrieve a value from a nested dict using a dotted key like 'results.metrics.noi'."""
    parts = dotted_key.split(".")
    current = d
    for part in parts:
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def compute_diff(old_state: dict, new_state: dict) -> dict:
    """Compare two snapshot-shaped dicts and return changes."""
    rental_type_changed = old_state.get("rental_type") != new_state.get("rental_type")
    changes = []

    for field_path, (label, category, fmt) in FIELD_REGISTRY.items():
        if rental_type_changed and field_path.startswith("assumptions."):
            continue

        old_val = _get_nested(old_state, field_path)
        new_val = _get_nested(new_state, field_path)

        if old_val is None and new_val is None:
            continue

        if old_val != new_val:
            direction = None
            if isinstance(old_val, (int, float)) and isinstance(new_val, (int, float)):
                direction = "increased" if new_val > old_val else "decreased"

            changes.append(
                {
                    "field": field_path,
                    "label": label,
                    "category": category,
                    "old_value": old_val,
                    "new_value": new_val,
                    "format": fmt,
                    "direction": direction,
                }
            )

    all_present = 0
    for field_path in FIELD_REGISTRY:
        if rental_type_changed and field_path.startswith("assumptions."):
            continue
        old_val = _get_nested(old_state, field_path)
        new_val = _get_nested(new_state, field_path)
        if old_val is not None or new_val is not None:
            all_present += 1

    return {
        "total_changes": len(changes),
        "changes": changes,
        "unchanged_count": all_present - len(changes),
        "rental_type_changed": rental_type_changed,
        "snapshot_rental_type": old_state.get("rental_type"),
        "current_rental_type": new_state.get("rental_type"),
    }


def _serialize_results(results: dict) -> dict:
    """Convert compute_for_scenario output to a JSON-safe dict."""
    serialized = {}
    for key, value in results.items():
        if hasattr(value, "model_dump"):
            serialized[key] = value.model_dump()
        elif isinstance(value, dict):
            serialized[key] = value
        else:
            serialized[key] = value
    return serialized


def build_snapshot_data(
    prop: Property,
    scenario: MortgageScenario,
    db: Session,
) -> dict:
    """Build the full snapshot_data dict for the current state."""
    rental_type = prop.active_rental_type or "str"

    scenario_data = ScenarioResponse.model_validate(scenario).model_dump()

    if rental_type == "ltr":
        ltr = (
            db.query(LTRAssumptions)
            .filter(LTRAssumptions.property_id == prop.id)
            .first()
        )
        assumptions_data = (
            LTRAssumptionsResponse.model_validate(ltr).model_dump() if ltr else {}
        )
        results = compute_for_scenario_ltr(prop, scenario, ltr) if ltr else {}
    else:
        str_a = (
            db.query(STRAssumptions)
            .filter(STRAssumptions.property_id == prop.id)
            .first()
        )
        assumptions_data = (
            AssumptionsResponse.model_validate(str_a).model_dump() if str_a else {}
        )
        results = compute_for_scenario(prop, scenario, str_a) if str_a else {}

    return {
        "scenario": scenario_data,
        "assumptions": assumptions_data,
        "rental_type": rental_type,
        "results": _serialize_results(results),
    }


def create_snapshot(
    prop: Property,
    scenario: MortgageScenario,
    db: Session,
    name: str | None = None,
    is_auto: bool = False,
) -> ScenarioSnapshot:
    """Create a new snapshot for the given scenario."""
    if not is_auto:
        count = (
            db.query(ScenarioSnapshot)
            .filter(ScenarioSnapshot.scenario_id == scenario.id)
            .count()
        )
        if count >= MAX_SNAPSHOTS:
            raise ValueError(
                f"Snapshot limit reached ({MAX_SNAPSHOTS}). Delete an older snapshot to save a new one."
            )

    if not name:
        if is_auto:
            name = (
                f"Before restore - {datetime.now(timezone.utc).strftime('%b %d, %Y')}"
            )
        else:
            count = (
                db.query(ScenarioSnapshot)
                .filter(ScenarioSnapshot.scenario_id == scenario.id)
                .count()
            )
            name = f"Snapshot #{count + 1} - {datetime.now(timezone.utc).strftime('%b %d, %Y')}"

    data = build_snapshot_data(prop, scenario, db)

    snapshot = ScenarioSnapshot(
        scenario_id=scenario.id,
        name=name,
        snapshot_data=json.dumps(data),
    )
    db.add(snapshot)
    db.flush()
    return snapshot


def restore_snapshot(
    prop: Property,
    scenario: MortgageScenario,
    snapshot: ScenarioSnapshot,
    db: Session,
) -> ScenarioSnapshot:
    """Auto-snapshot current state, then overwrite scenario + assumptions from snapshot."""
    auto = create_snapshot(prop, scenario, db, is_auto=True)

    data = (
        json.loads(snapshot.snapshot_data)
        if isinstance(snapshot.snapshot_data, str)
        else snapshot.snapshot_data
    )
    scenario_data = data.get("scenario", {})
    assumptions_data = data.get("assumptions", {})
    rental_type = data.get("rental_type", "str")

    skip_fields = {"id", "property_id"}
    for field, value in scenario_data.items():
        if field not in skip_fields:
            setattr(scenario, field, value)

    skip_assumption_fields = {"id", "property_id"}
    if rental_type == "ltr":
        ltr = (
            db.query(LTRAssumptions)
            .filter(LTRAssumptions.property_id == prop.id)
            .first()
        )
        if ltr:
            for field, value in assumptions_data.items():
                if field not in skip_assumption_fields:
                    setattr(ltr, field, value)
    else:
        str_a = (
            db.query(STRAssumptions)
            .filter(STRAssumptions.property_id == prop.id)
            .first()
        )
        if str_a:
            for field, value in assumptions_data.items():
                if field not in skip_assumption_fields:
                    setattr(str_a, field, value)

    prop.active_rental_type = rental_type

    from app.routers.properties import _recompute_cache

    _recompute_cache(prop, db)

    db.flush()
    return auto
