# Long-Term Rental (LTR) Support Design

## Problem

The property analysis tool currently only supports short-term rental (STR) scenarios. Users need to evaluate properties as long-term rentals (yearly leases) and compare STR vs LTR strategies side-by-side to make informed investment decisions.

## Design Decisions

- **Separate LTR model** parallel to `STRAssumptions` (not a unified table with nullable fields)
- Each property gets **both** STR and LTR assumptions; an `active_rental_type` toggle controls dashboard metrics
- LTR uses **simplified expenses** — no platform fees, cleaning turnovers, or lodging taxes
- Results support **toggle + compare** — active type for dashboard, side-by-side for detailed analysis
- LTR sensitivity sweeps **rent ±30%** and **vacancy 0-25%**

---

## Data Model

### New: `LTRAssumptions` Table

One-to-one with `Property` (same pattern as `STRAssumptions`).

#### Revenue Fields
| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `monthly_rent` | Float | 1500 | >= 0 | Monthly rent amount |
| `lease_duration_months` | Int | 12 | 1-36 | Lease term in months |
| `pet_rent_monthly` | Float | 0 | >= 0 | Additional pet rent |
| `late_fee_monthly` | Float | 0 | >= 0 | Average monthly late fee income |
| `vacancy_rate_pct` | Float | 5.0 | 0-50 | Ongoing vacancy factor % (mid-lease vacancy/non-renewal, separate from lease-up) |
| `lease_up_period_months` | Int | 1 | 0-12 | Months to find first tenant (Year 1 only) |

#### Expense Fields
| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `property_mgmt_pct` | Float | 8.0 | 0-100 | % of effective revenue (collected rent) |
| `insurance_annual` | Float | 2500 | >= 0 | Annual insurance premium |
| `maintenance_reserve_pct` | Float | 5.0 | 0-100 | % of gross revenue |
| `capex_reserve_pct` | Float | 5.0 | 0-100 | % of gross revenue |
| `landlord_repairs_annual` | Float | 0 | >= 0 | Annual repair budget |
| `tenant_turnover_cost` | Float | 1500 | >= 0 | Make-ready cost between tenants |
| `utilities_monthly` | Float | 0 | >= 0 | Landlord-paid utilities |
| `lawn_snow_monthly` | Float | 0 | >= 0 | Landscaping/snow removal |
| `other_monthly_expense` | Float | 0 | >= 0 | Miscellaneous |
| `accounting_annual` | Float | 0 | >= 0 | Accounting costs |
| `legal_annual` | Float | 0 | >= 0 | Legal costs |

