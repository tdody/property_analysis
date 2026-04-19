# Scenario Version History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to snapshot a scenario's full state and compare snapshots to understand the impact of changes.

**Architecture:** New `scenario_snapshots` table with JSON blob storage. Backend service handles serialization (calling compute service for results), diffing, and restore logic. Frontend adds snapshot/history buttons to ScenarioCard and a slide-over drawer with diff view.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic (backend); React, TypeScript, Tailwind (frontend)

**Spec:** `docs/superpowers/specs/2026-04-14-scenario-version-history-design.md`

---

### Task 1: Backend Model — ScenarioSnapshot

**Files:**
- Create: `backend/app/models/snapshot.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/main.py` (import for table creation)

- [ ] **Step 1: Create the ORM model**

```python
# backend/app/models/snapshot.py
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ScenarioSnapshot(Base):
    __tablename__ = "scenario_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    scenario_id: Mapped[str] = mapped_column(String(36), ForeignKey("mortgage_scenarios.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), default="")
    snapshot_data: Mapped[str] = mapped_column(Text, default="{}")  # JSON stored as text for SQLite
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    scenario: Mapped["MortgageScenario"] = relationship()
```

- [ ] **Step 2: Register model in `__init__.py`**

Add to `backend/app/models/__init__.py`:
```python
from app.models.snapshot import ScenarioSnapshot
```

And add `ScenarioSnapshot` to the `__all__` list.

- [ ] **Step 3: Import model in `main.py` for table auto-creation**

Add `ScenarioSnapshot` to the import in `backend/app/main.py` line 7:
```python
from app.models import Property, MortgageScenario, STRAssumptions, LTRAssumptions, ScenarioSnapshot  # noqa: F401
```

- [ ] **Step 4: Verify table creation**

Run: `cd backend && python -c "from app.main import app; print('OK')"`
Expected: `OK` (no import errors)

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/snapshot.py backend/app/models/__init__.py backend/app/main.py
git commit -m "feat(snapshot): add ScenarioSnapshot ORM model"
```

---

### Task 2: Backend Schemas — Pydantic Models

**Files:**
- Create: `backend/app/schemas/snapshot.py`

- [ ] **Step 1: Create Pydantic schemas**

```python
# backend/app/schemas/snapshot.py
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SnapshotCreate(BaseModel):
    name: str | None = None


class SnapshotListItem(BaseModel):
    id: str
    scenario_id: str
    name: str
    created_at: datetime
    monthly_cashflow: float | None = None
    cash_on_cash_return: float | None = None

    model_config = {"from_attributes": True}


class SnapshotResponse(BaseModel):
    id: str
    scenario_id: str
    name: str
    snapshot_data: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class DiffChange(BaseModel):
    field: str
    label: str
    category: str
    old_value: Any
    new_value: Any
    format: str  # "currency", "percent", "number", "text"
    direction: str | None = None  # "increased", "decreased", None


class DiffResponse(BaseModel):
    snapshot_name: str
    snapshot_date: datetime
    total_changes: int
    changes: list[DiffChange]
    unchanged_count: int
    rental_type_changed: bool = False
    snapshot_rental_type: str | None = None
    current_rental_type: str | None = None
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/snapshot.py
git commit -m "feat(snapshot): add Pydantic schemas for snapshots"
```

---

### Task 3: Backend Service — Snapshot Logic (Create, Diff, Restore)

**Files:**
- Create: `backend/app/services/snapshot.py`
- Test: `backend/tests/test_snapshot_service.py`

- [ ] **Step 1: Write tests for the diff utility**

```python
# backend/tests/test_snapshot_service.py
import pytest
from app.services.snapshot import compute_diff, FIELD_REGISTRY


