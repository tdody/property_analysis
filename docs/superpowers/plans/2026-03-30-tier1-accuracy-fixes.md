# Tier 1 Accuracy Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 5 Tier 1 fixes from the financial accuracy review to make the calculator reliable for real investment decisions.

**Architecture:** Each fix is independent — add new fields to the data model, wire them through schemas/router/computation, display in the frontend, and add validation. Database changes use Alembic migrations. All computation changes are TDD.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy, Alembic, Pydantic, pytest, React 19, TypeScript, Tailwind CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/app/models/assumptions.py` | Modify | Add `rental_delay_months`, `local_gross_receipts_tax_pct` columns |
| `backend/app/schemas/assumptions.py` | Modify | Add new fields to `AssumptionsUpdate` and `AssumptionsResponse` |
| `backend/app/schemas/scenario.py` | Modify | Add Pydantic validators to `ScenarioCreate` and `ScenarioUpdate` |
| `backend/app/services/computation/expenses.py` | Modify | Add `local_gross_receipts_tax_pct` to expense computation |
| `backend/app/services/computation/metrics.py` | Modify | Add `rental_delay_months` to Year-1 revenue/cashflow/CoC adjustments |
| `backend/app/services/computation/revenue.py` | Modify | Add `compute_year1_revenue` with rental delay |
| `backend/app/routers/compute.py` | Modify | Pass new fields through to computation |
| `backend/app/schemas/results.py` | Modify | Add `dscr_warning`, `guest_facing_tax_pct`, `rental_delay_months` to results |
| `backend/alembic/versions/` | Create | New migration for added columns |
| `backend/tests/test_revenue.py` | Modify | Add rental delay tests |
| `backend/tests/test_expenses.py` | Modify | Add gross receipts tax tests |
| `backend/tests/test_metrics.py` | Modify | Add rental delay impact tests |
| `backend/tests/test_validation.py` | Create | Input validation tests |
| `backend/tests/test_api_compute.py` | Modify | Add DSCR warning + tax display tests |
| `frontend/src/types/index.ts` | Modify | Add new fields to TypeScript interfaces |
| `frontend/src/components/PropertyDetail/RevenueExpensesTab.tsx` | Modify | Add rental delay + gross receipts tax inputs |
| `frontend/src/components/PropertyDetail/ResultsTab.tsx` | Modify | Show DSCR warning, guest-facing tax impact, rental delay info |

---

### Task 1: Add `rental_delay_months` field to model, schema, and migration

**Files:**
- Modify: `backend/app/models/assumptions.py`
- Modify: `backend/app/schemas/assumptions.py`
- Create: `backend/alembic/versions/<auto>_add_tier1_fields.py`

- [ ] **Step 1: Add column to ORM model**

In `backend/app/models/assumptions.py`, first update the import on line 2 to include `Integer`:

```python
from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
```

Then add after the `vacancy_reserve_pct` line (line 31):

```python
    # Rental Delay
    rental_delay_months: Mapped[int] = mapped_column(Integer, default=1)
```

- [ ] **Step 2: Add field to Pydantic schemas**

In `backend/app/schemas/assumptions.py`:

Add to `AssumptionsUpdate` (after `vacancy_reserve_pct`):
```python
    rental_delay_months: int | None = None
```

Add to `AssumptionsResponse` (after `vacancy_reserve_pct`):
```python
    rental_delay_months: int
```

- [ ] **Step 3: Generate Alembic migration**

Run: `cd backend && pdm run alembic revision --autogenerate -m "add tier1 fields"`

Verify the generated migration adds the `rental_delay_months` column to `str_assumptions` and the `local_gross_receipts_tax_pct` column (added in Task 3). If only `rental_delay_months` shows, that's fine — Task 3 will be included if done before generating.

- [ ] **Step 4: Apply migration and verify**

Run: `cd backend && pdm run alembic upgrade head`
Expected: Migration applies without errors.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/assumptions.py backend/app/schemas/assumptions.py backend/alembic/versions/
git commit -m "feat: add rental_delay_months field to assumptions model"
```

---

### Task 2: Wire `rental_delay_months` into revenue and metrics computation (TDD)

**Files:**
- Modify: `backend/app/services/computation/revenue.py`
- Modify: `backend/app/services/computation/metrics.py`
- Modify: `backend/tests/test_revenue.py`
- Modify: `backend/tests/test_metrics.py`

- [ ] **Step 1: Write failing test for Year-1 revenue with rental delay**

Add to `backend/tests/test_revenue.py`:

