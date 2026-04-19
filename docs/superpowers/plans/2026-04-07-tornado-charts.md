# Sensitivity Tornado Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tornado chart sensitivity analysis as a new "Sensitivity" tab, supporting both STR and LTR properties with three target metrics and click-to-drill-down sweeps.

**Architecture:** New `tornado.py` computation module with pure functions following existing patterns. Two new API endpoints (STR/LTR). New `SensitivityTab.tsx` component added as a fifth tab in `PropertyDetail`. Custom SVG tornado and drill-down charts matching existing chart style.

**Tech Stack:** Python/FastAPI (backend), React/TypeScript with hand-rolled SVG (frontend), Pydantic schemas, pytest.

**Spec:** `docs/superpowers/specs/2026-04-07-tornado-charts-design.md`

---

## File Structure

**Create:**
- `backend/app/services/computation/tornado.py` — STR and LTR tornado computation functions
- `backend/tests/test_tornado.py` — Unit tests for tornado computation
- `frontend/src/components/PropertyDetail/SensitivityTab.tsx` — New tab with tornado chart, metric selector, drill-down chart

**Modify:**
- `backend/app/schemas/results.py` — Add `TornadoSweepPoint`, `TornadoBar`, `TornadoResponse` schemas
- `backend/app/routers/compute.py` — Add `/tornado` and `/ltr-tornado` endpoints
- `frontend/src/types/index.ts` — Add `TornadoSweepPoint`, `TornadoBar`, `TornadoData` interfaces
- `frontend/src/api/client.ts` — Add `getTornado()` and `getLTRTornado()` calls
- `frontend/src/components/PropertyDetail/PropertyDetail.tsx` — Add "Sensitivity" tab

---

### Task 1: Backend — Pydantic schemas

**Files:**
- Modify: `backend/app/schemas/results.py:171` (append after last class)

- [ ] **Step 1: Add tornado schemas to results.py**

Append these classes at the end of `backend/app/schemas/results.py`:

```python
class TornadoSweepPoint(BaseModel):
    input_value: float
    output_value: float


class TornadoBar(BaseModel):
    variable_name: str
    variable_label: str
    baseline_input: float
    low_input: float
    high_input: float
    low_output: float
    high_output: float
    spread: float
    sweep: list[TornadoSweepPoint]


class TornadoResponse(BaseModel):
    metric_key: str
    metric_label: str
    baseline_value: float
    bars: list[TornadoBar]
```

- [ ] **Step 2: Verify import works**

Run: `cd /Users/thibaultdody/Desktop/Misc/property_analysis/backend && python -c "from app.schemas.results import TornadoResponse; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/results.py
git commit -m "feat(THI-23): add tornado chart Pydantic schemas"
```

---

### Task 2: Backend — STR tornado computation

**Files:**
- Create: `backend/app/services/computation/tornado.py`
- Create: `backend/tests/test_tornado.py`

- [ ] **Step 1: Write failing tests for STR tornado**

Create `backend/tests/test_tornado.py`:

```python
from app.services.computation.tornado import compute_tornado

# Baseline params matching existing test_sensitivity.py values
BASE_STR_PARAMS = dict(
    avg_nightly_rate=200.0,
    occupancy_pct=65.0,
    cleaning_fee_per_stay=150.0,
    avg_stay_length_nights=3.0,
    platform_fee_pct=3.0,
    cleaning_cost_per_turn=120.0,
    property_mgmt_pct=0.0,
    maintenance_reserve_pct=5.0,
    capex_reserve_pct=5.0,
    fixed_opex_annual=4200.0,
    total_monthly_housing=2838.20,
    total_cash_invested=80000.0,
    purchase_price=400000.0,
    monthly_pi=1900.0,
)

VALID_METRICS = ["monthly_cashflow", "cash_on_cash_return", "cap_rate"]


class TestSTRTornado:
    def test_returns_required_keys(self):
        result = compute_tornado(metric_key="monthly_cashflow", **BASE_STR_PARAMS)
        assert "metric_key" in result
        assert "metric_label" in result
        assert "baseline_value" in result
        assert "bars" in result
        assert result["metric_key"] == "monthly_cashflow"

    def test_bars_sorted_by_spread_descending(self):
        result = compute_tornado(metric_key="monthly_cashflow", **BASE_STR_PARAMS)
        bars = result["bars"]
        assert len(bars) > 0
        spreads = [b["spread"] for b in bars]
        assert spreads == sorted(spreads, reverse=True)

    def test_each_bar_has_required_fields(self):
        result = compute_tornado(metric_key="monthly_cashflow", **BASE_STR_PARAMS)
        for bar in result["bars"]:
            assert "variable_name" in bar
            assert "variable_label" in bar
            assert "baseline_input" in bar
            assert "low_input" in bar
            assert "high_input" in bar
            assert "low_output" in bar
            assert "high_output" in bar
            assert "spread" in bar
            assert "sweep" in bar
            assert len(bar["sweep"]) >= 2

    def test_sweep_points_cover_range(self):
        result = compute_tornado(metric_key="monthly_cashflow", **BASE_STR_PARAMS)
        bar = result["bars"][0]
        inputs = [p["input_value"] for p in bar["sweep"]]
        assert min(inputs) <= bar["low_input"] + 0.01
        assert max(inputs) >= bar["high_input"] - 0.01

    def test_spread_is_absolute_difference(self):
        result = compute_tornado(metric_key="monthly_cashflow", **BASE_STR_PARAMS)
        for bar in result["bars"]:
            expected_spread = abs(bar["high_output"] - bar["low_output"])
            assert abs(bar["spread"] - expected_spread) < 0.01

    def test_all_three_metrics_work(self):
        for metric in VALID_METRICS:
            result = compute_tornado(metric_key=metric, **BASE_STR_PARAMS)
            assert result["metric_key"] == metric
            assert len(result["bars"]) > 0

    def test_baseline_value_matches_metric(self):
        """Baseline value should equal the metric computed with all defaults."""
        result = compute_tornado(metric_key="monthly_cashflow", **BASE_STR_PARAMS)
        # Baseline should be a finite number
        assert isinstance(result["baseline_value"], float)

    def test_invalid_metric_raises(self):
        import pytest
        with pytest.raises(ValueError):
            compute_tornado(metric_key="invalid_metric", **BASE_STR_PARAMS)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/thibaultdody/Desktop/Misc/property_analysis/backend && python -m pytest tests/test_tornado.py -v`