class TestComputeDiff:
    def test_detects_changed_numeric_field(self):
        old = {"scenario": {"interest_rate": 5.5}, "assumptions": {}, "results": {}, "rental_type": "str"}
        new = {"scenario": {"interest_rate": 5.25}, "assumptions": {}, "results": {}, "rental_type": "str"}
        diff = compute_diff(old, new)
        changed = [c for c in diff["changes"] if c["field"] == "scenario.interest_rate"]
        assert len(changed) == 1
        assert changed[0]["old_value"] == 5.5
        assert changed[0]["new_value"] == 5.25
        assert changed[0]["direction"] == "decreased"

    def test_ignores_unchanged_fields(self):
        state = {"scenario": {"interest_rate": 5.5, "loan_type": "conventional"}, "assumptions": {}, "results": {}, "rental_type": "str"}
        diff = compute_diff(state, state)
        assert diff["total_changes"] == 0
        assert len(diff["changes"]) == 0

    def test_rental_type_mismatch(self):
        old = {"scenario": {}, "assumptions": {"avg_nightly_rate": 200}, "results": {}, "rental_type": "str"}
        new = {"scenario": {}, "assumptions": {"monthly_rent": 2000}, "results": {}, "rental_type": "ltr"}
        diff = compute_diff(old, new)
        assert diff["rental_type_changed"] is True
        # Assumption fields should be skipped
        assumption_changes = [c for c in diff["changes"] if c["category"] in ("Revenue & Occupancy", "Expenses")]
        assert len(assumption_changes) == 0

    def test_currency_format_on_price_fields(self):
        old = {"scenario": {"purchase_price": 400000}, "assumptions": {}, "results": {}, "rental_type": "str"}
        new = {"scenario": {"purchase_price": 425000}, "assumptions": {}, "results": {}, "rental_type": "str"}
        diff = compute_diff(old, new)
        changed = [c for c in diff["changes"] if c["field"] == "scenario.purchase_price"]
        assert changed[0]["format"] == "currency"
        assert changed[0]["direction"] == "increased"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_snapshot_service.py -v`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the snapshot service**

```python
# backend/app/services/snapshot.py
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
    "assumptions.avg_nightly_rate": ("Avg Nightly Rate", "Revenue & Occupancy", "currency"),
    "assumptions.occupancy_pct": ("Occupancy %", "Revenue & Occupancy", "percent"),
    "assumptions.cleaning_fee_per_stay": ("Cleaning Fee / Stay", "Revenue & Occupancy", "currency"),
    "assumptions.avg_stay_length_nights": ("Avg Stay Length", "Revenue & Occupancy", "number"),
    "assumptions.platform_fee_pct": ("Platform Fee %", "Revenue & Occupancy", "percent"),
    "assumptions.use_seasonal_occupancy": ("Seasonal Occupancy", "Revenue & Occupancy", "text"),
    "assumptions.peak_months": ("Peak Months", "Revenue & Occupancy", "number"),
    "assumptions.peak_occupancy_pct": ("Peak Occupancy %", "Revenue & Occupancy", "percent"),
    "assumptions.off_peak_occupancy_pct": ("Off-Peak Occupancy %", "Revenue & Occupancy", "percent"),
    # LTR Revenue
    "assumptions.monthly_rent": ("Monthly Rent", "Revenue & Occupancy", "currency"),
    "assumptions.lease_duration_months": ("Lease Duration", "Revenue & Occupancy", "number"),
    "assumptions.pet_rent_monthly": ("Pet Rent", "Revenue & Occupancy", "currency"),
    "assumptions.late_fee_monthly": ("Late Fee", "Revenue & Occupancy", "currency"),
    "assumptions.vacancy_rate_pct": ("Vacancy Rate %", "Revenue & Occupancy", "percent"),
    "assumptions.lease_up_period_months": ("Lease-Up Period", "Revenue & Occupancy", "number"),
    # STR Expenses
    "assumptions.cleaning_cost_per_turn": ("Cleaning Cost / Turn", "Expenses", "currency"),
    "assumptions.property_mgmt_pct": ("Property Mgmt %", "Expenses", "percent"),
    "assumptions.utilities_monthly": ("Utilities / Month", "Expenses", "currency"),
    "assumptions.insurance_annual": ("Insurance / Year", "Expenses", "currency"),
    "assumptions.maintenance_reserve_pct": ("Maintenance Reserve %", "Expenses", "percent"),
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
    "assumptions.tenant_turnover_cost": ("Tenant Turnover Cost", "Expenses", "currency"),
    # Tax fields (STR)
    "assumptions.state_rooms_tax_pct": ("State Rooms Tax %", "Expenses", "percent"),
    "assumptions.str_surcharge_pct": ("STR Surcharge %", "Expenses", "percent"),
    "assumptions.local_option_tax_pct": ("Local Option Tax %", "Expenses", "percent"),
    "assumptions.local_str_registration_fee": ("Registration Fee", "Expenses", "currency"),
    "assumptions.local_gross_receipts_tax_pct": ("Gross Receipts Tax %", "Expenses", "percent"),
    "assumptions.platform_remits_tax": ("Platform Remits Tax", "Expenses", "text"),
    # Growth / Depreciation / Tax
    "assumptions.land_value_pct": ("Land Value %", "Expenses", "percent"),
    "assumptions.property_appreciation_pct_annual": ("Appreciation %", "Expenses", "percent"),
    "assumptions.revenue_growth_pct": ("Revenue Growth %", "Expenses", "percent"),
    "assumptions.expense_growth_pct": ("Expense Growth %", "Expenses", "percent"),
    "assumptions.marginal_tax_rate_pct": ("Marginal Tax Rate %", "Expenses", "percent"),
    # Computed Metrics (flat key metrics from results)
    "results.metrics.monthly_cashflow": ("Monthly Cashflow", "Metrics", "currency"),
    "results.metrics.annual_cashflow": ("Annual Cashflow", "Metrics", "currency"),
    "results.metrics.cash_on_cash_return": ("Cash-on-Cash Return", "Metrics", "percent"),
    "results.metrics.cap_rate": ("Cap Rate", "Metrics", "percent"),
    "results.metrics.noi": ("NOI", "Metrics", "currency"),
    "results.metrics.dscr": ("DSCR", "Metrics", "number"),
    "results.metrics.gross_yield": ("Gross Yield", "Metrics", "percent"),
    "results.metrics.total_roi_year1": ("Total ROI Year 1", "Metrics", "percent"),
    "results.metrics.break_even_occupancy": ("Break-Even Occupancy", "Metrics", "percent"),
    "results.metrics.break_even_vacancy_pct": ("Break-Even Vacancy", "Metrics", "percent"),
    "results.mortgage.loan_amount": ("Loan Amount", "Metrics", "currency"),
    "results.mortgage.monthly_pi": ("Monthly P&I", "Metrics", "currency"),
    "results.mortgage.total_monthly_housing": ("Total Monthly Housing", "Metrics", "currency"),
    "results.mortgage.total_cash_invested": ("Total Cash Invested", "Metrics", "currency"),
    "results.revenue.gross_annual": ("Gross Revenue", "Metrics", "currency"),
    "results.revenue.net_annual": ("Net Revenue", "Metrics", "currency"),
    "results.revenue.effective_annual": ("Effective Revenue", "Metrics", "currency"),
    "results.expenses.total_annual_operating": ("Total Operating Expenses", "Metrics", "currency"),
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
        # Skip assumption fields when rental types differ
        if rental_type_changed and field_path.startswith("assumptions."):
            continue

        old_val = _get_nested(old_state, field_path)
        new_val = _get_nested(new_state, field_path)

        # Skip if both are None (field doesn't exist in either)
        if old_val is None and new_val is None:
            continue

        if old_val != new_val:
            direction = None
            if isinstance(old_val, (int, float)) and isinstance(new_val, (int, float)):
                direction = "increased" if new_val > old_val else "decreased"

            changes.append({
                "field": field_path,
                "label": label,
                "category": category,
                "old_value": old_val,
                "new_value": new_val,
                "format": fmt,
                "direction": direction,
            })

    # Count unchanged registered fields that exist in both states
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
    """Convert compute_for_scenario output to a JSON-safe dict.

    The STR path returns Pydantic models for mortgage/revenue/expenses/metrics/depreciation,
    while the LTR path returns plain dicts for some of those. Normalize everything to dicts.
    """
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

    # Serialize scenario
    scenario_data = ScenarioResponse.model_validate(scenario).model_dump()

    # Serialize assumptions
    if rental_type == "ltr":
        ltr = db.query(LTRAssumptions).filter(LTRAssumptions.property_id == prop.id).first()
        assumptions_data = LTRAssumptionsResponse.model_validate(ltr).model_dump() if ltr else {}
        results = compute_for_scenario_ltr(prop, scenario, ltr) if ltr else {}
    else:
        str_a = db.query(STRAssumptions).filter(STRAssumptions.property_id == prop.id).first()
        assumptions_data = AssumptionsResponse.model_validate(str_a).model_dump() if str_a else {}
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
    """Create a new snapshot for the given scenario.

    Args:
        is_auto: If True, this is an auto-snapshot before restore (allows exceeding cap).
    """
    if not is_auto:
        count = db.query(ScenarioSnapshot).filter(ScenarioSnapshot.scenario_id == scenario.id).count()
        if count >= MAX_SNAPSHOTS:
            raise ValueError(f"Snapshot limit reached ({MAX_SNAPSHOTS}). Delete an older snapshot to save a new one.")

    # Generate name if not provided
    if not name:
        if is_auto:
            name = f"Before restore - {datetime.now(timezone.utc).strftime('%b %d, %Y')}"
        else:
            count = db.query(ScenarioSnapshot).filter(ScenarioSnapshot.scenario_id == scenario.id).count()
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
    """Auto-snapshot current state, then overwrite scenario + assumptions from snapshot.

    Returns the auto-snapshot that was created.
    """
    # Auto-snapshot current state
    auto = create_snapshot(prop, scenario, db, is_auto=True)

    # Parse snapshot data
    data = json.loads(snapshot.snapshot_data) if isinstance(snapshot.snapshot_data, str) else snapshot.snapshot_data
    scenario_data = data.get("scenario", {})
    assumptions_data = data.get("assumptions", {})
    rental_type = data.get("rental_type", "str")

    # Overwrite scenario fields (skip id, property_id)
    skip_fields = {"id", "property_id"}
    for field, value in scenario_data.items():
        if field not in skip_fields:
            setattr(scenario, field, value)

    # Overwrite assumptions
    skip_assumption_fields = {"id", "property_id"}
    if rental_type == "ltr":
        ltr = db.query(LTRAssumptions).filter(LTRAssumptions.property_id == prop.id).first()
        if ltr:
            for field, value in assumptions_data.items():
                if field not in skip_assumption_fields:
                    setattr(ltr, field, value)
    else:
        str_a = db.query(STRAssumptions).filter(STRAssumptions.property_id == prop.id).first()
        if str_a:
            for field, value in assumptions_data.items():
                if field not in skip_assumption_fields:
                    setattr(str_a, field, value)

    # Update rental type on property
    prop.active_rental_type = rental_type

    # Recompute cached metrics
    from app.routers.properties import _recompute_cache
    _recompute_cache(prop, db)

    db.flush()
    return auto
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_snapshot_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/snapshot.py backend/tests/test_snapshot_service.py
git commit -m "feat(snapshot): add snapshot service with create, diff, and restore"
```

---

### Task 4: Backend Router — Snapshot API Endpoints

**Files:**
- Create: `backend/app/routers/snapshots.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_api_snapshots.py`

- [ ] **Step 1: Write API integration tests**

```python
# backend/tests/test_api_snapshots.py
import pytest


