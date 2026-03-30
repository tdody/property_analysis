# After-Tax Cashflow — Design Spec

## Overview

Add after-tax cashflow analysis using a single marginal tax rate and existing depreciation data. Shows how depreciation shelters rental income from taxes, including tax savings from "paper losses" when depreciation exceeds taxable income.

## New Assumption Field

One new field on `STRAssumptions` (model + schema):

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `marginal_tax_rate_pct` | `Numeric(6,2)` | 0 | 0-55 |

Default 0 means after-tax metrics only appear when the user explicitly sets a rate. Upper bound 55% covers highest combined federal (37%) + state (13.3% CA) rates.

## Computation

### Tax Analysis Function

New function in `backend/app/services/computation/metrics.py`:

```python
def compute_tax_analysis(
    noi: float,
    annual_mortgage_interest: float,
    total_depreciation_annual: float,
    marginal_tax_rate_pct: float,
    pre_tax_annual_cashflow: float,
) -> dict:
```

**Taxable income:**
```
taxable_income = NOI - annual_mortgage_interest - total_depreciation_annual
```

**Tax liability or savings:**
- Tax is always `taxable_income * (rate / 100)`, regardless of sign
- Positive = user owes tax; negative = tax savings from paper loss

**After-tax cashflow:**
```
after_tax_annual_cashflow = pre_tax_annual_cashflow - tax
after_tax_monthly_cashflow = after_tax_annual_cashflow / 12
```

When taxable income is negative, tax is negative, so after-tax cashflow exceeds pre-tax cashflow — reflecting the depreciation tax shield benefit.

Returns:
```python
{
    "taxable_income": float,
    "tax_liability": float,  # negative = savings
    "after_tax_annual_cashflow": float,
    "after_tax_monthly_cashflow": float,
}
```

### Annual Mortgage Interest

Computed from the amortization schedule (already built in `_compute_for_scenario`):
```python
annual_mortgage_interest = sum(entry["interest"] for entry in schedule[:12])
```

For cash purchases, the schedule is empty and `sum(...)` returns 0. No special guard needed.

### Interaction with Rental Delay

When rental delay is active, the router overrides `metrics["noi"]` and `metrics["annual_cashflow"]` with delay-adjusted values. The tax analysis must use these delay-adjusted values:
- `noi` = `metrics["noi"]` (already delay-adjusted after the delay block)
- `pre_tax_annual_cashflow` = `metrics["annual_cashflow"]` (already delay-adjusted)
- `annual_mortgage_interest` = full 12 months of interest (you pay interest during the delay period)

## Result Schema Changes

Add to `MetricsResults`:
- `taxable_income: float = 0`
- `tax_liability: float = 0` (negative = savings)
- `after_tax_annual_cashflow: float = 0`
- `after_tax_monthly_cashflow: float = 0`

When `marginal_tax_rate_pct` is 0, the computation still runs (producing `tax = 0` and `after_tax = pre_tax`), but the frontend hides the tax UI when all tax fields are 0. This avoids the ambiguity of using `None` vs `0`.

## Projections Changes

Add to `ProjectionYear` schema:
- `after_tax_cashflow: float = 0`

For each projection year N:
- Interest for year N = sum of interest from the function's internal amortization schedule, months `(N-1)*12` to `N*12 - 1` (0-indexed). The schedule is already computed inside `compute_five_year_projection` via `compute_amortization_schedule`. Guard: if schedule is empty (cash purchase), year interest = 0.
- Depreciation = `total_depreciation_annual` (constant across all 5 years). **Note:** furniture depreciates over 7 years, so this is valid for the 5-year horizon. If projections are ever extended past 7 years, furniture depreciation must be zeroed out.
- `taxable_income[N] = noi[N] - interest[N] - total_depreciation`
- `tax[N] = taxable_income[N] * (rate / 100)`
- `after_tax_cashflow[N] = annual_cashflow[N] - tax[N]`

When `marginal_tax_rate_pct` is 0, `after_tax_cashflow = annual_cashflow` for all years.

### Projections Function Signature Changes

Add parameters to `compute_five_year_projection`:
- `marginal_tax_rate_pct: float = 0`
- `total_depreciation_annual: float = 0`

## Router Changes

In `_compute_for_scenario`:
1. Compute `annual_mortgage_interest = sum(m["interest"] for m in schedule[:12])` — `schedule` already exists from the year-1 equity calculation
2. Get `total_depreciation_annual` from the raw `depreciation` dict (returned by `compute_depreciation`, not the `DepreciationInfo` schema)
3. Call `compute_tax_analysis` with `metrics["noi"]`, `metrics["annual_cashflow"]` (both already delay-adjusted if applicable), `annual_mortgage_interest`, `depreciation["total_depreciation_annual"]`, and `marginal_tax_rate_pct`
4. Populate `MetricsResults` with the tax analysis results

In `get_projections`:
- Pass `marginal_tax_rate_pct` and `total_depreciation_annual` to `compute_five_year_projection`

## Database Migration

Alembic migration adding:
- `str_assumptions.marginal_tax_rate_pct` (`Numeric(6,2)`, `server_default='0'`)

## Frontend

### Types (`frontend/src/types/index.ts`)

- Add `marginal_tax_rate_pct` to `STRAssumptions`
- Add `taxable_income`, `tax_liability`, `after_tax_annual_cashflow`, `after_tax_monthly_cashflow` to `ComputedResults.metrics`
- Add `after_tax_cashflow` to `ProjectionYear`

### RevenueExpensesTab

Add `PercentInput` for "Marginal Tax Rate %" in the Revenue section, near the appreciation and growth rate fields.

Tooltip: "Your combined marginal income tax rate (federal + state). Used to estimate after-tax cashflow. Common ranges: 22-37% federal + 0-13% state. Set to 0 to hide tax analysis."

### ResultsTab

**MetricCard:** When `tax_liability != 0`, show "After-Tax Cashflow" MetricCard after the existing Monthly Cashflow card. Green/red based on sign.

**Collapsible "Tax Analysis" section:** Shown when `tax_liability != 0`. Waterfall-style table:
- NOI
- Less: Mortgage Interest (Year 1)
- Less: Depreciation
- = Taxable Income
- Tax at X% (label says "Tax Savings" when negative)
- = After-Tax Annual Cashflow

**Projections table:** Add "After-Tax CF" column when `tax_liability != 0`.

## Tests

### Unit Tests (`backend/tests/test_metrics.py` — new class)

- `test_positive_taxable_income`: NOI $30K - interest $20K - depreciation $5K = $5K taxable, tax = $5K * 0.32 = $1,600
- `test_paper_loss_tax_savings`: NOI $20K - interest $20K - depreciation $15K = -$15K taxable, tax = -$4,800 (savings), after-tax > pre-tax
- `test_zero_tax_rate`: tax = 0, after_tax = pre_tax
- `test_cash_purchase_no_interest`: Only depreciation offsets NOI, interest = 0
- `test_after_tax_monthly_is_annual_div_12`: Verify monthly = annual / 12

### Validation Tests

- `marginal_tax_rate_pct` rejected if < 0 or > 55

### Projection Tests

- After-tax cashflow changes year over year as interest decreases
- Zero tax rate: after_tax_cashflow = annual_cashflow for all years
- Cash purchase: zero interest all 5 years, only depreciation offsets NOI