#### Shared Fields (same semantics as STR)
| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `land_value_pct` | Float | 20.0 | 0-100 | For depreciation calculation |
| `property_appreciation_pct_annual` | Float | 2.5 | 0-50 | Annual appreciation |
| `revenue_growth_pct` | Float | 3.0 | 0-50 | Annual rent increase at renewal (maps to STR's revenue_growth_pct for projections) |
| `expense_growth_pct` | Float | 3.0 | 0-50 | Annual expense growth |
| `marginal_tax_rate_pct` | Float | 0 | 0-55 | Marginal tax rate |

> **Note:** `revenue_growth_pct` serves as the rent increase rate for LTR. No separate `annual_rent_increase_pct` field — this keeps projections consistent with how STR handles revenue growth via `compute_five_year_projection()`.

### Modified: `Property` Table

Add column: `active_rental_type` — Python `Literal["str", "ltr"]`, DB `VARCHAR DEFAULT 'str'`.

Use a `RentalType` string enum in Python for type safety:
```python
class RentalType(str, Enum):
    STR = "str"
    LTR = "ltr"
```

---

## Computation Logic

### Orchestration Strategy

Create a new `compute_for_scenario_ltr()` function in `backend/app/services/analysis.py`, parallel to `compute_for_scenario()`. This matches the "separate model" philosophy and avoids invasive refactoring of the existing STR pipeline.

The results endpoint checks `property.active_rental_type` and calls the appropriate function. The comparison endpoint can call both to produce side-by-side metrics.

### LTR Revenue (`computation/ltr_revenue.py`)

```
gross_annual_revenue = (monthly_rent + pet_rent_monthly + late_fee_monthly) × 12
effective_annual_revenue = gross_annual_revenue × (1 - vacancy_rate_pct / 100)

Year 1 adjustment (lease-up is SEPARATE from vacancy):
  year1_occupied_months = 12 - lease_up_period_months
  year1_gross = (monthly_rent + pet_rent_monthly + late_fee_monthly) × year1_occupied_months
  year1_effective = year1_gross × (1 - vacancy_rate_pct / 100)
```

> **Semantics:** `vacancy_rate_pct` models ongoing vacancy (non-renewal gaps, non-payment). `lease_up_period_months` models the one-time initial delay finding the first tenant. They do not overlap — lease-up reduces the number of rent-collecting months, vacancy discounts the revenue during those months.

### LTR Expenses (`computation/ltr_expenses.py`)

```
property_mgmt_cost = effective_annual_revenue × (property_mgmt_pct / 100)
maintenance_reserve = gross_annual_revenue × (maintenance_reserve_pct / 100)
capex_reserve = gross_annual_revenue × (capex_reserve_pct / 100)
turnover_amortized = tenant_turnover_cost × (12 / lease_duration_months)
fixed_expenses = (utilities_monthly + lawn_snow_monthly + other_monthly_expense) × 12
                 + insurance_annual + landlord_repairs_annual
                 + accounting_annual + legal_annual

total_annual_opex = property_mgmt_cost + maintenance_reserve + capex_reserve
                    + turnover_amortized + fixed_expenses
```

> **Year 1 note:** Turnover amortization still applies in Year 1 (accounts for eventual turnover). Variable expenses (property mgmt, reserves) scale with year1 revenue during lease-up adjusted months.

### LTR Monthly Breakdown

For **steady state** (Year 2+): flat monthly distribution.
For **Year 1**: months 1 through `lease_up_period_months` show zero revenue; remaining months show full rent. Fixed expenses apply every month.

```
For month m in 1..12:
  if m <= lease_up_period_months:
    monthly_revenue = 0
  else:
    monthly_revenue = (monthly_rent + pet_rent_monthly + late_fee_monthly) × (1 - vacancy_rate_pct / 100)
  monthly_opex = total_annual_opex / 12  (spread evenly)
  monthly_noi = monthly_revenue - monthly_opex
  monthly_cashflow = monthly_noi - total_monthly_housing
```

### LTR Sensitivity Analysis

Two sweeps:
1. **Rent sweep:** monthly_rent ±30% in 5% increments → recompute cashflow
2. **Vacancy sweep:** 0% to 25% in 1% increments → recompute cashflow

### Metrics

Reuse existing metric functions — they operate on `noi`, `cashflow`, `gross_revenue`, etc. which are computed differently for LTR but fed into the same formulas:
- `compute_noi()`, `compute_cashflow()`, `compute_cash_on_cash_return()` — unchanged
- `compute_cap_rate()`, `compute_dscr()`, `compute_gross_yield()` — unchanged
- `compute_depreciation()`, `compute_tax_analysis()` — unchanged
- `compute_five_year_projection()` — same structure, uses `revenue_growth_pct` for annual rent increases

**New: `compute_break_even_vacancy()`**

Replaces `compute_break_even_occupancy()` for LTR:
```
total_annual_costs = total_annual_opex_fixed + annual_housing_cost
  (where opex_fixed = all expenses except property mgmt and reserves that scale with revenue)
break_even_vacancy_pct = (1 - total_annual_costs / gross_annual_revenue) × 100
```
Interpretation: "If vacancy exceeds X%, cash flow goes negative."

---

## LTR Results Schema

### `LTRComputedResults` fields (delta from STR `ComputedResults`)

**Kept (same semantics):**
- `metrics.monthly_cashflow`, `metrics.annual_cashflow`
- `metrics.cash_on_cash_return`, `metrics.cap_rate`, `metrics.noi`, `metrics.dscr`, `metrics.gross_yield`
- `metrics.total_roi_year1`
- `investment.*` (total_cash_invested, down_payment, closing_costs, etc.)
- `housing.*` (monthly_pi, monthly_tax, etc.)
- `depreciation.*`, `tax_impact.taxable_income`, `tax_impact.tax_liability`, `tax_impact.after_tax_annual_cashflow`
- `five_year_projection[]`, `monthly_breakdown[]`

**Removed (STR-specific):**
- `revenue.occupied_nights`, `revenue.annual_turnovers`, `revenue.cleaning_revenue`, `revenue.platform_fees`
- `metrics.break_even_occupancy`
- `tax_impact.effective_nightly_rate_with_tax`, `tax_impact.state_rooms_tax`, `tax_impact.str_surcharge`, `tax_impact.local_option_tax`

**Added (LTR-specific):**
- `revenue.monthly_rent`, `revenue.pet_rent_monthly`, `revenue.late_fee_monthly`
- `revenue.gross_annual_revenue`, `revenue.vacancy_loss`, `revenue.effective_annual_revenue`
- `metrics.break_even_vacancy_pct`
- `expenses.property_mgmt_cost`, `expenses.turnover_amortized`, `expenses.landlord_repairs`
- `expenses.total_annual_opex` (with LTR breakdown)

---

## API Changes

### New Endpoints
- `GET /properties/{id}/ltr-assumptions` — returns LTR assumptions (auto-created with defaults if missing)
- `PATCH /properties/{id}/ltr-assumptions` — update LTR assumptions
- `GET /properties/{id}/ltr-results` — computed LTR results for active scenario

### Modified Endpoints
- `PATCH /properties/{id}` — accepts `active_rental_type` field; toggling triggers cache recomputation
- `GET /properties/{id}/results` — returns results for the active rental type
- `GET /properties/{id}/sensitivity` — returns sweeps appropriate to active rental type
- `GET /properties/` (list) — cached metrics reflect active rental type

### New Schemas
- `LTRAssumptionsUpdate` — Pydantic schema with validation rules per table above
- `LTRAssumptionsResponse` — Pydantic response schema
- `LTRComputedResults` — Results schema (see LTR Results Schema section)

---

## Frontend Changes

### Revenue/Expenses Tab
- Add rental type toggle (STR | LTR) at the top of the tab
- When LTR is selected, show LTR-specific form fields:
  - **Revenue section:** Monthly rent, pet rent, late fees, lease duration, vacancy rate, lease-up period
  - **Expenses section:** Property mgmt %, insurance, maintenance/capex reserves, landlord repairs, turnover cost, utilities, lawn/snow, other, accounting, legal
  - **Growth/Tax section:** Revenue growth (rent increase), expense growth, appreciation, land value %, marginal tax rate
- When STR is selected, show current STR form (unchanged)

### Results Tab
- Show results for active rental type by default
- Add "Compare STR vs LTR" section showing key metrics side-by-side:
  - Monthly cashflow, annual cashflow, cash-on-cash return, cap rate, NOI, DSCR

### Sensitivity Tab
- Adapt sweep parameters based on active rental type
- STR: occupancy + nightly rate sweeps (unchanged)
- LTR: vacancy + monthly rent sweeps

### Dashboard / Property Cards
- Show metrics for active rental type
- Small badge indicating "STR" or "LTR" on the card
- Toggling `active_rental_type` triggers recomputation of cached metrics

### TypeScript Types
- Add `LTRAssumptions` interface
- Add `active_rental_type: 'str' | 'ltr'` to `Property` interface
- Add `LTRComputedResults` interface

---

## Database Migration

Single Alembic migration:
1. Create `ltr_assumptions` table with FK to `properties` (with `ON DELETE CASCADE`)
2. Add `active_rental_type` column to `properties` (default `'str'`)
3. Auto-create default LTR assumptions for all existing properties using raw SQL `INSERT` (not ORM, since Alembic migrations should not depend on application models)

---

## Limitations & Future Work

- **Multi-unit properties:** Currently assumes a single rent amount. For duplexes/triplexes, users must manually sum rents into `monthly_rent`. A `units` multiplier could be added later.
- **Hybrid STR/LTR:** No support for properties that do both (e.g., STR in summer, LTR in winter). Could be a future rental type.