```python
class TestYear1Revenue:
    def test_no_delay(self):
        result = compute_year1_revenue(annual_revenue=60_000, rental_delay_months=0)
        assert result == 60_000

    def test_one_month_delay(self):
        result = compute_year1_revenue(annual_revenue=60_000, rental_delay_months=1)
        assert result == 55_000  # 11/12 * 60000

    def test_three_month_delay(self):
        result = compute_year1_revenue(annual_revenue=60_000, rental_delay_months=3)
        assert result == 45_000  # 9/12 * 60000

    def test_twelve_month_delay(self):
        result = compute_year1_revenue(annual_revenue=60_000, rental_delay_months=12)
        assert result == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pdm run pytest tests/test_revenue.py::TestYear1Revenue -v`
Expected: FAIL — `ImportError: cannot import name 'compute_year1_revenue'`

- [ ] **Step 3: Implement `compute_year1_revenue`**

Add to `backend/app/services/computation/revenue.py`:

```python
def compute_year1_revenue(annual_revenue: float, rental_delay_months: int) -> float:
    if rental_delay_months >= 12:
        return 0
    return annual_revenue * (12 - rental_delay_months) / 12
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pdm run pytest tests/test_revenue.py::TestYear1Revenue -v`
Expected: All 4 tests PASS.

- [ ] **Step 5: Write failing test for rental delay impact on cashflow metrics**

Add to `backend/tests/test_metrics.py`:

```python
class TestRentalDelayMetrics:
    def test_delay_reduces_year1_cashflow(self):
        """With rental delay, Year-1 cashflow should be lower than steady-state."""
        base = compute_cashflow(noi=28_900, total_monthly_housing=2000)
        # With 2-month delay: Year-1 NOI = (10/12) * net_revenue - expenses
        # Revenue drops but fixed costs stay the same
        year1_net_revenue = 56_648 * (10 / 12)
        year1_noi = compute_noi(year1_net_revenue, 27_748)
        delayed = compute_cashflow(noi=year1_noi, total_monthly_housing=2000)
        assert delayed["annual_cashflow"] < base["annual_cashflow"]

    def test_delay_carrying_costs_added_to_cash_invested(self):
        """Carrying costs during rental delay should increase total cash invested."""
        from app.services.computation.metrics import compute_delay_carrying_costs
        result = compute_delay_carrying_costs(
            total_monthly_housing=2500,
            rental_delay_months=2,
        )
        assert result == 5000  # 2 months * $2500/mo
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && pdm run pytest tests/test_metrics.py::TestRentalDelayMetrics -v`
Expected: FAIL — `ImportError: cannot import name 'compute_delay_carrying_costs'`

- [ ] **Step 7: Implement `compute_delay_carrying_costs`**

Add to `backend/app/services/computation/metrics.py`:

```python
def compute_delay_carrying_costs(total_monthly_housing: float, rental_delay_months: int) -> float:
    return total_monthly_housing * rental_delay_months
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd backend && pdm run pytest tests/test_metrics.py::TestRentalDelayMetrics -v`
Expected: All 2 tests PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/computation/revenue.py backend/app/services/computation/metrics.py backend/tests/test_revenue.py backend/tests/test_metrics.py
git commit -m "feat: add rental delay computation for Year-1 revenue and carrying costs"
```

---

### Task 3: Add `local_gross_receipts_tax_pct` field and wire into expenses (TDD)

**Files:**
- Modify: `backend/app/models/assumptions.py`
- Modify: `backend/app/schemas/assumptions.py`
- Modify: `backend/app/services/computation/expenses.py`
- Modify: `backend/tests/test_expenses.py`

- [ ] **Step 1: Add column to ORM model**

In `backend/app/models/assumptions.py`, add after `local_str_registration_fee` (line 37):

```python
    local_gross_receipts_tax_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
```

- [ ] **Step 2: Add field to Pydantic schemas**

In `backend/app/schemas/assumptions.py`:

Add to `AssumptionsUpdate` (after `local_str_registration_fee`):
```python
    local_gross_receipts_tax_pct: float | None = None
```

Add to `AssumptionsResponse` (after `local_str_registration_fee`):
```python
    local_gross_receipts_tax_pct: float