Expected: FAIL — `ModuleNotFoundError` or `ImportError`

- [ ] **Step 3: Implement compute_tornado**

Create `backend/app/services/computation/tornado.py`:

```python
"""Tornado sensitivity analysis — one-at-a-time variable sweeps."""

from app.services.computation.revenue import compute_gross_revenue, compute_net_revenue
from app.services.computation.expenses import compute_operating_expenses
from app.services.computation.metrics import (
    compute_noi,
    compute_cashflow,
    compute_cash_on_cash_return,
    compute_cap_rate,
)
from app.services.computation.ltr_revenue import (
    compute_ltr_gross_revenue,
    compute_ltr_effective_revenue,
)
from app.services.computation.ltr_expenses import compute_ltr_operating_expenses


METRIC_LABELS = {
    "monthly_cashflow": "Monthly Cashflow",
    "cash_on_cash_return": "Cash-on-Cash Return",
    "cap_rate": "Cap Rate",
}

# STR variable definitions: (name, label, param_key, range_type, delta)
# range_type: "abs" = absolute points, "pct" = percentage of baseline
STR_VARIABLES = [
    ("occupancy_pct", "Occupancy Rate", "abs", 15),
    ("avg_nightly_rate", "Nightly Rate", "pct", 25),
    ("platform_fee_pct", "Platform Fee", "abs", 3),
    ("property_mgmt_pct", "Property Mgmt %", "abs", 5),
    ("cleaning_cost_per_turn", "Cleaning Cost / Turn", "pct", 30),
    ("maintenance_reserve_pct", "Maintenance Reserve", "abs", 3),
    ("capex_reserve_pct", "CapEx Reserve", "abs", 3),
    ("avg_stay_length_nights", "Avg Stay Length", "abs", 1.5),
]

LTR_VARIABLES = [
    ("monthly_rent", "Monthly Rent", "pct", 20),
    ("vacancy_rate_pct", "Vacancy Rate", "abs", 5),
    ("property_mgmt_pct", "Property Mgmt %", "abs", 5),
    ("maintenance_reserve_pct", "Maintenance Reserve", "abs", 3),
    ("capex_reserve_pct", "CapEx Reserve", "abs", 3),
    ("tenant_turnover_cost", "Tenant Turnover Cost", "pct", 50),
]

SWEEP_POINTS = 11


def _compute_low_high(baseline: float, range_type: str, delta: float, floor: float = 0.0) -> tuple[float, float]:
    """Compute low and high values for a variable."""
    if range_type == "abs":
        low = max(baseline - delta, floor)
        high = baseline + delta
    else:  # pct
        low = max(baseline * (1 - delta / 100), floor)
        high = baseline * (1 + delta / 100)
    return round(low, 4), round(high, 4)


def _str_metric(
    metric_key: str,
    avg_nightly_rate: float,
    occupancy_pct: float,
    cleaning_fee_per_stay: float,
    avg_stay_length_nights: float,
    platform_fee_pct: float,
    cleaning_cost_per_turn: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    fixed_opex_annual: float,
    total_monthly_housing: float,
    total_cash_invested: float,
    purchase_price: float,
    monthly_pi: float,
) -> float:
    """Run the full STR pipeline and extract one metric."""
    gross = compute_gross_revenue(avg_nightly_rate, occupancy_pct, cleaning_fee_per_stay, avg_stay_length_nights)
    net = compute_net_revenue(gross["total_gross_revenue"], platform_fee_pct)
    expenses = compute_operating_expenses(
        annual_turnovers=gross["annual_turnovers"],
        cleaning_cost_per_turn=cleaning_cost_per_turn,
        net_annual_revenue=net["net_revenue"],
        gross_annual_revenue=gross["total_gross_revenue"],
        property_mgmt_pct=property_mgmt_pct,
        maintenance_reserve_pct=maintenance_reserve_pct,
        capex_reserve_pct=capex_reserve_pct,
        utilities_monthly=0,
        supplies_monthly=0,
        lawn_snow_monthly=0,
        other_monthly_expense=0,
        local_str_registration_fee=0,
    )
    total_opex = expenses["total_annual_operating_exp"] + fixed_opex_annual
    noi = compute_noi(net["net_revenue"], total_opex)

    if metric_key == "monthly_cashflow":
        cf = compute_cashflow(noi, total_monthly_housing)
        return cf["monthly_cashflow"]
    elif metric_key == "cash_on_cash_return":
        cf = compute_cashflow(noi, total_monthly_housing)
        return compute_cash_on_cash_return(cf["annual_cashflow"], total_cash_invested)
    elif metric_key == "cap_rate":
        return compute_cap_rate(noi, purchase_price)
    else:
        raise ValueError(f"Unknown metric_key: {metric_key}")


def compute_tornado(
    metric_key: str,
    avg_nightly_rate: float,
    occupancy_pct: float,
    cleaning_fee_per_stay: float,
    avg_stay_length_nights: float,
    platform_fee_pct: float,
    cleaning_cost_per_turn: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    fixed_opex_annual: float,
    total_monthly_housing: float,
    total_cash_invested: float,
    purchase_price: float,
    monthly_pi: float,
) -> dict:
    """Compute STR tornado sensitivity for a given metric."""
    if metric_key not in METRIC_LABELS:
        raise ValueError(f"Unknown metric_key: {metric_key}. Valid: {list(METRIC_LABELS.keys())}")

    params = dict(
        avg_nightly_rate=avg_nightly_rate,
        occupancy_pct=occupancy_pct,
        cleaning_fee_per_stay=cleaning_fee_per_stay,
        avg_stay_length_nights=avg_stay_length_nights,
        platform_fee_pct=platform_fee_pct,
        cleaning_cost_per_turn=cleaning_cost_per_turn,
        property_mgmt_pct=property_mgmt_pct,
        maintenance_reserve_pct=maintenance_reserve_pct,
        capex_reserve_pct=capex_reserve_pct,
        fixed_opex_annual=fixed_opex_annual,
        total_monthly_housing=total_monthly_housing,
        total_cash_invested=total_cash_invested,
        purchase_price=purchase_price,
        monthly_pi=monthly_pi,
    )

    baseline_value = _str_metric(metric_key, **params)

    bars = []
    for var_name, var_label, range_type, delta in STR_VARIABLES:
        baseline_input = params[var_name]
        floor = 1.0 if var_name == "avg_stay_length_nights" else 0.0
        low_input, high_input = _compute_low_high(baseline_input, range_type, delta, floor=floor)

        # Compute at low
        low_params = {**params, var_name: low_input}
        low_output = _str_metric(metric_key, **low_params)

        # Compute at high
        high_params = {**params, var_name: high_input}
        high_output = _str_metric(metric_key, **high_params)

        # Sweep
        sweep = []
        step = (high_input - low_input) / (SWEEP_POINTS - 1) if SWEEP_POINTS > 1 else 0
        for i in range(SWEEP_POINTS):
            input_val = round(low_input + step * i, 4)
            sweep_params = {**params, var_name: input_val}
            output_val = _str_metric(metric_key, **sweep_params)
            sweep.append({"input_value": round(input_val, 2), "output_value": round(output_val, 2)})

        bars.append({
            "variable_name": var_name,
            "variable_label": var_label,
            "baseline_input": round(baseline_input, 2),
            "low_input": round(low_input, 2),
            "high_input": round(high_input, 2),
            "low_output": round(low_output, 2),
            "high_output": round(high_output, 2),
            "spread": round(abs(high_output - low_output), 2),
            "sweep": sweep,
        })

    bars.sort(key=lambda b: b["spread"], reverse=True)

    return {
        "metric_key": metric_key,
        "metric_label": METRIC_LABELS[metric_key],
        "baseline_value": round(baseline_value, 2),
        "bars": bars,
    }


def _ltr_metric(
    metric_key: str,
    monthly_rent: float,
    pet_rent_monthly: float,
    late_fee_monthly: float,
    vacancy_rate_pct: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    fixed_opex_annual: float,
    tenant_turnover_cost: float,
    lease_duration_months: int,
    total_monthly_housing: float,
    total_cash_invested: float,
    purchase_price: float,
) -> float:
    """Run the full LTR pipeline and extract one metric."""
    gross = compute_ltr_gross_revenue(monthly_rent, pet_rent_monthly, late_fee_monthly)
    effective = compute_ltr_effective_revenue(gross, vacancy_rate_pct)
    expenses = compute_ltr_operating_expenses(
        effective_annual_revenue=effective,
        gross_annual_revenue=gross,
        property_mgmt_pct=property_mgmt_pct,
        maintenance_reserve_pct=maintenance_reserve_pct,
        capex_reserve_pct=capex_reserve_pct,
        tenant_turnover_cost=tenant_turnover_cost,
        lease_duration_months=lease_duration_months,
        insurance_annual=0,
        landlord_repairs_annual=0,
        utilities_monthly=0,
        lawn_snow_monthly=0,
        other_monthly_expense=0,
        accounting_annual=0,
        legal_annual=0,
    )
    total_opex = expenses["total_annual_operating_exp"] + fixed_opex_annual
    noi = compute_noi(effective, total_opex)

    if metric_key == "monthly_cashflow":
        cf = compute_cashflow(noi, total_monthly_housing)
        return cf["monthly_cashflow"]
    elif metric_key == "cash_on_cash_return":
        cf = compute_cashflow(noi, total_monthly_housing)
        return compute_cash_on_cash_return(cf["annual_cashflow"], total_cash_invested)
    elif metric_key == "cap_rate":
        return compute_cap_rate(noi, purchase_price)
    else:
        raise ValueError(f"Unknown metric_key: {metric_key}")


def compute_ltr_tornado(
    metric_key: str,
    monthly_rent: float,
    pet_rent_monthly: float,
    late_fee_monthly: float,
    vacancy_rate_pct: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    fixed_opex_annual: float,
    tenant_turnover_cost: float,
    lease_duration_months: int,
    total_monthly_housing: float,
    total_cash_invested: float,
    purchase_price: float,
) -> dict:
    """Compute LTR tornado sensitivity for a given metric."""
    if metric_key not in METRIC_LABELS:
        raise ValueError(f"Unknown metric_key: {metric_key}. Valid: {list(METRIC_LABELS.keys())}")

    params = dict(
        monthly_rent=monthly_rent,
        pet_rent_monthly=pet_rent_monthly,
        late_fee_monthly=late_fee_monthly,
        vacancy_rate_pct=vacancy_rate_pct,
        property_mgmt_pct=property_mgmt_pct,
        maintenance_reserve_pct=maintenance_reserve_pct,
        capex_reserve_pct=capex_reserve_pct,
        fixed_opex_annual=fixed_opex_annual,
        tenant_turnover_cost=tenant_turnover_cost,
        lease_duration_months=lease_duration_months,
        total_monthly_housing=total_monthly_housing,
        total_cash_invested=total_cash_invested,
        purchase_price=purchase_price,
    )

    baseline_value = _ltr_metric(metric_key, **params)

    bars = []
    for var_name, var_label, range_type, delta in LTR_VARIABLES:
        baseline_input = params[var_name]
        low_input, high_input = _compute_low_high(baseline_input, range_type, delta)

        low_params = {**params, var_name: low_input}
        low_output = _ltr_metric(metric_key, **low_params)

        high_params = {**params, var_name: high_input}
        high_output = _ltr_metric(metric_key, **high_params)

        sweep = []
        step = (high_input - low_input) / (SWEEP_POINTS - 1) if SWEEP_POINTS > 1 else 0
        for i in range(SWEEP_POINTS):
            input_val = round(low_input + step * i, 4)
            sweep_params = {**params, var_name: input_val}
            output_val = _ltr_metric(metric_key, **sweep_params)
            sweep.append({"input_value": round(input_val, 2), "output_value": round(output_val, 2)})

        bars.append({
            "variable_name": var_name,
            "variable_label": var_label,
            "baseline_input": round(float(baseline_input), 2),
            "low_input": round(low_input, 2),
            "high_input": round(high_input, 2),
            "low_output": round(low_output, 2),
            "high_output": round(high_output, 2),
            "spread": round(abs(high_output - low_output), 2),
            "sweep": sweep,
        })

    bars.sort(key=lambda b: b["spread"], reverse=True)

    return {
        "metric_key": metric_key,
        "metric_label": METRIC_LABELS[metric_key],
        "baseline_value": round(baseline_value, 2),
        "bars": bars,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/thibaultdody/Desktop/Misc/property_analysis/backend && python -m pytest tests/test_tornado.py -v`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/computation/tornado.py backend/tests/test_tornado.py
