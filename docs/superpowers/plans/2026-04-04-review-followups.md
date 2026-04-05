# Code Review Follow-Up Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address remaining code review findings: dashboard computation caching, DB-level cascades, React error boundary, and typed sensitivity response schema.

**Architecture:** Three independent improvements — (1) extract `_compute_for_scenario` into a service layer and cache dashboard-summary metrics on the property row to avoid N full computations on every dashboard load, (2) add an Alembic migration for DB-level ON DELETE CASCADE on FK constraints, (3) add a React ErrorBoundary at the app root, (4) type the sensitivity sweep response.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, React, TypeScript

---

### Task 1: Type the sensitivity sweep response schema

**Files:**
- Modify: `backend/app/schemas/results.py:130-132`

- [ ] **Step 1: Add typed models for sensitivity sweep entries**

In `backend/app/schemas/results.py`, add two models and update `SensitivityResponse`:

```python
class OccupancySweepEntry(BaseModel):
    occupancy_pct: int
    monthly_cashflow: float


class RateSweepEntry(BaseModel):
    nightly_rate: float
    monthly_cashflow: float


class SensitivityResponse(BaseModel):
    occupancy_sweep: list[OccupancySweepEntry]
    rate_sweep: list[RateSweepEntry]
```

Replace the existing `SensitivityResponse` (lines 130-132) with the above three classes.

- [ ] **Step 2: Run tests to verify nothing breaks**

Run: `.venv/bin/python -m pytest --tb=short -q`
Expected: 231 passed

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/results.py
git commit -m "refactor: type sensitivity sweep response with Pydantic models"
```

---

### Task 2: Add React error boundary

**Files:**
- Create: `frontend/src/components/shared/ErrorBoundary.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create the ErrorBoundary component**

Create `frontend/src/components/shared/ErrorBoundary.tsx`:

```tsx
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Something went wrong
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              An unexpected error occurred. Please reload the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Wrap the App with ErrorBoundary**

In `frontend/src/App.tsx`, import `ErrorBoundary` and wrap the outermost JSX:

```tsx
import { ErrorBoundary } from "./components/shared/ErrorBoundary.tsx";

// In the App function return:
return (
  <ErrorBoundary>
    <ThemeProvider>
      {/* ... existing BrowserRouter ... */}
    </ThemeProvider>
  </ErrorBoundary>
);
```

- [ ] **Step 3: Verify the frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shared/ErrorBoundary.tsx frontend/src/App.tsx
git commit -m "feat: add React error boundary for crash recovery"
```

---

### Task 3: Add DB-level ON DELETE CASCADE via Alembic migration

**Files:**
- Create: `backend/alembic/versions/<auto>_add_fk_cascade.py` (via `alembic revision`)

- [ ] **Step 1: Generate a new Alembic migration**

Run: `cd backend && .venv/bin/python -m alembic revision -m "add on delete cascade to foreign keys"`

- [ ] **Step 2: Write the migration**

SQLite does not support `ALTER TABLE ... DROP CONSTRAINT` or `ALTER TABLE ... ADD CONSTRAINT`. Use Alembic's `batch_alter_table` context manager with a `naming_convention`, which rebuilds the table with the new FK definition. The initial migration (`719883dd7ef3`) has unnamed FK constraints, so we use `naming_convention` to let batch mode identify and replace them automatically.

```python
from alembic import op
import sqlalchemy as sa

naming_convention = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
}

def upgrade():
    # mortgage_scenarios FK
    with op.batch_alter_table("mortgage_scenarios", naming_convention=naming_convention) as batch_op:
        batch_op.drop_constraint(
            "fk_mortgage_scenarios_property_id_properties", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "fk_mortgage_scenarios_property_id_properties",
            "properties",
            ["property_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # str_assumptions FK
    with op.batch_alter_table("str_assumptions", naming_convention=naming_convention) as batch_op:
        batch_op.drop_constraint(
            "fk_str_assumptions_property_id_properties", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "fk_str_assumptions_property_id_properties",
            "properties",
            ["property_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade():
    with op.batch_alter_table("mortgage_scenarios", naming_convention=naming_convention) as batch_op:
        batch_op.drop_constraint(
            "fk_mortgage_scenarios_property_id_properties", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "fk_mortgage_scenarios_property_id_properties",
            "properties",
            ["property_id"],
            ["id"],
        )

    with op.batch_alter_table("str_assumptions", naming_convention=naming_convention) as batch_op:
        batch_op.drop_constraint(
            "fk_str_assumptions_property_id_properties", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "fk_str_assumptions_property_id_properties",
            "properties",
            ["property_id"],
            ["id"],
        )
```