```

- [ ] **Step 3: Write failing test for gross receipts tax in expenses**

Add to `backend/tests/test_expenses.py`:

```python
class TestGrossReceiptsTax:
    def test_zero_tax(self):
        result = compute_operating_expenses(
            annual_turnovers=79, cleaning_cost_per_turn=120,
            net_annual_revenue=56_648, gross_annual_revenue=58_400,
            property_mgmt_pct=0, maintenance_reserve_pct=5,
            capex_reserve_pct=5, utilities_monthly=250,
            supplies_monthly=100, lawn_snow_monthly=0,
            other_monthly_expense=0, local_str_registration_fee=0,
            local_gross_receipts_tax_pct=0,
        )
        assert result.get("gross_receipts_tax", 0) == 0

    def test_burlington_nine_pct(self):
        result = compute_operating_expenses(
            annual_turnovers=79, cleaning_cost_per_turn=120,
            net_annual_revenue=56_648, gross_annual_revenue=58_400,
            property_mgmt_pct=0, maintenance_reserve_pct=5,
            capex_reserve_pct=5, utilities_monthly=250,
            supplies_monthly=100, lawn_snow_monthly=0,
            other_monthly_expense=0, local_str_registration_fee=0,
            local_gross_receipts_tax_pct=9.0,
        )
        expected_tax = 58_400 * 0.09
        assert abs(result["gross_receipts_tax"] - expected_tax) < 0.01
        # Total should include the tax
        # Verify the total includes the tax
        assert result["total_annual_operating_exp"] >= expected_tax
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && pdm run pytest tests/test_expenses.py::TestGrossReceiptsTax -v`
Expected: FAIL — `TypeError: compute_operating_expenses() got an unexpected keyword argument 'local_gross_receipts_tax_pct'`

- [ ] **Step 5: Add `local_gross_receipts_tax_pct` parameter to `compute_operating_expenses`**

Modify `backend/app/services/computation/expenses.py` — add parameter and computation:

```python
def compute_operating_expenses(
    annual_turnovers: float,
    cleaning_cost_per_turn: float,
    net_annual_revenue: float,
    gross_annual_revenue: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    utilities_monthly: float,
    supplies_monthly: float,
    lawn_snow_monthly: float,
    other_monthly_expense: float,
    local_str_registration_fee: float,
    local_gross_receipts_tax_pct: float = 0,
) -> dict:
    annual_cleaning_cost = annual_turnovers * cleaning_cost_per_turn
    property_mgmt_cost = net_annual_revenue * (property_mgmt_pct / 100)
    maintenance_reserve = gross_annual_revenue * (maintenance_reserve_pct / 100)
    capex_reserve = gross_annual_revenue * (capex_reserve_pct / 100)
    utilities_annual = utilities_monthly * 12
    supplies_annual = supplies_monthly * 12
    lawn_snow_annual = lawn_snow_monthly * 12
    other_annual = other_monthly_expense * 12
    registration_annual = local_str_registration_fee
    gross_receipts_tax = gross_annual_revenue * (local_gross_receipts_tax_pct / 100)
    total = (
        annual_cleaning_cost
        + property_mgmt_cost
        + maintenance_reserve
        + capex_reserve
        + utilities_annual
        + supplies_annual
        + lawn_snow_annual
        + other_annual
        + registration_annual
        + gross_receipts_tax
    )
    return {
        "annual_cleaning_cost": annual_cleaning_cost,
        "property_mgmt_cost": property_mgmt_cost,
        "maintenance_reserve": maintenance_reserve,
        "capex_reserve": capex_reserve,
        "utilities_annual": utilities_annual,
        "supplies_annual": supplies_annual,
        "lawn_snow_annual": lawn_snow_annual,
        "other_annual": other_annual,
        "registration_annual": registration_annual,
        "gross_receipts_tax": gross_receipts_tax,
        "total_annual_operating_exp": total,
    }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && pdm run pytest tests/test_expenses.py -v`
Expected: All tests PASS (existing tests still work because of default parameter `= 0`).

- [ ] **Step 7: Generate and apply Alembic migration (if not done in Task 1)**

If the migration from Task 1 didn't include `local_gross_receipts_tax_pct`, generate a new migration:

Run: `cd backend && pdm run alembic revision --autogenerate -m "add local_gross_receipts_tax_pct"`
Then: `cd backend && pdm run alembic upgrade head`

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/assumptions.py backend/app/schemas/assumptions.py backend/app/services/computation/expenses.py backend/tests/test_expenses.py backend/alembic/versions/
git commit -m "feat: add local_gross_receipts_tax_pct to expenses computation"
```

---

### Task 4: Wire rental delay and gross receipts tax through the compute router

**Files:**
- Modify: `backend/app/routers/compute.py`
- Modify: `backend/app/schemas/results.py`

- [ ] **Step 1: Add `gross_receipts_tax` to `ExpenseBreakdown` schema**

In `backend/app/schemas/results.py`, add to `ExpenseBreakdown` (after `insurance_annual`):