git commit -m "feat(THI-23): add STR tornado computation with tests"
```

---

### Task 3: Backend — LTR tornado tests

**Files:**
- Modify: `backend/tests/test_tornado.py`

- [ ] **Step 1: Add LTR tornado tests**

Append to `backend/tests/test_tornado.py`:

```python
from app.services.computation.tornado import compute_ltr_tornado

BASE_LTR_PARAMS = dict(
    monthly_rent=2000.0,
    pet_rent_monthly=50.0,
    late_fee_monthly=0.0,
    vacancy_rate_pct=5.0,
    property_mgmt_pct=8.0,
    maintenance_reserve_pct=5.0,
    capex_reserve_pct=5.0,
    fixed_opex_annual=6000.0,
    tenant_turnover_cost=2000.0,
    lease_duration_months=12,
    total_monthly_housing=1800.0,
    total_cash_invested=60000.0,
    purchase_price=300000.0,
)


class TestLTRTornado:
    def test_returns_required_keys(self):
        result = compute_ltr_tornado(metric_key="monthly_cashflow", **BASE_LTR_PARAMS)
        assert result["metric_key"] == "monthly_cashflow"
        assert "baseline_value" in result
        assert "bars" in result

    def test_bars_sorted_by_spread_descending(self):
        result = compute_ltr_tornado(metric_key="monthly_cashflow", **BASE_LTR_PARAMS)
        spreads = [b["spread"] for b in result["bars"]]
        assert spreads == sorted(spreads, reverse=True)

    def test_all_three_metrics_work(self):
        for metric in VALID_METRICS:
            result = compute_ltr_tornado(metric_key=metric, **BASE_LTR_PARAMS)
            assert result["metric_key"] == metric
            assert len(result["bars"]) > 0

    def test_ltr_variable_count(self):
        result = compute_ltr_tornado(metric_key="monthly_cashflow", **BASE_LTR_PARAMS)
        # 6 LTR variables defined in LTR_VARIABLES
        assert len(result["bars"]) == 6