- [ ] **Step 3: Run the migration**

Run: `cd backend && .venv/bin/python -m alembic upgrade head`
Expected: no errors

- [ ] **Step 4: Run tests to verify**

Run: `cd backend && .venv/bin/python -m pytest --tb=short -q`
Expected: 231+ passed

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat: add ON DELETE CASCADE to foreign key constraints"
```

---

### Task 4: Extract computation service and cache dashboard metrics

This is the largest task. The goal is to stop recomputing full results for every property on every dashboard load.

**Files:**
- Create: `backend/app/services/analysis.py`
- Modify: `backend/app/models/property.py`
- Modify: `backend/app/schemas/property.py`
- Modify: `backend/app/routers/properties.py`
- Modify: `backend/app/routers/compute.py`
- Create: `backend/alembic/versions/<auto>_add_cached_metrics.py`
- Create: `backend/tests/test_cached_metrics.py`

#### Sub-task 4a: Add cached metric columns to the Property model

- [ ] **Step 1: Create Alembic migration for cached columns**

Run: `cd backend && .venv/bin/python -m alembic revision -m "add cached metric columns to properties"`

Write the migration to add two nullable columns to `properties`:
```python
def upgrade():
    op.add_column("properties", sa.Column("cached_monthly_cashflow", sa.Numeric(10, 2), nullable=True))
    op.add_column("properties", sa.Column("cached_cash_on_cash_return", sa.Numeric(10, 4), nullable=True))

def downgrade():
    op.drop_column("properties", "cached_monthly_cashflow")
    op.drop_column("properties", "cached_cash_on_cash_return")
```

- [ ] **Step 2: Add columns to the Property model**

In `backend/app/models/property.py`, add after `in_portfolio`:
```python
cached_monthly_cashflow: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
cached_cash_on_cash_return: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
```

- [ ] **Step 3: Run migration**

Run: `cd backend && .venv/bin/python -m alembic upgrade head`

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/ backend/app/models/property.py
git commit -m "feat: add cached metric columns to properties table"
```

#### Sub-task 4b: Extract _compute_for_scenario into a service

- [ ] **Step 5: Create `backend/app/services/analysis.py`**

Move `_compute_for_scenario`, `_get_occupancy`, and `_compute_fixed_opex` from `compute.py` into `backend/app/services/analysis.py`. Keep the same function signatures. Add one new function:

```python
def compute_and_cache_summary(prop: Property, scenario: MortgageScenario, assumptions: STRAssumptions, db: Session) -> dict:
    """Compute full results and update cached metrics on the property."""
    result = compute_for_scenario(prop, scenario, assumptions)
    prop.cached_monthly_cashflow = result["metrics"].monthly_cashflow
    prop.cached_cash_on_cash_return = result["metrics"].cash_on_cash_return
    db.flush()
    return result
```

- [ ] **Step 6: Update compute.py to import from the service**

Replace the function definitions with imports:
```python
from app.services.analysis import compute_for_scenario, get_occupancy, compute_fixed_opex
```