```python
    gross_receipts_tax: float
```

- [ ] **Step 2: Add warning and tax info fields to results schemas**

In `backend/app/schemas/results.py`, add to `MetricsResults` (after `total_roi_year1`):

```python
    dscr_warning: str | None = None
```

Add a new schema after `ComputedResultsResponse`:

```python
class TaxImpactInfo(BaseModel):
    guest_facing_tax_pct: float
    platform_remits: bool
    effective_nightly_rate_with_tax: float
```

Add to `ComputedResultsResponse` (after `metrics`):

```python
    rental_delay_months: int = 0
    tax_impact: TaxImpactInfo | None = None
```

- [ ] **Step 3: Update `_compute_for_scenario` to apply rental delay**

In `backend/app/routers/compute.py`, update `_compute_for_scenario`:

First, add these imports at the top of `backend/app/routers/compute.py` alongside the existing imports:

```python
from app.services.computation.revenue import compute_gross_revenue, compute_net_revenue, compute_year1_revenue
from app.services.computation.metrics import compute_all_metrics, compute_delay_carrying_costs
from app.schemas.results import TaxImpactInfo
```

(Update the existing import lines for `revenue`, `metrics`, and `results` rather than adding duplicate lines.)

After the metrics computation (line ~111), add rental delay adjustments:

```python
    # Rental delay adjustments for Year-1
    rental_delay = int(assumptions.rental_delay_months) if assumptions.rental_delay_months else 0
    if rental_delay > 0:
        year1_gross = compute_year1_revenue(gross["total_gross_revenue"], rental_delay)
        year1_net = compute_year1_revenue(net["net_revenue"], rental_delay)
        year1_opex_variable = total_opex - fixed_opex  # Variable expenses scale with revenue
        year1_opex = fixed_opex + year1_opex_variable * (12 - rental_delay) / 12
        year1_noi = year1_net - year1_opex
        year1_fixed_costs = total_monthly_housing * 12
        year1_annual_cashflow = year1_noi - year1_fixed_costs
        year1_monthly_cashflow = year1_annual_cashflow / 12
        carrying_costs = compute_delay_carrying_costs(total_monthly_housing, rental_delay)
        year1_total_cash = total_cash + carrying_costs
        year1_coc = (year1_annual_cashflow / year1_total_cash * 100) if year1_total_cash > 0 else 0
        year1_roi = ((year1_annual_cashflow + year1_equity) / year1_total_cash * 100) if year1_total_cash > 0 else 0
        # Override metrics with Year-1 adjusted values
        metrics["monthly_cashflow"] = year1_monthly_cashflow
        metrics["annual_cashflow"] = year1_annual_cashflow
        metrics["cash_on_cash_return"] = year1_coc
        metrics["noi"] = year1_noi
        metrics["total_roi_year1"] = year1_roi
        total_cash = year1_total_cash
```

- [ ] **Step 4: Pass `local_gross_receipts_tax_pct` to expense computation**

In `_compute_for_scenario`, update the `compute_operating_expenses` call to include:

```python
        local_gross_receipts_tax_pct=float(assumptions.local_gross_receipts_tax_pct),
```

- [ ] **Step 5: Add DSCR warning to metrics result**

After the metrics computation, add:

```python
    dscr_warning = None
    if scenario.loan_type == "dscr" and metrics["dscr"] < 1.25:
        dscr_warning = f"DSCR of {metrics['dscr']:.2f} is below the typical lender threshold of 1.25x"
```

- [ ] **Step 6: Compute guest-facing tax impact**

After the DSCR warning, add:

```python
    total_tax_pct = (
        float(assumptions.state_rooms_tax_pct)
        + float(assumptions.str_surcharge_pct)
        + float(assumptions.local_option_tax_pct)
    )
    tax_impact = None
    if total_tax_pct > 0:
        tax_impact = TaxImpactInfo(
            guest_facing_tax_pct=total_tax_pct,
            platform_remits=bool(assumptions.platform_remits_tax),
            effective_nightly_rate_with_tax=round(float(assumptions.avg_nightly_rate) * (1 + total_tax_pct / 100), 2),
        )
```

- [ ] **Step 7: Update the return dict**

Update the return dict in `_compute_for_scenario` to include the new fields:

```python
        "metrics": MetricsResults(
            ...existing fields...,
            dscr_warning=dscr_warning,
        ),
        "rental_delay_months": rental_delay,
        "tax_impact": tax_impact,
```

And update the `ExpenseBreakdown` to include:
```python
            gross_receipts_tax=round(expenses["gross_receipts_tax"], 2),
```