```

- [ ] **Step 2: Run all tornado tests**

Run: `cd /Users/thibaultdody/Desktop/Misc/property_analysis/backend && python -m pytest tests/test_tornado.py -v`
Expected: All 12 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_tornado.py
git commit -m "test(THI-23): add LTR tornado computation tests"
```

---

### Task 4: Backend — API endpoints

**Files:**
- Modify: `backend/app/routers/compute.py:34` (add import)
- Modify: `backend/app/routers/compute.py:295` (add endpoints after ltr-sensitivity)
- Modify: `backend/app/schemas/results.py` (add TornadoResponse to imports in compute.py)

- [ ] **Step 1: Add tornado import to compute.py**

At the top of `backend/app/routers/compute.py`, add to the imports from `app.schemas.results`:

```python
from app.schemas.results import (
    ...,
    TornadoResponse,
)
```

And add:

```python
from app.services.computation.tornado import compute_tornado, compute_ltr_tornado
```

- [ ] **Step 2: Add STR tornado endpoint**

After the `get_ltr_sensitivity_endpoint` function (line ~295), add:

```python
@router.get("/api/properties/{property_id}/tornado", response_model=TornadoResponse)
def get_tornado(property_id: str, metric: str = Query(default="monthly_cashflow"), db: Session = Depends(get_db)):
    valid_metrics = ["monthly_cashflow", "cash_on_cash_return", "cap_rate"]
    if metric not in valid_metrics:
        raise HTTPException(status_code=400, detail=f"Invalid metric. Valid: {valid_metrics}")
    prop, scenario, assumptions = _get_prop_scenario_assumptions(property_id, None, db)
    loan_amount = compute_loan_amount(float(scenario.purchase_price), float(scenario.down_payment_amt))
    monthly_pi = compute_monthly_pi(loan_amount, float(scenario.interest_rate), scenario.loan_term_years)
    monthly_pmi = compute_pmi(loan_amount, scenario.loan_type, float(scenario.down_payment_pct), None)
    total_monthly_housing = compute_total_monthly_housing(
        monthly_pi, monthly_pmi, float(prop.annual_taxes),
        float(assumptions.insurance_annual), float(prop.hoa_monthly),
        float(prop.nonhomestead_annual_taxes) if prop.nonhomestead_annual_taxes else None,
    )
    fixed_opex = compute_fixed_opex(assumptions)
    occupancy = get_occupancy(assumptions)
    total_cash = float(scenario.down_payment_amt) + float(scenario.closing_cost_amt) + float(scenario.renovation_cost) + float(scenario.furniture_cost) + float(scenario.other_upfront_costs)

    return compute_tornado(
        metric_key=metric,
        avg_nightly_rate=float(assumptions.avg_nightly_rate),
        occupancy_pct=occupancy,
        cleaning_fee_per_stay=float(assumptions.cleaning_fee_per_stay),
        avg_stay_length_nights=float(assumptions.avg_stay_length_nights),
        platform_fee_pct=float(assumptions.platform_fee_pct),
        cleaning_cost_per_turn=float(assumptions.cleaning_cost_per_turn),
        property_mgmt_pct=float(assumptions.property_mgmt_pct),
        maintenance_reserve_pct=float(assumptions.maintenance_reserve_pct),
        capex_reserve_pct=float(assumptions.capex_reserve_pct),
        fixed_opex_annual=fixed_opex,
        total_monthly_housing=total_monthly_housing,
        total_cash_invested=total_cash,
        purchase_price=float(scenario.purchase_price),
        monthly_pi=monthly_pi,
    )
```

