# Seasonal Occupancy Modeling — Design Spec

## Overview

Add a two-season (peak/off-peak) occupancy model to the property analysis tool. When enabled via a toggle, it replaces the single `occupancy_pct` with peak and off-peak occupancy rates. A weighted effective occupancy feeds into the existing computation pipeline (annual totals unchanged), while a new monthly breakdown shows how revenue and cashflow vary by season.

## New Assumption Fields

Four new fields on `STRAssumptions` (model + schema):

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `use_seasonal_occupancy` | `Boolean` | false | — |
| `peak_months` | `Integer` | 6 | 1-11 |
| `peak_occupancy_pct` | `Numeric(6,2)` | 80.0 | 0-100 |
| `off_peak_occupancy_pct` | `Numeric(6,2)` | 45.0 | 0-100 |

When `use_seasonal_occupancy` is false, the existing `occupancy_pct` is used unchanged. When true, a weighted effective occupancy is computed and replaces `occupancy_pct` in all downstream calculations.

## Computation

### Weighted Effective Occupancy

New helper function in `backend/app/services/computation/revenue.py`:

```python
def compute_effective_occupancy(peak_months: int, peak_occupancy_pct: float, off_peak_occupancy_pct: float) -> float:
    return (peak_months * peak_occupancy_pct + (12 - peak_months) * off_peak_occupancy_pct) / 12
```

Used in the router to determine occupancy before passing to `compute_gross_revenue`. Also reused by the sensitivity and projections endpoints.

### Router Changes

**All places that read `assumptions.occupancy_pct` must be updated** to use the effective occupancy when `use_seasonal_occupancy` is true:

1. **`_compute_for_scenario`** — pass effective_occ to `compute_gross_revenue`
2. **`get_sensitivity`** — pass effective_occ as `base_occupancy_pct`
3. **`get_projections`** — pass effective_occ to `compute_gross_revenue` for steady-state revenue

The effective occupancy computation should be done once early in each function and reused.

### Fixed Opex Helper

Extract the fixed opex calculation from `_compute_for_scenario` into a shared helper to avoid duplication with the monthly endpoint:

```python
def _compute_fixed_opex(assumptions: STRAssumptions) -> float:
    return (
        float(assumptions.utilities_monthly) * 12
        + float(assumptions.supplies_monthly) * 12
        + float(assumptions.lawn_snow_monthly) * 12
        + float(assumptions.other_monthly_expense) * 12
        + float(assumptions.local_str_registration_fee)
    )
```

### Monthly Breakdown

New file: `backend/app/services/computation/monthly.py`

```python
def compute_monthly_breakdown(
    gross_annual_revenue: float,
    total_annual_opex: float,
    fixed_opex_annual: float,
    total_monthly_housing: float,
    peak_months: int,
    peak_occupancy_pct: float,
    off_peak_occupancy_pct: float,
    platform_fee_pct: float,
) -> list[dict]:
```

Returns 12 dicts, one per month.

**Revenue distribution:** Each month's share of gross revenue is proportional to its occupancy rate relative to the annual weighted total.

```
effective_occ = (peak_months * peak_occ + (12 - peak_months) * off_peak_occ) / 12
```

For a peak month:
```
monthly_gross = gross_annual / 12 * (peak_occupancy / effective_occupancy)
```

For an off-peak month:
```
monthly_gross = gross_annual / 12 * (off_peak_occupancy / effective_occupancy)
```

**Division-by-zero guard:** If effective occupancy is 0 (both peak and off-peak are 0%), all months return zero revenue, zero expenses, and negative cashflow equal to `-total_monthly_housing`.

**Net revenue per month:**
```
monthly_net = monthly_gross * (1 - platform_fee_pct / 100)
```

**Expense distribution:**
- Variable expenses = `total_annual_opex - fixed_opex_annual`. Each month gets a share proportional to its gross revenue relative to the annual total: `variable_monthly = variable_annual * (monthly_gross / gross_annual)`.
- Fixed expenses = `fixed_opex_annual / 12` per month.
- Housing costs = `total_monthly_housing` per month (same every month).

**Per-month output:**

| Field | Type | Description |
|-------|------|-------------|
| `month` | int | 1-12 |
| `is_peak` | bool | true for months 1 through peak_months |
| `gross_revenue` | float | That month's share of gross revenue |
| `total_expenses` | float | Variable (scaled) + fixed (1/12) |
| `noi` | float | monthly_net - total_expenses |
| `cashflow` | float | noi - total_monthly_housing |

Peak months are abstract (months 1-N are peak, rest are off-peak) — not mapped to calendar months.