- [ ] **Step 8: Run all backend tests**

Run: `cd backend && pdm run pytest -v`
Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/app/routers/compute.py backend/app/schemas/results.py
git commit -m "feat: wire rental delay, gross receipts tax, DSCR warning through compute router"
```

---

### Task 5: Add input validation to Pydantic schemas (TDD)

**Files:**
- Modify: `backend/app/schemas/assumptions.py`
- Modify: `backend/app/schemas/scenario.py`
- Modify: `backend/app/schemas/property.py`
- Create: `backend/tests/test_validation.py`

- [ ] **Step 1: Write failing validation tests**

Create `backend/tests/test_validation.py`:

```python
import pytest
from pydantic import ValidationError
from app.schemas.assumptions import AssumptionsUpdate
from app.schemas.scenario import ScenarioCreate, ScenarioUpdate


class TestAssumptionsValidation:
    def test_occupancy_over_100_rejected(self):
        with pytest.raises(ValidationError, match="occupancy"):
            AssumptionsUpdate(occupancy_pct=101)

    def test_occupancy_negative_rejected(self):
        with pytest.raises(ValidationError, match="occupancy"):
            AssumptionsUpdate(occupancy_pct=-5)

    def test_occupancy_valid(self):
        a = AssumptionsUpdate(occupancy_pct=65)
        assert a.occupancy_pct == 65

    def test_negative_nightly_rate_rejected(self):
        with pytest.raises(ValidationError, match="nightly_rate"):
            AssumptionsUpdate(avg_nightly_rate=-100)

    def test_negative_cleaning_fee_rejected(self):
        with pytest.raises(ValidationError, match="cleaning_fee"):
            AssumptionsUpdate(cleaning_fee_per_stay=-50)

    def test_platform_fee_over_100_rejected(self):
        with pytest.raises(ValidationError, match="platform_fee"):
            AssumptionsUpdate(platform_fee_pct=101)

    def test_rental_delay_negative_rejected(self):
        with pytest.raises(ValidationError, match="rental_delay"):
            AssumptionsUpdate(rental_delay_months=-1)

    def test_rental_delay_over_12_rejected(self):
        with pytest.raises(ValidationError, match="rental_delay"):
            AssumptionsUpdate(rental_delay_months=13)


class TestScenarioValidation:
    def test_negative_interest_rate_rejected(self):
        with pytest.raises(ValidationError, match="interest_rate"):
            ScenarioCreate(name="Bad", interest_rate=-1)

    def test_negative_purchase_price_rejected(self):
        with pytest.raises(ValidationError, match="purchase_price"):
            ScenarioCreate(name="Bad", purchase_price=-100)

    def test_down_payment_over_100_rejected(self):
        with pytest.raises(ValidationError, match="down_payment"):
            ScenarioCreate(name="Bad", down_payment_pct=101)

    def test_loan_type_invalid_rejected(self):
        with pytest.raises(ValidationError, match="loan_type"):
            ScenarioCreate(name="Bad", loan_type="magical")

    def test_valid_scenario(self):
        s = ScenarioCreate(name="Good", purchase_price=400_000, interest_rate=7.25)
        assert s.purchase_price == 400_000
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pdm run pytest tests/test_validation.py -v`
Expected: FAIL — tests that expect `ValidationError` will not raise because there are no validators yet.

- [ ] **Step 3: Add validators to `AssumptionsUpdate`**

In `backend/app/schemas/assumptions.py`, replace the imports and class:

```python
from pydantic import BaseModel, field_validator


class AssumptionsUpdate(BaseModel):
    avg_nightly_rate: float | None = None
    occupancy_pct: float | None = None
    cleaning_fee_per_stay: float | None = None
    avg_stay_length_nights: float | None = None
    platform_fee_pct: float | None = None
    cleaning_cost_per_turn: float | None = None
    property_mgmt_pct: float | None = None
    utilities_monthly: float | None = None
    insurance_annual: float | None = None
    maintenance_reserve_pct: float | None = None
    capex_reserve_pct: float | None = None
    supplies_monthly: float | None = None
    lawn_snow_monthly: float | None = None
    other_monthly_expense: float | None = None
    vacancy_reserve_pct: float | None = None
    rental_delay_months: int | None = None
    state_rooms_tax_pct: float | None = None
    str_surcharge_pct: float | None = None
    local_option_tax_pct: float | None = None
    local_str_registration_fee: float | None = None
    local_gross_receipts_tax_pct: float | None = None
    platform_remits_tax: bool | None = None

    @field_validator("occupancy_pct")
    @classmethod
    def occupancy_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("occupancy_pct must be between 0 and 100")
        return v

    @field_validator("avg_nightly_rate")
    @classmethod
    def nightly_rate_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("avg_nightly_rate must be non-negative")
        return v

    @field_validator("cleaning_fee_per_stay")
    @classmethod
    def cleaning_fee_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("cleaning_fee_per_stay must be non-negative")
        return v

    @field_validator("platform_fee_pct")
    @classmethod
    def platform_fee_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("platform_fee_pct must be between 0 and 100")
        return v

    @field_validator("rental_delay_months")
    @classmethod
    def rental_delay_in_range(cls, v: int | None) -> int | None:
        if v is not None and (v < 0 or v > 12):
            raise ValueError("rental_delay_months must be between 0 and 12")
        return v
