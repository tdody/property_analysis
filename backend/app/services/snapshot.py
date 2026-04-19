"""Snapshot creation, diffing, and restore logic.

Snapshots are scenario-scoped: they capture only the mortgage scenario state.
Property-level assumptions and computed results are intentionally excluded —
see THI-27 / THI-28 for the broader property-level history work.
"""

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.scenario import MortgageScenario
from app.models.snapshot import ScenarioSnapshot
from app.schemas.scenario import ScenarioResponse

MAX_SNAPSHOTS = 20

# Maps dotted scenario field paths to (label, category, format)
FIELD_REGISTRY: dict[str, tuple[str, str, str]] = {
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
}


def _get_nested(d: dict, dotted_key: str):
    """Retrieve a value from a nested dict using a dotted key like 'scenario.interest_rate'."""
    parts = dotted_key.split(".")
    current = d
    for part in parts:
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def compute_diff(old_state: dict, new_state: dict) -> dict:
    """Compare two snapshot-shaped dicts and return changes."""
    changes = []

    for field_path, (label, category, fmt) in FIELD_REGISTRY.items():
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
        old_val = _get_nested(old_state, field_path)
        new_val = _get_nested(new_state, field_path)
        if old_val is not None or new_val is not None:
            all_present += 1

    return {
        "total_changes": len(changes),
        "changes": changes,
        "unchanged_count": all_present - len(changes),
    }


def build_snapshot_data(
    prop: Property,
    scenario: MortgageScenario,
    db: Session,
) -> dict:
    """Build the scenario-only snapshot_data dict for the current state."""
    scenario_data = ScenarioResponse.model_validate(scenario).model_dump()
    return {"scenario": scenario_data}


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
    """Auto-snapshot current state, then overwrite scenario fields from snapshot."""
    auto = create_snapshot(prop, scenario, db, is_auto=True)

    data = (
        json.loads(snapshot.snapshot_data)
        if isinstance(snapshot.snapshot_data, str)
        else snapshot.snapshot_data
    )
    scenario_data = data.get("scenario", {})

    skip_fields = {"id", "property_id"}
    for field, value in scenario_data.items():
        if field not in skip_fields:
            setattr(scenario, field, value)

    from app.routers.properties import _recompute_cache

    _recompute_cache(prop, db)

    db.flush()
    return auto