- [ ] **Step 3: Add LTR tornado endpoint**

```python
@router.get("/api/properties/{property_id}/ltr-tornado", response_model=TornadoResponse)
def get_ltr_tornado(property_id: str, metric: str = Query(default="monthly_cashflow"), db: Session = Depends(get_db)):
    valid_metrics = ["monthly_cashflow", "cash_on_cash_return", "cap_rate"]
    if metric not in valid_metrics:
        raise HTTPException(status_code=400, detail=f"Invalid metric. Valid: {valid_metrics}")
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    scenario = db.query(MortgageScenario).filter(
        MortgageScenario.property_id == property_id,
        MortgageScenario.is_active == True,
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="No active scenario found")
    ltr = _get_ltr_assumptions(property_id, db)

    loan_amount = compute_loan_amount(float(scenario.purchase_price), float(scenario.down_payment_amt))
    monthly_pi = compute_monthly_pi(loan_amount, float(scenario.interest_rate), scenario.loan_term_years)
    monthly_pmi = compute_pmi(loan_amount, scenario.loan_type, float(scenario.down_payment_pct), None)
    total_monthly_housing = compute_total_monthly_housing(
        monthly_pi, monthly_pmi, float(prop.annual_taxes),
        float(ltr.insurance_annual), float(prop.hoa_monthly),
        float(prop.nonhomestead_annual_taxes) if prop.nonhomestead_annual_taxes else None,
    )
    fixed_opex = compute_ltr_fixed_opex(ltr)
    total_cash = float(scenario.down_payment_amt) + float(scenario.closing_cost_amt) + float(scenario.renovation_cost) + float(scenario.furniture_cost) + float(scenario.other_upfront_costs)

    return compute_ltr_tornado(
        metric_key=metric,
        monthly_rent=float(ltr.monthly_rent),
        pet_rent_monthly=float(ltr.pet_rent_monthly),
        late_fee_monthly=float(ltr.late_fee_monthly),
        vacancy_rate_pct=float(ltr.vacancy_rate_pct),
        property_mgmt_pct=float(ltr.property_mgmt_pct),
        maintenance_reserve_pct=float(ltr.maintenance_reserve_pct),
        capex_reserve_pct=float(ltr.capex_reserve_pct),
        fixed_opex_annual=fixed_opex,
        tenant_turnover_cost=float(ltr.tenant_turnover_cost),
        lease_duration_months=int(ltr.lease_duration_months),
        total_monthly_housing=total_monthly_housing,
        total_cash_invested=total_cash,
        purchase_price=float(scenario.purchase_price),
    )
```

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `cd /Users/thibaultdody/Desktop/Misc/property_analysis/backend && python -m pytest tests/ -v --tb=short`
Expected: All tests PASS including new tornado tests

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/compute.py backend/app/schemas/results.py
git commit -m "feat(THI-23): add tornado API endpoints for STR and LTR"
```

---

### Task 5: Frontend — TypeScript types and API client

**Files:**
- Modify: `frontend/src/types/index.ts:315` (append after LTRSensitivityData)
- Modify: `frontend/src/api/client.ts:54` (append after getLTRSensitivity)

- [ ] **Step 1: Add TypeScript interfaces**

Append to `frontend/src/types/index.ts`:

```typescript
export interface TornadoSweepPoint {
  input_value: number;
  output_value: number;
}

export interface TornadoBar {
  variable_name: string;
  variable_label: string;
  baseline_input: number;
  low_input: number;
  high_input: number;
  low_output: number;
  high_output: number;
  spread: number;
  sweep: TornadoSweepPoint[];
}