This ensures:
- Sum of 12 months' gross_revenue = gross_annual_revenue (proven mathematically)
- Sum of 12 months' cashflow = annual_cashflow (by construction)

### Modeling Simplifications

1. **Peak months are abstract.** Not mapped to calendar months — month 1 through N are peak, rest are off-peak.
2. **Net revenue uses the same platform fee %.** Both seasons use the same fee rate.
3. **Housing costs are constant.** Same monthly amount regardless of season.
4. **Monthly breakdown is display-only.** Annual metrics use the weighted average, which produces the same totals.
5. **Variable expenses scale with gross revenue share.** Even though some expenses (e.g., property management) track net revenue, all variable expenses are distributed proportionally to gross revenue for simplicity.
6. **Cleaning costs are not separately modeled per season.** They are part of the variable expense pool distributed proportionally, rather than being recomputed from seasonal turnovers.

## API

New endpoint:

```
GET /api/properties/{property_id}/monthly/{scenario_id}
```

Response model: `MonthlyBreakdownResponse` containing `months: list[MonthlyDetail]` (12 entries) and `use_seasonal: bool`.

When `use_seasonal_occupancy` is false, returns evenly-split months (all months identical = annual / 12).

Reuses `_get_prop_scenario_assumptions` for 404 handling.

## Result Schema

New models in `backend/app/schemas/results.py`:

```python
class MonthlyDetail(BaseModel):
    month: int
    is_peak: bool
    gross_revenue: float
    total_expenses: float
    noi: float
    cashflow: float

class MonthlyBreakdownResponse(BaseModel):
    property_id: str
    scenario_id: str
    use_seasonal: bool
    months: list[MonthlyDetail]
```

## Database Migration

Alembic migration adding:
- `str_assumptions.use_seasonal_occupancy` (`Boolean`, `server_default='0'`)
- `str_assumptions.peak_months` (`Integer`, `server_default='6'`)
- `str_assumptions.peak_occupancy_pct` (`Numeric(6,2)`, `server_default='80.0'`)
- `str_assumptions.off_peak_occupancy_pct` (`Numeric(6,2)`, `server_default='45.0'`)

## Frontend

### Types (`frontend/src/types/index.ts`)

- Add `use_seasonal_occupancy`, `peak_months`, `peak_occupancy_pct`, `off_peak_occupancy_pct` to `STRAssumptions`
- Add `MonthlyDetail` interface

### RevenueExpensesTab

- "Use Seasonal Occupancy" toggle (checkbox) in Revenue section
- When enabled:
  - Hide single `occupancy_pct` input
  - Show: peak months (number input, 1-11), peak occupancy %, off-peak occupancy %
  - Display computed "Effective Occupancy: X%" as read-only text below the inputs
- When disabled: show existing `occupancy_pct` input as-is

### ResultsTab

Collapsible "Monthly Cashflow" section, shown only when `use_seasonal_occupancy` is true (checked via `use_seasonal` flag on the monthly response):

**Bar chart:** 12 vertical bars showing monthly cashflow. Green for positive, red for negative. Uses the existing SVG chart pattern adapted from `SensitivityChart`.

**Table below:** 12 rows with columns:
- Month (1-12)
- Season (Peak / Off-Peak)
- Gross Revenue
- Expenses
- NOI
- Cashflow (green/red)

Data fetched on demand when expanded (lazy-loaded via `getMonthlyBreakdown`).

### API Client

New function: `getMonthlyBreakdown(propertyId, scenarioId)` calling the monthly endpoint.

## Tests

### Unit Tests (`backend/tests/test_monthly.py`)

- `test_weighted_occupancy`: 6 peak @ 80% + 6 off-peak @ 45% = 62.5%
- `test_monthly_revenue_sums_to_annual`: Sum of 12 months' gross revenue = annual gross revenue
- `test_monthly_cashflow_sums_to_annual`: Sum of 12 months' cashflow = annual cashflow
- `test_peak_months_higher_revenue`: Peak month revenue > off-peak month revenue
- `test_equal_occupancy_even_split`: When peak == off-peak, all months are identical
- `test_one_peak_month`: Edge case with 1 peak month
- `test_eleven_peak_months`: Edge case with 11 peak months
- `test_zero_occupancy_both_seasons`: Both at 0% returns zero revenue, cashflow = -housing cost

### Validation Tests

- `peak_months` rejected if < 1 or > 11
- `peak_occupancy_pct` rejected if < 0 or > 100
- `off_peak_occupancy_pct` rejected if < 0 or > 100

### Router Integration Tests

- Seasonal mode on: verify effective occupancy is used in results
- Seasonal mode off: verify original `occupancy_pct` is used unchanged