@pytest.fixture
def property_id(client):
    resp = client.post("/api/properties", json={"name": "Test", "listing_price": 400000})
    return resp.json()["id"]


@pytest.fixture
def scenario_id(client, property_id):
    resp = client.post(f"/api/properties/{property_id}/scenarios", json={
        "name": "Test Scenario",
        "purchase_price": 400000,
        "down_payment_pct": 25.0,
        "down_payment_amt": 100000,
        "interest_rate": 7.25,
    })
    return resp.json()["id"]


def _snap_url(property_id, scenario_id):
    return f"/api/properties/{property_id}/scenarios/{scenario_id}/snapshots"


class TestSnapshotCRUD:
    def test_create_snapshot(self, client, property_id, scenario_id):
        resp = client.post(_snap_url(property_id, scenario_id), json={"name": "Initial"})
        assert resp.status_code == 201
        assert resp.json()["name"] == "Initial"
        assert "scenario_id" in resp.json()

    def test_create_snapshot_auto_name(self, client, property_id, scenario_id):
        resp = client.post(_snap_url(property_id, scenario_id), json={})
        assert resp.status_code == 201
        assert resp.json()["name"].startswith("Snapshot #")

    def test_list_snapshots(self, client, property_id, scenario_id):
        client.post(_snap_url(property_id, scenario_id), json={"name": "S1"})
        client.post(_snap_url(property_id, scenario_id), json={"name": "S2"})
        resp = client.get(_snap_url(property_id, scenario_id))
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_get_snapshot(self, client, property_id, scenario_id):
        create_resp = client.post(_snap_url(property_id, scenario_id), json={"name": "Detail"})
        snap_id = create_resp.json()["id"]
        resp = client.get(f"{_snap_url(property_id, scenario_id)}/{snap_id}")
        assert resp.status_code == 200
        assert "snapshot_data" in resp.json()

    def test_delete_snapshot(self, client, property_id, scenario_id):
        create_resp = client.post(_snap_url(property_id, scenario_id), json={"name": "Del"})
        snap_id = create_resp.json()["id"]
        resp = client.delete(f"{_snap_url(property_id, scenario_id)}/{snap_id}")
        assert resp.status_code == 200
        listing = client.get(_snap_url(property_id, scenario_id))
        assert len(listing.json()) == 0

    def test_snapshot_cap_at_20(self, client, property_id, scenario_id):
        for i in range(20):
            resp = client.post(_snap_url(property_id, scenario_id), json={"name": f"S{i}"})
            assert resp.status_code == 201
        resp = client.post(_snap_url(property_id, scenario_id), json={"name": "Over limit"})
        assert resp.status_code == 400

    def test_diff_snapshot(self, client, property_id, scenario_id):
        client.post(_snap_url(property_id, scenario_id), json={"name": "Before"})
        # Change interest rate
        client.put(f"/api/properties/{property_id}/scenarios/{scenario_id}", json={"interest_rate": 6.0})
        listing = client.get(_snap_url(property_id, scenario_id)).json()
        snap_id = listing[0]["id"]
        resp = client.get(f"{_snap_url(property_id, scenario_id)}/{snap_id}/diff")
        assert resp.status_code == 200
        assert resp.json()["total_changes"] > 0

    def test_restore_snapshot(self, client, property_id, scenario_id):
        # Save snapshot at 7.25% rate
        client.post(_snap_url(property_id, scenario_id), json={"name": "Original"})
        # Change rate
        client.put(f"/api/properties/{property_id}/scenarios/{scenario_id}", json={"interest_rate": 6.0})
        # Restore
        listing = client.get(_snap_url(property_id, scenario_id)).json()
        snap_id = listing[0]["id"]
        resp = client.post(f"{_snap_url(property_id, scenario_id)}/{snap_id}/restore")
        assert resp.status_code == 200
        # Verify rate is restored
        scenario = client.get(f"/api/properties/{property_id}/scenarios").json()
        restored = [s for s in scenario if s["id"] == scenario_id][0]
        assert restored["interest_rate"] == 7.25
        # Verify auto-snapshot was created
        snaps = client.get(_snap_url(property_id, scenario_id)).json()
        auto_names = [s["name"] for s in snaps if s["name"].startswith("Before restore")]
        assert len(auto_names) == 1

    def test_restore_at_cap_allows_21st(self, client, property_id, scenario_id):
        """Restore at 20-snapshot cap should allow auto-snapshot as 21st entry."""
        for i in range(20):
            client.post(_snap_url(property_id, scenario_id), json={"name": f"S{i}"})
        # Manual create should fail
        resp = client.post(_snap_url(property_id, scenario_id), json={"name": "Over"})
        assert resp.status_code == 400
        # But restore should succeed (auto-snapshot allowed to exceed cap)
        snaps = client.get(_snap_url(property_id, scenario_id)).json()
        snap_id = snaps[-1]["id"]  # oldest snapshot
        resp = client.post(f"{_snap_url(property_id, scenario_id)}/{snap_id}/restore")
        assert resp.status_code == 200
        # Should now have 21 snapshots
        snaps = client.get(_snap_url(property_id, scenario_id)).json()
        assert len(snaps) == 21

    def test_cascade_delete(self, client, property_id, scenario_id):
        client.post(_snap_url(property_id, scenario_id), json={"name": "Cascade"})
        client.delete(f"/api/properties/{property_id}/scenarios/{scenario_id}")
        # Scenario is gone, so snapshots should be too
        # We can't query snapshots for a deleted scenario via the API,
        # but we can verify the scenario list is empty
        scenarios = client.get(f"/api/properties/{property_id}/scenarios").json()
        assert len(scenarios) == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_api_snapshots.py -v`
Expected: FAIL (router not found, 404s)

- [ ] **Step 3: Implement the router**

```python
# backend/app/routers/snapshots.py
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.models.scenario import MortgageScenario
from app.models.snapshot import ScenarioSnapshot
from app.schemas.snapshot import (
    SnapshotCreate,
    SnapshotListItem,
    SnapshotResponse,
    DiffResponse,
    DiffChange,
)
from app.services.snapshot import (
    create_snapshot,
    build_snapshot_data,
    compute_diff,
    restore_snapshot,
)

