# Multi-Year Projections — Design Spec

## Overview

Add a fixed 5-year projection to the property analysis tool. Currently all metrics are Year-1 snapshots. This feature models how revenue, expenses, equity, and cashflow evolve over 5 years with configurable growth rates.

## New Assumption Fields

Two new fields on `STRAssumptions` (model + schema):

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `revenue_growth_pct` | `Numeric(6,2)` | 3.0 | 0-50 |
| `expense_growth_pct` | `Numeric(6,2)` | 3.0 | 0-50 |

These represent annual percentage increases applied via compounding.

## Computation

### Service

New file: `backend/app/services/computation/projections.py`

```python
def compute_five_year_projection(
    year1_gross_revenue: float,
    year1_net_revenue: float,
    year1_opex: float,
    year1_cashflow: float,
    steady_state_gross_revenue: float,
    steady_state_net_revenue: float,
    steady_state_opex: float,
    revenue_growth_pct: float,
    expense_growth_pct: float,
    total_monthly_housing: float,
    monthly_pi: float,
    purchase_price: float,
    appreciation_pct: float,  # maps from assumptions.property_appreciation_pct_annual
    loan_amount: float,
    interest_rate: float,
    loan_term_years: int,
    total_cash_invested: float,
    platform_fee_pct: float,
) -> list[dict]:
```

Returns a list of 5 dicts, one per year.

### Year-by-Year Logic

**Year 1:** Uses delay-adjusted values already computed by `_compute_for_scenario` (passed in as `year1_*` params). This ensures consistency with the existing results display.

**Years 2-5:** Growth compounds from the **steady-state base** (full 12-month, no delay), not from Year 1's reduced values. This avoids a misleading jump between Year 1 and Year 2.

- `gross_revenue[N] = steady_state_gross * (1 + revenue_growth_pct/100) ^ (N-1)` for N >= 2
- `net_revenue[N] = gross_revenue[N] * (1 - platform_fee_pct/100)`
- `total_opex[N] = steady_state_opex * (1 + expense_growth_pct/100) ^ (N-1)` for N >= 2
- `noi[N] = net_revenue[N] - total_opex[N]`
- `annual_housing_cost = total_monthly_housing * 12` (fixed, all years)
- `annual_cashflow[N] = noi[N] - annual_housing_cost`
- `cumulative_cashflow[N] = sum(cashflow[1..N])`
- `property_value[N] = purchase_price * (1 + appreciation_pct/100) ^ N`
- `loan_balance[N]` = remaining balance from amortization schedule at month `N * 12`
- `equity[N] = property_value[N] - loan_balance[N]`
- `cash_on_cash_return[N] = annual_cashflow[N] / total_cash_invested * 100` (returns 0 if total_cash_invested is 0)

### Modeling Simplifications

These are intentional trade-offs for usability:

1. **Expenses grow as a single block.** All operating expenses are grown by `expense_growth_pct` uniformly. Variable expenses (cleaning, management fees, reserves) are not re-derived from grown revenue. This is simpler and sufficient for 5-year estimates.
2. **Net revenue uses a flat platform fee.** `net_revenue = gross * (1 - fee%)`. Cleaning fee revenue is implicitly grown at the same rate as nightly revenue.
3. **Housing costs are held constant.** Property taxes, insurance, HOA, and PMI do not inflate across the projection. These are set separately and could be grown in a future iteration.

### Per-Year Output Schema

Each year dict contains:

| Field | Type | Description |
|-------|------|-------------|
| `year` | int | 1-5 |
| `gross_revenue` | float | Gross annual revenue for that year |
| `net_revenue` | float | After platform fees |
| `total_opex` | float | Total operating expenses |
| `noi` | float | Net operating income |
| `annual_housing_cost` | float | Total monthly housing * 12 (taxes, insurance, PI, PMI, HOA) |
| `annual_cashflow` | float | NOI - annual housing cost |
| `cumulative_cashflow` | float | Running sum of cashflow through this year |
| `property_value` | float | Appreciated property value |
| `loan_balance` | float | Remaining mortgage balance |
| `equity` | float | Property value - loan balance |
| `cash_on_cash_return` | float | Annual cashflow / total cash invested * 100 |

## API

New endpoint:

```
GET /api/properties/{property_id}/projections/{scenario_id}
```

Response model: `ProjectionResponse` containing `years: list[ProjectionYear]` (5 entries).

Separate from `ComputedResultsResponse` to keep the main results endpoint fast and projections optional. Reuses `_get_prop_scenario_assumptions` for 404 handling.

## Result Schema

New models in `backend/app/schemas/results.py`:

```python
class ProjectionYear(BaseModel):
    year: int
    gross_revenue: float
    net_revenue: float
    total_opex: float
    noi: float
    annual_housing_cost: float
    annual_cashflow: float
    cumulative_cashflow: float
    property_value: float
    loan_balance: float
    equity: float
    cash_on_cash_return: float

class ProjectionResponse(BaseModel):
    property_id: str
    scenario_id: str
    years: list[ProjectionYear]
```

## Database Migration

Alembic migration adding:
- `str_assumptions.revenue_growth_pct` (`Numeric(6,2)`, `server_default='3.0'`)
- `str_assumptions.expense_growth_pct` (`Numeric(6,2)`, `server_default='3.0'`)

## Frontend

### Types (`frontend/src/types/index.ts`)

- Add `revenue_growth_pct` and `expense_growth_pct` to `STRAssumptions`
- Add `ProjectionYear` interface and update API client

### RevenueExpensesTab

Two new `PercentInput` fields in the Revenue section:
- "Revenue Growth % / yr"
- "Expense Growth % / yr"

### ResultsTab

Collapsible "5-Year Projections" section, following the same pattern as the existing amortization table:
- Toggle button with arrow indicator
- Table with one row per year, columns for each metric
- Horizontal scroll on smaller screens (11 columns)
- Positive cashflow values in green, negative in red
- Placed after the sensitivity analysis section, before the amortization table
- Data fetched on demand when the user expands the section (lazy-loaded via `getProjections`)

### API Client

New function: `getProjections(propertyId, scenarioId)` calling the projections endpoint.

## Tests

### Unit Tests (`backend/tests/test_projections.py`)

- `test_year1_matches_inputs`: Year 1 output matches the delay-adjusted values passed in
- `test_growth_compounds_from_steady_state`: Year 2 revenue = steady_state * (1 + rate), not year1 * (1 + rate)
- `test_cumulative_cashflow_sums`: Cumulative cashflow at Year N = sum of Years 1..N
- `test_zero_growth_flat`: With 0% growth, Years 2-5 revenue/expenses equal steady-state base
- `test_equity_equals_value_minus_balance`: Equity = property_value - loan_balance for each year
- `test_property_value_appreciates`: Each year's property value > previous year (with positive appreciation)
- `test_loan_balance_decreases`: Each year's loan balance < previous year
- `test_cash_purchase_zero_debt`: With no loan, debt service = 0 and loan balance = 0
- `test_negative_cashflow_cumulates`: Cumulative cashflow goes more negative when annual cashflow is negative
- `test_zero_cash_invested_coc_zero`: Cash-on-cash returns 0 when total_cash_invested is 0

### Validation Tests

- `revenue_growth_pct` rejected if < 0 or > 50
- `expense_growth_pct` rejected if < 0 or > 50