```

- [ ] **Step 4: Add validators to `ScenarioCreate`**

In `backend/app/schemas/scenario.py`:

```python
from pydantic import BaseModel, field_validator


class ScenarioCreate(BaseModel):
    name: str = "Default Scenario"
    loan_type: str = "conventional"
    purchase_price: float = 0
    down_payment_pct: float = 25.0
    down_payment_amt: float = 0
    interest_rate: float = 7.25
    loan_term_years: int = 30
    closing_cost_pct: float = 3.0
    closing_cost_amt: float = 0
    renovation_cost: float = 0
    furniture_cost: float = 0
    other_upfront_costs: float = 0
    pmi_monthly: float = 0
    is_active: bool = True

    @field_validator("interest_rate")
    @classmethod
    def interest_rate_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("interest_rate must be non-negative")
        return v

    @field_validator("purchase_price")
    @classmethod
    def purchase_price_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("purchase_price must be non-negative")
        return v

    @field_validator("down_payment_pct")
    @classmethod
    def down_payment_in_range(cls, v: float) -> float:
        if v < 0 or v > 100:
            raise ValueError("down_payment_pct must be between 0 and 100")
        return v

    @field_validator("loan_type")
    @classmethod
    def loan_type_valid(cls, v: str) -> str:
        allowed = {"conventional", "fha", "va", "dscr", "portfolio", "heloc"}
        if v not in allowed:
            raise ValueError(f"loan_type must be one of: {', '.join(sorted(allowed))}")
        return v


class ScenarioUpdate(BaseModel):
    name: str | None = None
    loan_type: str | None = None
    purchase_price: float | None = None
    down_payment_pct: float | None = None
    down_payment_amt: float | None = None
    interest_rate: float | None = None
    loan_term_years: int | None = None
    closing_cost_pct: float | None = None
    closing_cost_amt: float | None = None
    renovation_cost: float | None = None
    furniture_cost: float | None = None
    other_upfront_costs: float | None = None
    pmi_monthly: float | None = None
    is_active: bool | None = None

    @field_validator("interest_rate")
    @classmethod
    def interest_rate_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("interest_rate must be non-negative")
        return v

    @field_validator("purchase_price")
    @classmethod
    def purchase_price_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("purchase_price must be non-negative")
        return v

    @field_validator("down_payment_pct")
    @classmethod
    def down_payment_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("down_payment_pct must be between 0 and 100")
        return v

    @field_validator("loan_type")
    @classmethod
    def loan_type_valid(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"conventional", "fha", "va", "dscr", "portfolio", "heloc"}
            if v not in allowed:
                raise ValueError(f"loan_type must be one of: {', '.join(sorted(allowed))}")
        return v
```

- [ ] **Step 5: Run validation tests**

Run: `cd backend && pdm run pytest tests/test_validation.py -v`
Expected: All tests PASS.

- [ ] **Step 6: Run full test suite to check for regressions**

Run: `cd backend && pdm run pytest -v`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/assumptions.py backend/app/schemas/scenario.py backend/tests/test_validation.py
git commit -m "feat: add input validation to assumptions and scenario schemas"
```

---

### Task 6: Update frontend types and Revenue/Expenses tab

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/components/PropertyDetail/RevenueExpensesTab.tsx`

- [ ] **Step 1: Add new fields to TypeScript interfaces**

In `frontend/src/types/index.ts`:

Add to `STRAssumptions` interface (after `vacancy_reserve_pct`):
```typescript
  rental_delay_months: number;
```

Add after `local_str_registration_fee`:
```typescript
  local_gross_receipts_tax_pct: number;
```

Add to `ComputedResults` interface (after `metrics`):
```typescript
  rental_delay_months: number;
  tax_impact: {
    guest_facing_tax_pct: number;
    platform_remits: boolean;
    effective_nightly_rate_with_tax: number;
  } | null;