router = APIRouter(
    prefix="/api/properties/{property_id}/scenarios/{scenario_id}/snapshots",
    tags=["snapshots"],
)


def _get_prop_and_scenario(property_id: str, scenario_id: str, db: Session):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    scenario = db.query(MortgageScenario).filter(
        MortgageScenario.id == scenario_id,
        MortgageScenario.property_id == property_id,
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return prop, scenario


@router.post("", response_model=SnapshotResponse, status_code=201)
def create_snapshot_endpoint(
    property_id: str,
    scenario_id: str,
    data: SnapshotCreate,
    db: Session = Depends(get_db),
):
    prop, scenario = _get_prop_and_scenario(property_id, scenario_id, db)
    try:
        snapshot = create_snapshot(prop, scenario, db, name=data.name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    db.refresh(snapshot)
    # Parse snapshot_data for response
    resp = SnapshotResponse(
        id=snapshot.id,
        scenario_id=snapshot.scenario_id,
        name=snapshot.name,
        snapshot_data=json.loads(snapshot.snapshot_data),
        created_at=snapshot.created_at,
    )
    return resp


@router.get("", response_model=list[SnapshotListItem])
def list_snapshots(
    property_id: str,
    scenario_id: str,
    db: Session = Depends(get_db),
):
    _get_prop_and_scenario(property_id, scenario_id, db)
    snapshots = (
        db.query(ScenarioSnapshot)
        .filter(ScenarioSnapshot.scenario_id == scenario_id)
        .order_by(ScenarioSnapshot.created_at.desc())
        .all()
    )
    items = []
    for s in snapshots:
        data = json.loads(s.snapshot_data) if isinstance(s.snapshot_data, str) else s.snapshot_data
        metrics = data.get("results", {}).get("metrics", {})
        items.append(SnapshotListItem(
            id=s.id,
            scenario_id=s.scenario_id,
            name=s.name,
            created_at=s.created_at,
            monthly_cashflow=metrics.get("monthly_cashflow"),
            cash_on_cash_return=metrics.get("cash_on_cash_return"),
        ))
    return items


@router.get("/{snapshot_id}", response_model=SnapshotResponse)
def get_snapshot(
    property_id: str,
    scenario_id: str,
    snapshot_id: str,
    db: Session = Depends(get_db),
):
    _get_prop_and_scenario(property_id, scenario_id, db)
    snapshot = db.query(ScenarioSnapshot).filter(
        ScenarioSnapshot.id == snapshot_id,
        ScenarioSnapshot.scenario_id == scenario_id,
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return SnapshotResponse(
        id=snapshot.id,
        scenario_id=snapshot.scenario_id,
        name=snapshot.name,
        snapshot_data=json.loads(snapshot.snapshot_data),
        created_at=snapshot.created_at,
    )


@router.delete("/{snapshot_id}")
def delete_snapshot(
    property_id: str,
    scenario_id: str,
    snapshot_id: str,
    db: Session = Depends(get_db),
):
    _get_prop_and_scenario(property_id, scenario_id, db)
    snapshot = db.query(ScenarioSnapshot).filter(
        ScenarioSnapshot.id == snapshot_id,
        ScenarioSnapshot.scenario_id == scenario_id,
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    db.delete(snapshot)
    db.commit()
    return {"status": "deleted"}


@router.get("/{snapshot_id}/diff", response_model=DiffResponse)
def diff_snapshot(
    property_id: str,
    scenario_id: str,
    snapshot_id: str,
    db: Session = Depends(get_db),
):
    prop, scenario = _get_prop_and_scenario(property_id, scenario_id, db)
    snapshot = db.query(ScenarioSnapshot).filter(
        ScenarioSnapshot.id == snapshot_id,
        ScenarioSnapshot.scenario_id == scenario_id,
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    old_state = json.loads(snapshot.snapshot_data) if isinstance(snapshot.snapshot_data, str) else snapshot.snapshot_data
    new_state = build_snapshot_data(prop, scenario, db)
    diff = compute_diff(old_state, new_state)

    return DiffResponse(
        snapshot_name=snapshot.name,
        snapshot_date=snapshot.created_at,
        total_changes=diff["total_changes"],
        changes=[DiffChange(**c) for c in diff["changes"]],
        unchanged_count=diff["unchanged_count"],
        rental_type_changed=diff["rental_type_changed"],
        snapshot_rental_type=diff["snapshot_rental_type"],
        current_rental_type=diff["current_rental_type"],
    )


@router.post("/{snapshot_id}/restore")
def restore_snapshot_endpoint(
    property_id: str,
    scenario_id: str,
    snapshot_id: str,
    db: Session = Depends(get_db),
):
    prop, scenario = _get_prop_and_scenario(property_id, scenario_id, db)
    snapshot = db.query(ScenarioSnapshot).filter(
        ScenarioSnapshot.id == snapshot_id,
        ScenarioSnapshot.scenario_id == scenario_id,
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    auto_snapshot = restore_snapshot(prop, scenario, snapshot, db)
    db.commit()
    return {"status": "restored", "auto_snapshot_id": auto_snapshot.id, "auto_snapshot_name": auto_snapshot.name}
```

- [ ] **Step 4: Register router in `main.py`**

Add to `backend/app/main.py`:
```python
from app.routers import properties, scenarios, assumptions, compute, ltr_assumptions, settings, snapshots
```
And:
```python
app.include_router(snapshots.router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_api_snapshots.py -v`
Expected: PASS

- [ ] **Step 6: Run full backend test suite**

Run: `cd backend && python -m pytest -v`
Expected: All tests PASS (no regressions)

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/snapshots.py backend/app/main.py backend/tests/test_api_snapshots.py
git commit -m "feat(snapshot): add snapshot API endpoints with CRUD, diff, and restore"
```

---

### Task 5: Frontend Types & API Client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add TypeScript interfaces**

Add to `frontend/src/types/index.ts`:

```typescript
export interface SnapshotListItem {
  id: string;
  scenario_id: string;
  name: string;
  created_at: string;
  monthly_cashflow: number | null;
  cash_on_cash_return: number | null;
}

export interface SnapshotDetail {
  id: string;
  scenario_id: string;
  name: string;
  snapshot_data: Record<string, unknown>;
  created_at: string;
}

export interface DiffChange {
  field: string;
  label: string;
  category: string;
  old_value: unknown;
  new_value: unknown;
  format: string;
  direction: string | null;
}

export interface DiffResponse {
  snapshot_name: string;
  snapshot_date: string;
  total_changes: number;
  changes: DiffChange[];
  unchanged_count: number;
  rental_type_changed: boolean;
  snapshot_rental_type: string | null;
  current_rental_type: string | null;
}
```

- [ ] **Step 2: Add API client methods**

Add to `frontend/src/api/client.ts`:

```typescript
// Snapshots
export const listSnapshots = (propertyId: string, scenarioId: string) =>
  api.get<SnapshotListItem[]>(`/properties/${propertyId}/scenarios/${scenarioId}/snapshots`).then((r) => r.data);
export const createSnapshot = (propertyId: string, scenarioId: string, name?: string) =>
  api.post<SnapshotDetail>(`/properties/${propertyId}/scenarios/${scenarioId}/snapshots`, { name: name || null }).then((r) => r.data);
export const getSnapshot = (propertyId: string, scenarioId: string, snapshotId: string) =>
  api.get<SnapshotDetail>(`/properties/${propertyId}/scenarios/${scenarioId}/snapshots/${snapshotId}`).then((r) => r.data);
export const deleteSnapshot = (propertyId: string, scenarioId: string, snapshotId: string) =>
  api.delete(`/properties/${propertyId}/scenarios/${scenarioId}/snapshots/${snapshotId}`);
export const diffSnapshot = (propertyId: string, scenarioId: string, snapshotId: string) =>
  api.get<DiffResponse>(`/properties/${propertyId}/scenarios/${scenarioId}/snapshots/${snapshotId}/diff`).then((r) => r.data);
export const restoreSnapshot = (propertyId: string, scenarioId: string, snapshotId: string) =>
  api.post<{ status: string; auto_snapshot_id: string; auto_snapshot_name: string }>(`/properties/${propertyId}/scenarios/${scenarioId}/snapshots/${snapshotId}/restore`).then((r) => r.data);
```

Don't forget to add the new type imports at the top of `client.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/client.ts
git commit -m "feat(snapshot): add frontend types and API client for snapshots"
```

---

### Task 6: Frontend — SnapshotButton Component

**Files:**
- Create: `frontend/src/components/PropertyDetail/SnapshotButton.tsx`

- [ ] **Step 1: Create SnapshotButton component**

This component renders the "Save Snapshot" button and a small name-input dialog.

```tsx
// frontend/src/components/PropertyDetail/SnapshotButton.tsx
import { useState } from "react";
import { createSnapshot } from "../../api/client";

interface SnapshotButtonProps {
  propertyId: string;
  scenarioId: string;
  onSnapshotCreated: () => void;
}

export function SnapshotButton({ propertyId, scenarioId, onSnapshotCreated }: SnapshotButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await createSnapshot(propertyId, scenarioId, name || undefined);
      setShowDialog(false);
      setName("");
      onSnapshotCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save snapshot";
      if (typeof err === "object" && err !== null && "response" in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(axiosErr.response?.data?.detail || msg);
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-1.5"
      >
        <span>📸</span> Save Snapshot
      </button>

      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDialog(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Save Snapshot</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Capture the current scenario configuration and computed results.
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Before rate drop"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100 mb-3"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDialog(false); setName(""); setError(null); }}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/PropertyDetail/SnapshotButton.tsx
git commit -m "feat(snapshot): add SnapshotButton component with name dialog"
```

---

### Task 7: Frontend — HistoryDrawer Component

**Files:**
- Create: `frontend/src/components/PropertyDetail/HistoryDrawer.tsx`

- [ ] **Step 1: Create HistoryDrawer component**

This is the slide-over drawer with snapshot list and integrated diff view.

```tsx
// frontend/src/components/PropertyDetail/HistoryDrawer.tsx
import { useState, useEffect, useCallback } from "react";
import { listSnapshots, diffSnapshot, restoreSnapshot, deleteSnapshot } from "../../api/client";
import type { SnapshotListItem, DiffResponse } from "../../types";
import { ConfirmDialog } from "../shared/ConfirmDialog";

interface HistoryDrawerProps {
  propertyId: string;
  scenarioId: string;
  scenarioName: string;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}

const MAX_SNAPSHOTS = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function formatValue(value: unknown, format: string): string {
  if (value === null || value === undefined) return "—";
  if (format === "currency") return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (format === "percent") return `${Number(value).toFixed(2)}%`;
  if (format === "number") return String(value);
  return String(value);
}

function formatDelta(oldVal: unknown, newVal: unknown, format: string, direction: string | null): string {
  if (direction === null || oldVal === null || newVal === null) return "—";
  const diff = Math.abs(Number(newVal) - Number(oldVal));
  const arrow = direction === "increased" ? "▲" : "▼";
  if (format === "currency") return `${arrow} $${diff.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (format === "percent") return `${arrow} ${diff.toFixed(2)}%`;
  return `${arrow} ${diff}`;
}

export function HistoryDrawer({ propertyId, scenarioId, scenarioName, open, onClose, onRestored }: HistoryDrawerProps) {
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<SnapshotListItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SnapshotListItem | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSnapshots(propertyId, scenarioId);
      setSnapshots(data);
    } finally {
      setLoading(false);
    }
  }, [propertyId, scenarioId]);

  useEffect(() => {
    if (open) {
      loadSnapshots();
      setDiff(null);
    }
  }, [open, loadSnapshots]);

  const handleCompare = async (snapshotId: string) => {
    setDiffLoading(true);
    try {
      const data = await diffSnapshot(propertyId, scenarioId, snapshotId);
      setDiff(data);
    } finally {
      setDiffLoading(false);
    }
  };

  const handleRestore = async (snapshot: SnapshotListItem) => {
    setRestoring(true);
    try {
      await restoreSnapshot(propertyId, scenarioId, snapshot.id);
      setConfirmRestore(null);
      setDiff(null);
      onRestored();
      onClose();
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async (snapshot: SnapshotListItem) => {
    await deleteSnapshot(propertyId, scenarioId, snapshot.id);
    setConfirmDelete(null);
    loadSnapshots();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-white dark:bg-slate-800 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            {diff && (
              <button onClick={() => setDiff(null)} className="text-indigo-500 hover:text-indigo-600 text-sm mr-1">
                ← Back
              </button>
            )}
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              {diff ? "Compare" : "Version History"}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {diff ? (
            /* Diff View */
            <div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">Comparing</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  📸 "{diff.snapshot_name}" → 📍 Current
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {diff.total_changes} field{diff.total_changes !== 1 ? "s" : ""} changed
                  {diff.rental_type_changed && " (rental type changed)"}
                </p>
              </div>

              {diffLoading ? (
                <div className="p-8 text-center text-slate-400">Loading diff...</div>
              ) : diff.total_changes === 0 ? (
                <div className="p-8 text-center text-slate-400">No changes detected.</div>
              ) : (
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-xs uppercase text-slate-400 dark:text-slate-500">
                        <th className="text-left py-2 px-1">Field</th>
                        <th className="text-left py-2 px-1">Snapshot</th>
                        <th className="text-left py-2 px-1">Current</th>
                        <th className="text-right py-2 px-1">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diff.changes.map((c) => (
                        <tr key={c.field} className="bg-red-50/50 dark:bg-red-900/10">
                          <td className="py-2 px-1 font-medium text-slate-700 dark:text-slate-300">{c.label}</td>
                          <td className="py-2 px-1 text-slate-500 dark:text-slate-400">{formatValue(c.old_value, c.format)}</td>
                          <td className="py-2 px-1 font-semibold text-slate-900 dark:text-slate-100">{formatValue(c.new_value, c.format)}</td>
                          <td className={`py-2 px-1 text-right ${c.direction === "increased" ? "text-green-600" : c.direction === "decreased" ? "text-red-500" : "text-slate-400"}`}>
                            {formatDelta(c.old_value, c.new_value, c.format, c.direction)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {diff.unchanged_count > 0 && (
                    <p className="mt-3 w-full text-center text-sm text-slate-400 dark:text-slate-500">
                      {diff.unchanged_count} unchanged field{diff.unchanged_count !== 1 ? "s" : ""} hidden
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Snapshot List */
            <div>
              <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                {scenarioName} · {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400">Loading...</div>
              ) : snapshots.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  No snapshots yet. Save a snapshot to start tracking changes.
                </div>
              ) : (
                snapshots.map((s) => (
                  <div key={s.id} className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatDate(s.created_at)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          CoC: {s.cash_on_cash_return != null ? `${s.cash_on_cash_return.toFixed(1)}%` : "—"} · Cashflow: {s.monthly_cashflow != null ? `$${Math.round(s.monthly_cashflow).toLocaleString()}/mo` : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <button onClick={() => handleCompare(s.id)} className="text-indigo-500 hover:text-indigo-600">Compare</button>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <button onClick={() => setConfirmRestore(s)} className="text-indigo-500 hover:text-indigo-600">Restore</button>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <button onClick={() => setConfirmDelete(s)} className="text-red-400 hover:text-red-500">Delete</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400 dark:text-slate-500">
          {diff ? (
            <button
              onClick={() => { const snap = snapshots.find((s) => s.name === diff.snapshot_name); if (snap) setConfirmRestore(snap); }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              Restore This Snapshot
            </button>
          ) : (
            `${snapshots.length} of ${MAX_SNAPSHOTS} snapshots used`
          )}
        </div>
      </div>

      {/* Restore confirmation */}
      <ConfirmDialog
        open={confirmRestore !== null}
        title="Restore Snapshot"
        message={confirmRestore ? `This will save your current configuration as a snapshot and restore "${confirmRestore.name}". Continue?` : ""}
        onConfirm={() => { if (confirmRestore) handleRestore(confirmRestore); }}
        onCancel={() => setConfirmRestore(null)}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete Snapshot"
        message={confirmDelete ? `Are you sure you want to delete "${confirmDelete.name}"? This cannot be undone.` : ""}
        onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/PropertyDetail/HistoryDrawer.tsx
git commit -m "feat(snapshot): add HistoryDrawer component with list, diff, and restore"
```

---

### Task 8: Frontend — Integrate into ScenarioCard, FinancingTab, and PropertyDetail

**Files:**
- Modify: `frontend/src/components/PropertyDetail/ScenarioCard.tsx`
- Modify: `frontend/src/components/PropertyDetail/FinancingTab.tsx`
- Modify: `frontend/src/components/PropertyDetail/PropertyDetail.tsx`

- [ ] **Step 1: Add snapshot buttons to ScenarioCard**

In `frontend/src/components/PropertyDetail/ScenarioCard.tsx`:

1. Add to imports:
```tsx
import { useEffect } from "react";
import { SnapshotButton } from "./SnapshotButton.tsx";
import { HistoryDrawer } from "./HistoryDrawer.tsx";
import { listSnapshots } from "../../api/client.ts";
```

2. Update the `ScenarioCardProps` interface (add `propertyId` and `onRestored`):
```tsx
interface ScenarioCardProps {
  propertyId: string;
  scenario: MortgageScenario;
  onUpdate: (id: string, data: Partial<MortgageScenario>) => Promise<MortgageScenario>;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onActivate: (id: string) => void;
  onRestored?: () => void;
}
```

3. Update the destructured props:
```tsx
export function ScenarioCard({ propertyId, scenario, onUpdate, onDelete, onDuplicate, onActivate, onRestored }: ScenarioCardProps) {
```

4. Add state after the existing `useState` calls:
```tsx
const [drawerOpen, setDrawerOpen] = useState(false);
const [snapshotCount, setSnapshotCount] = useState(0);

const loadSnapshotCount = useCallback(async () => {
  try {
    const snaps = await listSnapshots(propertyId, scenario.id);
    setSnapshotCount(snaps.length);
  } catch { /* ignore */ }
}, [propertyId, scenario.id]);

useEffect(() => { loadSnapshotCount(); }, [loadSnapshotCount]);
```

5. In the Actions footer (line ~323), add between the Duplicate and Delete buttons:
```tsx
<SnapshotButton
  propertyId={propertyId}
  scenarioId={scenario.id}
  onSnapshotCreated={loadSnapshotCount}
/>
<button
  onClick={() => setDrawerOpen(true)}
  className="px-3 py-1.5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm font-medium flex items-center gap-1.5"
>
  🕐 History
  {snapshotCount > 0 && (
    <span className="bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-full px-1.5 py-0.5 text-xs">
      {snapshotCount}
    </span>
  )}
</button>
```

6. Add the drawer just before the final closing `</div>` of the component return:
```tsx
<HistoryDrawer
  propertyId={propertyId}
  scenarioId={scenario.id}
  scenarioName={form.name || "Untitled Scenario"}
  open={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  onRestored={() => { loadSnapshotCount(); onRestored?.(); }}
/>
```

- [ ] **Step 2: Update FinancingTab to pass `propertyId` and `onRestored`**

In `frontend/src/components/PropertyDetail/FinancingTab.tsx`:

1. Add `propertyId` and `onRestored` to the interface:
```tsx
interface FinancingTabProps {
  propertyId: string;
  scenarios: MortgageScenario[];
  listingPrice: number;
  onCreateScenario: (data: Partial<MortgageScenario>) => Promise<MortgageScenario>;
  onUpdateScenario: (id: string, data: Partial<MortgageScenario>) => Promise<MortgageScenario>;
  onDeleteScenario: (id: string) => Promise<void>;
  onDuplicateScenario: (id: string) => Promise<MortgageScenario>;
  onActivateScenario: (id: string) => Promise<void>;
  onRestored?: () => void;
}
```

2. Add `propertyId` and `onRestored` to the destructured props:
```tsx
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
```

3. Update the ScenarioCard rendering (around line 81) to pass the new props:
```tsx
<ScenarioCard
  key={s.id}
  propertyId={propertyId}
  scenario={s}
  onUpdate={onUpdateScenario}
  onDelete={setDeleteTarget}
  onDuplicate={(id) => void onDuplicateScenario(id)}
  onActivate={(id) => void onActivateScenario(id)}
  onRestored={onRestored}
/>
```

- [ ] **Step 3: Update PropertyDetail to pass `propertyId` and `onRestored` to FinancingTab**

In `frontend/src/components/PropertyDetail/PropertyDetail.tsx`, update the FinancingTab rendering (around line 108):

```tsx
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
```

Note: `onRestored` is optional. The parent `PropertyPage.tsx` can pass a refresh callback later if full data reload is needed after restore. For now, the ScenarioCard's own state refresh is sufficient.

- [ ] **Step 4: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PropertyDetail/ScenarioCard.tsx frontend/src/components/PropertyDetail/FinancingTab.tsx frontend/src/components/PropertyDetail/PropertyDetail.tsx
git commit -m "feat(snapshot): integrate snapshot buttons and history drawer into ScenarioCard"
```

---

### Task 9: Manual Integration Test

- [ ] **Step 1: Start the dev servers**

Run: `./start.sh` (or start backend + frontend separately)

- [ ] **Step 2: Test the full flow**

1. Open a property with a scenario in the Financing tab
2. Click "Save Snapshot" — verify name dialog appears, create a snapshot
3. Change the interest rate on the scenario and save
4. Click "History" — verify drawer shows the snapshot with CoC/cashflow preview
5. Click "Compare" — verify diff table shows interest rate and metric changes
6. Click "Restore This Snapshot" — verify confirmation dialog, then restore works
7. Verify auto-snapshot was created in the history
8. Verify the scenario's interest rate is back to the original value

- [ ] **Step 3: Test edge cases**

1. Create snapshot with no name — verify auto-generated name
2. Delete a snapshot — verify it disappears from the list
3. Test dark mode rendering

- [ ] **Step 4: Run backend tests one final time**

Run: `cd backend && python -m pytest -v`
Expected: All tests PASS

- [ ] **Step 5: Final commit with any fixes**

```bash
git add -A
git commit -m "feat(snapshot): complete scenario version history feature (THI-26)"
```