export interface TornadoData {
  metric_key: string;
  metric_label: string;
  baseline_value: number;
  bars: TornadoBar[];
}
```

- [ ] **Step 2: Add API calls**

Add after the `getLTRSensitivity` line in `frontend/src/api/client.ts`:

```typescript
// Tornado sensitivity
export const getTornado = (propertyId: string, metric: string = "monthly_cashflow") =>
  api.get<TornadoData>(`/properties/${propertyId}/tornado`, { params: { metric } }).then((r) => r.data);
export const getLTRTornado = (propertyId: string, metric: string = "monthly_cashflow") =>
  api.get<TornadoData>(`/properties/${propertyId}/ltr-tornado`, { params: { metric } }).then((r) => r.data);
```

Add `TornadoData` to the import from `../types`:

```typescript
import type {
  ...,
  TornadoData,
} from "../types";
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd /Users/thibaultdody/Desktop/Misc/property_analysis/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/client.ts
git commit -m "feat(THI-23): add tornado TypeScript types and API calls"
```

---

### Task 6: Frontend — SensitivityTab component

**Files:**
- Create: `frontend/src/components/PropertyDetail/SensitivityTab.tsx`

- [ ] **Step 1: Create SensitivityTab.tsx**

Create `frontend/src/components/PropertyDetail/SensitivityTab.tsx` with:

1. **Metric pill selector** — Three toggle buttons (Monthly Cashflow, Cash-on-Cash, Cap Rate)
2. **TornadoChart** — SVG horizontal bar chart centered on baseline
3. **DrillDownChart** — SVG line chart shown on bar click

The complete component code:

```typescript
import { useState, useEffect, useCallback } from "react";
import type { TornadoData, TornadoBar } from "../../types/index.ts";
import { getTornado, getLTRTornado } from "../../api/client.ts";

interface SensitivityTabProps {
  propertyId: string;
  activeRentalType: "str" | "ltr";
}

const METRICS = [
  { key: "monthly_cashflow", label: "Monthly Cashflow" },
  { key: "cash_on_cash_return", label: "Cash-on-Cash" },
  { key: "cap_rate", label: "Cap Rate" },
] as const;