Update all references in `compute.py` to use the imported functions (drop the leading `_` prefix since they're now a public API).

- [ ] **Step 7: Update properties.py to use cached values**

Replace the `list_properties` computation loop:
```python
@router.get("", response_model=list[PropertySummary])
def list_properties(db: Session = Depends(get_db)):
    props = db.query(Property).filter(Property.is_archived == False).all()
    summaries = []
    for prop in props:
        summary = PropertySummary.model_validate(prop)
        summary.monthly_cashflow = float(prop.cached_monthly_cashflow) if prop.cached_monthly_cashflow is not None else None
        summary.cash_on_cash_return = float(prop.cached_cash_on_cash_return) if prop.cached_cash_on_cash_return is not None else None
        summaries.append(summary)
    return summaries
```

- [ ] **Step 8: Update write endpoints to refresh cache**

In `compute.py`, after computing results in `get_results` and `get_results_for_scenario`, also update the cached values:
```python
prop.cached_monthly_cashflow = result["metrics"].monthly_cashflow
prop.cached_cash_on_cash_return = result["metrics"].cash_on_cash_return
db.commit()
```

Invalidate cache in these specific endpoints when inputs change:
- `backend/app/routers/scenarios.py`: In `create_scenario()`, `update_scenario()`, and `delete_scenario()`, after the DB write:
  ```python
  prop = db.query(Property).filter(Property.id == property_id).first()
  prop.cached_monthly_cashflow = None
  prop.cached_cash_on_cash_return = None
  ```
- `backend/app/routers/assumptions.py`: In `update_assumptions()`, after the DB write:
  ```python
  prop = db.query(Property).filter(Property.id == property_id).first()
  prop.cached_monthly_cashflow = None
  prop.cached_cash_on_cash_return = None
  ```

This ensures the dashboard shows "—" until the user next views results, rather than stale numbers.

- [ ] **Step 9: Run all tests**

Run: `cd backend && .venv/bin/python -m pytest --tb=short -q`
Expected: all pass

- [ ] **Step 10: Write a test for the cache behavior**

Create `backend/tests/test_cached_metrics.py`:

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_dashboard_uses_cached_metrics():
    """Dashboard should return cached metrics without recomputing."""
    # Create a property
    resp = client.post("/api/properties", json={"name": "Cache Test"})
    assert resp.status_code == 201
    pid = resp.json()["id"]

    # Dashboard should show null metrics (no cache yet)
    resp = client.get("/api/properties")
    prop = next(p for p in resp.json() if p["id"] == pid)
    assert prop["monthly_cashflow"] is None

    # Create scenario and compute results to populate cache
    client.post(f"/api/properties/{pid}/scenarios", json={
        "name": "Test", "purchase_price": 300000, "down_payment_amt": 75000,
        "closing_cost_amt": 9000,
    })
    resp = client.get(f"/api/properties/{pid}/results")
    assert resp.status_code == 200

    # Dashboard should now show cached metrics
    resp = client.get("/api/properties")
    prop = next(p for p in resp.json() if p["id"] == pid)
    assert prop["monthly_cashflow"] is not None
```

- [ ] **Step 11: Run the new test**

Run: `cd backend && .venv/bin/python -m pytest tests/test_cached_metrics.py -v`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add backend/app/services/analysis.py backend/app/routers/compute.py backend/app/routers/properties.py backend/app/routers/scenarios.py backend/app/routers/assumptions.py backend/tests/test_cached_metrics.py
git commit -m "refactor: extract computation service and cache dashboard metrics"
```

---

### Task 5: Squash Alembic migrations (optional, recommended)

**Files:**
- Delete: all files in `backend/alembic/versions/` except `__pycache__`
- Create: `backend/alembic/versions/<auto>_initial_schema.py`

- [ ] **Step 1: Back up existing migrations**

```bash
cp -r backend/alembic/versions/ backend/alembic/versions_backup/
```

- [ ] **Step 2: Generate a fresh initial migration from current models**

```bash
cd backend
# Remove all migration files (keep __pycache__)
rm alembic/versions/*.py
# Stamp the DB as having no migrations
.venv/bin/python -m alembic stamp base
# Auto-generate from current models
.venv/bin/python -m alembic revision --autogenerate -m "initial schema"
```

- [ ] **Step 3: Verify the migration applies cleanly**

```bash
# Delete the local DB so we can test from scratch
rm -f data/str_calc.db
.venv/bin/python -m alembic upgrade head
```

- [ ] **Step 4: Run tests**

Run: `cd backend && .venv/bin/python -m pytest --tb=short -q`
Expected: all pass

- [ ] **Step 5: Remove backup and commit**

```bash
rm -rf backend/alembic/versions_backup/
git add backend/alembic/versions/
git commit -m "chore: squash migrations into single initial schema"
```