```

Add `dscr_warning` to the metrics object inside `ComputedResults`:
```typescript
    dscr_warning: string | null;
```

Add `gross_receipts_tax` to `ExpenseBreakdown` (the `breakdown: Record<string, number>` already handles this dynamically, so no change needed there).

- [ ] **Step 2: Add rental delay input to RevenueExpensesTab**

In `frontend/src/components/PropertyDetail/RevenueExpensesTab.tsx`:

Add tooltip to `TOOLTIPS`:
```typescript
  rental_delay_months:
    "Months between property acquisition and first guest booking. Covers renovation, furnishing, permits, and listing setup. During this period you pay all carrying costs with zero revenue. Default: 1 month.",
  local_gross_receipts_tax_pct:
    "Burlington, VT levies a 9% gross receipts tax on STR revenue. Unlike rooms tax, this is an operator expense that directly reduces your cashflow. Set to 0% outside Burlington.",
```

Add a "Rental Delay" section in the left column (Revenue), after the Avg Stay Length input:
```tsx
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Rental Delay (months)
              <TooltipIcon text={TOOLTIPS.rental_delay_months} />
            </label>
            <input
              type="number"
              min="0"
              max="12"
              step="1"
              value={form.rental_delay_months ?? 1}
              onChange={(e) => updateField("rental_delay_months", parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
```

Add `local_gross_receipts_tax_pct` input in the Vermont/State Taxes section:
```tsx
          <PercentInput
            label="Local Gross Receipts Tax %"
            value={form.local_gross_receipts_tax_pct}
            onChange={(v) => updateField("local_gross_receipts_tax_pct", v)}
            tooltip={TOOLTIPS.local_gross_receipts_tax_pct}
          />
```

- [ ] **Step 3: Verify frontend builds**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/PropertyDetail/RevenueExpensesTab.tsx
git commit -m "feat: add rental delay and gross receipts tax inputs to frontend"
```

---

### Task 7: Update Results tab with DSCR warning, tax impact display, and rental delay info

**Files:**
- Modify: `frontend/src/components/PropertyDetail/ResultsTab.tsx`

- [ ] **Step 1: Add DSCR warning banner**

In `ResultsTab.tsx`, after the metric cards `<div>` (after line ~196), add:

```tsx
      {/* DSCR Warning */}
      {m.dscr_warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-amber-500 text-lg mt-0.5">&#9888;</span>
          <div>
            <p className="text-sm font-medium text-amber-800">DSCR Lender Warning</p>
            <p className="text-sm text-amber-700">{m.dscr_warning}</p>
          </div>
        </div>
      )}
```

- [ ] **Step 2: Add rental delay info banner**

After the DSCR warning, add:

```tsx
      {/* Rental Delay Notice */}
      {results.rental_delay_months > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-blue-500 text-lg mt-0.5">&#128197;</span>
          <div>
            <p className="text-sm font-medium text-blue-800">
              Year-1 Adjusted ({results.rental_delay_months}-month rental delay)
            </p>
            <p className="text-sm text-blue-700">
              Metrics reflect {12 - results.rental_delay_months} months of rental income with 12 months of carrying costs.
              Carrying costs during the delay period are added to total cash invested.
            </p>
          </div>
        </div>
      )}
```

- [ ] **Step 3: Add guest-facing tax impact display**

In the Revenue Breakdown table (after the "Annual Turnovers" row), add:

```tsx
              {results.tax_impact && (
                <>
                  <tr className="bg-amber-50/50">
                    <td className="px-4 py-3 text-slate-700">
                      Guest-Facing Tax Rate
                      {results.tax_impact.platform_remits && (
                        <span className="ml-2 text-xs text-slate-400">(platform remits)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{fmtPct(results.tax_impact.guest_facing_tax_pct)}</td>
                  </tr>
                  <tr className="bg-amber-50/50">
                    <td className="px-4 py-3 text-slate-500 pl-8">Effective Nightly Rate (with tax)</td>
                    <td className="px-4 py-3 text-right">{fmtCurrency(results.tax_impact.effective_nightly_rate_with_tax)}</td>
                  </tr>
                </>
              )}
```

- [ ] **Step 4: Verify frontend builds**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PropertyDetail/ResultsTab.tsx
git commit -m "feat: display DSCR warning, rental delay info, and tax impact in results"
```

---

### Task 8: Integration test for full compute pipeline with new fields

**Files:**
- Modify: `backend/tests/test_api_compute.py`

- [ ] **Step 1: Write integration test for rental delay and gross receipts tax**

Add to `backend/tests/test_api_compute.py`:

```python
class TestComputeWithTier1Fields:
    def test_results_include_rental_delay(self, client):
        # Create property with assumptions that have rental delay
        resp = client.post("/api/properties", json={"name": "Delay Test", "listing_price": 400000, "annual_taxes": 6000})
        pid = resp.json()["id"]
        # Update assumptions with rental delay
        client.put(f"/api/properties/{pid}/assumptions", json={"rental_delay_months": 2})
        # Create scenario
        client.post(f"/api/properties/{pid}/scenarios", json={
            "name": "Test", "purchase_price": 400000, "down_payment_pct": 25,
            "down_payment_amt": 100000, "interest_rate": 7.25, "loan_term_years": 30,
            "closing_cost_pct": 3, "closing_cost_amt": 12000,
        })
        # Get results
        resp = client.get(f"/api/properties/{pid}/results")
        assert resp.status_code == 200
        data = resp.json()
        assert data["rental_delay_months"] == 2

    def test_dscr_warning_when_low(self, client):
        # Create property with DSCR loan and poor metrics
        resp = client.post("/api/properties", json={"name": "DSCR Test", "listing_price": 600000, "annual_taxes": 10000})
        pid = resp.json()["id"]
        client.put(f"/api/properties/{pid}/assumptions", json={"avg_nightly_rate": 100, "occupancy_pct": 40})
        client.post(f"/api/properties/{pid}/scenarios", json={
            "name": "DSCR Loan", "loan_type": "dscr", "purchase_price": 600000,
            "down_payment_pct": 25, "down_payment_amt": 150000,
            "interest_rate": 8.0, "loan_term_years": 30,
            "closing_cost_pct": 3, "closing_cost_amt": 18000,
        })
        resp = client.get(f"/api/properties/{pid}/results")
        assert resp.status_code == 200
        data = resp.json()
        if data["metrics"]["dscr"] < 1.25:
            assert data["metrics"]["dscr_warning"] is not None
            assert "1.25" in data["metrics"]["dscr_warning"]

    def test_gross_receipts_tax_in_expenses(self, client):
        resp = client.post("/api/properties", json={"name": "Burlington", "listing_price": 400000, "annual_taxes": 6000})
        pid = resp.json()["id"]
        client.put(f"/api/properties/{pid}/assumptions", json={"local_gross_receipts_tax_pct": 9.0})
        client.post(f"/api/properties/{pid}/scenarios", json={
            "name": "Test", "purchase_price": 400000, "down_payment_pct": 25,
            "down_payment_amt": 100000, "interest_rate": 7.25, "loan_term_years": 30,
            "closing_cost_pct": 3, "closing_cost_amt": 12000,
        })
        resp = client.get(f"/api/properties/{pid}/results")
        assert resp.status_code == 200
        data = resp.json()
        assert data["expenses"]["breakdown"]["gross_receipts_tax"] > 0

    def test_tax_impact_display(self, client):
        resp = client.post("/api/properties", json={"name": "VT Tax", "listing_price": 400000, "annual_taxes": 6000})
        pid = resp.json()["id"]
        # Default assumptions have VT taxes (9% + 3% + 1% = 13%)
        client.post(f"/api/properties/{pid}/scenarios", json={
            "name": "Test", "purchase_price": 400000, "down_payment_pct": 25,
            "down_payment_amt": 100000, "interest_rate": 7.25, "loan_term_years": 30,
            "closing_cost_pct": 3, "closing_cost_amt": 12000,
        })
        resp = client.get(f"/api/properties/{pid}/results")
        assert resp.status_code == 200
        data = resp.json()
        assert data["tax_impact"] is not None
        assert data["tax_impact"]["guest_facing_tax_pct"] == 13.0
        assert data["tax_impact"]["platform_remits"] is True
```

- [ ] **Step 2: Run integration tests**

Run: `cd backend && pdm run pytest tests/test_api_compute.py -v`
Expected: All tests PASS.

- [ ] **Step 3: Run full test suite**

Run: `cd backend && pdm run pytest -v`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_api_compute.py
git commit -m "test: add integration tests for tier 1 accuracy fixes"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && pdm run pytest -v`
Expected: All tests PASS.

- [ ] **Step 2: Build frontend**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Run frontend lint**

Run: `cd frontend && npm run lint`
Expected: No errors.

- [ ] **Step 4: Verify Docker build**

Run: `docker compose build`
Expected: Both services build successfully.

- [ ] **Step 5: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "chore: tier 1 accuracy fixes complete"
git push
```