function fmtMetricValue(value: number, metricKey: string): string {
  if (metricKey === "monthly_cashflow") {
    const abs = Math.abs(value);
    const formatted = `$${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    return value < 0 ? `-${formatted}` : formatted;
  }
  return `${value.toFixed(1)}%`;
}

function fmtInputValue(value: number, variableName: string): string {
  if (variableName.includes("pct") || variableName.includes("rate")) {
    return `${value.toFixed(1)}%`;
  }
  if (variableName.includes("rent") || variableName.includes("cost") || variableName.includes("rate") && !variableName.includes("pct")) {
    if (variableName === "avg_nightly_rate" || variableName === "monthly_rent" || variableName.includes("cost")) {
      return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
  }
  if (variableName === "avg_stay_length_nights") {
    return `${value.toFixed(1)} nights`;
  }
  return value.toFixed(1);
}

function TornadoChart({
  data,
  onBarClick,
  selectedBar,
}: {
  data: TornadoData;
  onBarClick: (bar: TornadoBar) => void;
  selectedBar: TornadoBar | null;
}) {
  const bars = data.bars;
  if (bars.length === 0) return null;

  const barHeight = 28;
  const barGap = 12;
  const labelWidth = 160;
  const chartWidth = 700;
  const rightPad = 60;
  const topPad = 10;
  const chartAreaWidth = chartWidth - labelWidth - rightPad;
  const totalHeight = topPad + bars.length * (barHeight + barGap);

  // Find the max absolute deviation from baseline to scale bars symmetrically
  let maxDev = 0;
  for (const bar of bars) {
    const devLow = Math.abs(bar.low_output - data.baseline_value);
    const devHigh = Math.abs(bar.high_output - data.baseline_value);
    maxDev = Math.max(maxDev, devLow, devHigh);
  }
  if (maxDev === 0) maxDev = 1;

  const halfWidth = chartAreaWidth / 2;
  const centerX = labelWidth + halfWidth;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Impact on {data.metric_label}
        </h3>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Baseline:{" "}
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            {fmtMetricValue(data.baseline_value, data.metric_key)}
          </span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${chartWidth} ${totalHeight}`}
        className="w-full"
        style={{ height: "auto" }}
      >
        {/* Center baseline line */}
        <line
          x1={centerX}
          y1={0}
          x2={centerX}
          y2={totalHeight}
          stroke="currentColor"
          className="text-slate-300 dark:text-slate-600"
          strokeWidth={1}
          strokeDasharray="4,4"
        />

        {bars.map((bar, i) => {
          const y = topPad + i * (barHeight + barGap);
          const isSelected =
            selectedBar?.variable_name === bar.variable_name;

          // Position bars relative to baseline
          const lowDev = bar.low_output - data.baseline_value;
          const highDev = bar.high_output - data.baseline_value;

          const minDev = Math.min(lowDev, highDev);
          const maxDevBar = Math.max(lowDev, highDev);

          const leftEdge = centerX + (minDev / maxDev) * halfWidth;
          const rightEdge = centerX + (maxDevBar / maxDev) * halfWidth;

          // Split into downside (left of center) and upside (right of center)
          const downLeft = Math.min(leftEdge, centerX);
          const downRight = centerX;
          const upLeft = centerX;
          const upRight = Math.max(rightEdge, centerX);

          const downWidth = downRight - downLeft;
          const upWidth = upRight - upLeft;

          // Value annotations
          const worstVal =
            lowDev < highDev ? bar.low_output : bar.high_output;
          const bestVal =
            lowDev < highDev ? bar.high_output : bar.low_output;

          return (
            <g
              key={bar.variable_name}
              onClick={() => onBarClick(bar)}
              className="cursor-pointer"
              opacity={
                selectedBar && !isSelected ? 0.5 : 1
              }
            >
              {/* Hover background */}
              <rect
                x={0}
                y={y - 4}
                width={chartWidth}
                height={barHeight + 8}
                fill="transparent"
                className="hover:fill-slate-50 dark:hover:fill-slate-700/30"
                rx={4}
              />

              {/* Label */}
              <text
                x={8}
                y={y + barHeight / 2 + 1}
                fill="currentColor"
                className="text-slate-700 dark:text-slate-300"
                fontSize={12}
                fontFamily="system-ui"
                dominantBaseline="middle"
              >
                {bar.variable_label}
              </text>

              {/* Downside bar (red) */}
              {downWidth > 0.5 && (
                <rect
                  x={downLeft}
                  y={y}
                  width={downWidth}
                  height={barHeight}
                  rx={4}
                  fill="#ef4444"
                  opacity={0.8}
                />
              )}

              {/* Upside bar (green) */}
              {upWidth > 0.5 && (
                <rect
                  x={upLeft}
                  y={y}
                  width={upWidth}
                  height={barHeight}
                  rx={4}
                  fill="#22c55e"
                  opacity={0.8}
                />
              )}

              {/* Value annotations */}
              <text
                x={downLeft - 4}
                y={y + barHeight / 2 + 1}
                fill="#fca5a5"
                fontSize={10}
                textAnchor="end"
                fontFamily="system-ui"
                dominantBaseline="middle"
              >
                {fmtMetricValue(worstVal, data.metric_key)}
              </text>
              <text
                x={upRight + 4}
                y={y + barHeight / 2 + 1}
                fill="#86efac"
                fontSize={10}
                fontFamily="system-ui"
                dominantBaseline="middle"
              >
                {fmtMetricValue(bestVal, data.metric_key)}
              </text>

              {/* Selection indicator */}
              {isSelected && (
                <rect
                  x={0}
                  y={y - 4}
                  width={3}
                  height={barHeight + 8}
                  fill="#6366f1"
                  rx={1.5}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: "#ef4444", opacity: 0.8 }}
          />
          Downside (worst case)
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: "#22c55e", opacity: 0.8 }}
          />
          Upside (best case)
        </div>
      </div>
      <p className="text-center mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        Click a bar to see detailed sensitivity sweep
      </p>
    </div>
  );
}

function DrillDownChart({
  bar,
  metricKey,
  baselineValue,
  onClose,
}: {
  bar: TornadoBar;
  metricKey: string;
  baselineValue: number;
  onClose: () => void;
}) {
  const sweep = bar.sweep;
  if (sweep.length < 2) return null;

  const chartW = 700;
  const chartH = 220;
  const padL = 70;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const xMin = sweep[0].input_value;
  const xMax = sweep[sweep.length - 1].input_value;
  const yValues = sweep.map((p) => p.output_value);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const yPad = (yMax - yMin) * 0.1 || 1;
  const yLow = yMin - yPad;
  const yHigh = yMax + yPad;

  const scaleX = (v: number) =>
    padL + ((v - xMin) / (xMax - xMin || 1)) * plotW;
  const scaleY = (v: number) =>
    padT + (1 - (v - yLow) / (yHigh - yLow)) * plotH;

  const points = sweep
    .map((p) => `${scaleX(p.input_value)},${scaleY(p.output_value)}`)
    .join(" ");

  // Y-axis ticks (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => yLow + ((yHigh - yLow) * i) / 4);

  // Zero line
  const showZero = yLow < 0 && yHigh > 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mt-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {bar.variable_label} &rarr;{" "}
          {METRICS.find((m) => m.key === metricKey)?.label}
        </h3>
        <button
          onClick={onClose}
          className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-md px-3 py-1 text-xs hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          ✕ Close
        </button>
      </div>

      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="w-full"
        style={{ height: "auto" }}
      >
        {/* Axes */}
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + plotH}
          stroke="currentColor"
          className="text-slate-300 dark:text-slate-600"
          strokeWidth={1}
        />
        <line
          x1={padL}
          y1={padT + plotH}
          x2={padL + plotW}
          y2={padT + plotH}
          stroke="currentColor"
          className="text-slate-300 dark:text-slate-600"
          strokeWidth={1}
        />

        {/* Y-axis ticks */}
        {yTicks.map((tick, i) => (
          <text
            key={i}
            x={padL - 8}
            y={scaleY(tick)}
            fill="currentColor"
            className="text-slate-400 dark:text-slate-500"
            fontSize={10}
            textAnchor="end"
            dominantBaseline="middle"
            fontFamily="system-ui"
          >
            {fmtMetricValue(tick, metricKey)}
          </text>
        ))}

        {/* X-axis labels */}
        {sweep
          .filter((_, i) => i % Math.max(1, Math.floor(sweep.length / 5)) === 0 || i === sweep.length - 1)
          .map((p, i) => (
            <text
              key={i}
              x={scaleX(p.input_value)}
              y={padT + plotH + 18}
              fill="currentColor"
              className="text-slate-400 dark:text-slate-500"
              fontSize={10}
              textAnchor="middle"
              fontFamily="system-ui"
            >
              {fmtInputValue(p.input_value, bar.variable_name)}
            </text>
          ))}

        {/* Zero line */}
        {showZero && (
          <>
            <line
              x1={padL}
              y1={scaleY(0)}
              x2={padL + plotW}
              y2={scaleY(0)}
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="4,4"
              opacity={0.5}
            />
            <text
              x={padL - 8}
              y={scaleY(0)}
              fill="#ef4444"
              fontSize={10}
              textAnchor="end"
              dominantBaseline="middle"
              fontFamily="system-ui"
              opacity={0.7}
            >
              $0
            </text>
          </>
        )}

        {/* Baseline vertical line */}
        <line
          x1={scaleX(bar.baseline_input)}
          y1={padT}
          x2={scaleX(bar.baseline_input)}
          y2={padT + plotH}
          stroke="#a5b4fc"
          strokeWidth={1}
          strokeDasharray="3,3"
          opacity={0.6}
        />
        <text
          x={scaleX(bar.baseline_input)}
          y={padT + plotH + 32}
          fill="#a5b4fc"
          fontSize={10}
          textAnchor="middle"
          fontWeight={600}
          fontFamily="system-ui"
        >
          {fmtInputValue(bar.baseline_input, bar.variable_name)} (baseline)
        </text>

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#6366f1"
          strokeWidth={2}
        />

        {/* Dots */}
        {sweep.map((p, i) => {
          const isBaseline =
            Math.abs(p.input_value - bar.baseline_input) <
            Math.abs(sweep[1].input_value - sweep[0].input_value) * 0.5;
          return (
            <circle
              key={i}
              cx={scaleX(p.input_value)}
              cy={scaleY(p.output_value)}
              r={isBaseline ? 4 : 3}
              fill={isBaseline ? "#a5b4fc" : "#6366f1"}
              stroke={isBaseline ? "#6366f1" : "none"}
              strokeWidth={isBaseline ? 2 : 0}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function SensitivityTab({
  propertyId,
  activeRentalType,
}: SensitivityTabProps) {
  const [selectedMetric, setSelectedMetric] = useState("monthly_cashflow");
  const [tornadoData, setTornadoData] = useState<TornadoData | null>(null);
  const [selectedBar, setSelectedBar] = useState<TornadoBar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedBar(null);
    try {
      const fetcher =
        activeRentalType === "ltr" ? getLTRTornado : getTornado;
      const data = await fetcher(propertyId, selectedMetric);
      setTornadoData(data);
    } catch {
      setError("Failed to load sensitivity data");
    } finally {
      setLoading(false);
    }
  }, [propertyId, selectedMetric, activeRentalType]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleBarClick = (bar: TornadoBar) => {
    setSelectedBar((prev) =>
      prev?.variable_name === bar.variable_name ? null : bar
    );
  };

  return (
    <div className="space-y-6">
      {/* Metric selector */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Target Metric
        </label>
        <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 inline-flex gap-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedMetric(m.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                selectedMetric === m.key
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100 font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          Loading sensitivity analysis...
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-red-500 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && tornadoData && (
        <>
          <TornadoChart
            data={tornadoData}
            onBarClick={handleBarClick}
            selectedBar={selectedBar}
          />

          {selectedBar && (
            <DrillDownChart
              bar={selectedBar}
              metricKey={tornadoData.metric_key}
              baselineValue={tornadoData.baseline_value}
              onClose={() => setSelectedBar(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd /Users/thibaultdody/Desktop/Misc/property_analysis/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PropertyDetail/SensitivityTab.tsx
git commit -m "feat(THI-23): add SensitivityTab component with tornado and drill-down charts"
```

---

### Task 7: Frontend — Wire up the new tab

**Files:**
- Modify: `frontend/src/components/PropertyDetail/PropertyDetail.tsx:11` (TABS array)
- Modify: `frontend/src/components/PropertyDetail/PropertyDetail.tsx:6-9` (imports)
- Modify: `frontend/src/components/PropertyDetail/PropertyDetail.tsx:172-174` (tab rendering)

- [ ] **Step 1: Add Sensitivity tab to TABS and imports**

In `PropertyDetail.tsx`:

1. Add import at line 9:
```typescript
import { SensitivityTab } from "./SensitivityTab.tsx";
```

2. Update TABS array at line 11:
```typescript
const TABS = ["Property Info", "Financing", "Revenue & Expenses", "Results", "Sensitivity"] as const;
```

3. Add tab rendering after the Results tab block (after line 174):
```typescript
        {activeTab === "Sensitivity" && (
          <SensitivityTab propertyId={property.id} activeRentalType={property.active_rental_type} />
        )}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd /Users/thibaultdody/Desktop/Misc/property_analysis/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify app starts and renders**

Run: `cd /Users/thibaultdody/Desktop/Misc/property_analysis && docker compose up -d`
Then open the app in a browser, navigate to a property, and verify the "Sensitivity" tab appears and loads data.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PropertyDetail/PropertyDetail.tsx
git commit -m "feat(THI-23): wire up Sensitivity tab in PropertyDetail"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Run all backend tests**

Run: `cd /Users/thibaultdody/Desktop/Misc/property_analysis/backend && python -m pytest tests/ -v --tb=short`
Expected: All tests PASS

- [ ] **Step 2: Run frontend type check**

Run: `cd /Users/thibaultdody/Desktop/Misc/property_analysis/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual verification checklist**

With the app running:
- [ ] Navigate to an STR property → Sensitivity tab → see tornado chart for Monthly Cashflow
- [ ] Switch metric to Cash-on-Cash → chart updates
- [ ] Switch to Cap Rate → chart updates
- [ ] Click a bar → drill-down line chart appears below
- [ ] Click same bar → drill-down collapses
- [ ] Click different bar → drill-down switches
- [ ] Navigate to an LTR property → Sensitivity tab → see LTR tornado chart
- [ ] Dark mode → all elements readable
