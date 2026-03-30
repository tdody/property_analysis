# STR Profitability Calculator — Financial Accuracy Review

## Executive Summary

The calculator's core math (mortgage amortization, revenue, expenses, key metrics) is **correct**. However, several critical gaps affect real-world accuracy. This review consolidates findings from a code audit, data model review, and industry benchmarking against professional STR tools.

**Bottom line:** The tool is good for quick screening. To support actual investment decisions, it needs: a rental delay period, seasonal modeling, depreciation, and better Vermont tax handling.

---

## 1. What's Correct

| Area | Status | Notes |
|------|--------|-------|
| Mortgage amortization formula | Correct | Standard formula, tested against known values |
| PMI calculation | Correct | 0.5% annually for conventional < 20% down |
| Non-homestead tax override | Correct | Uses `nonhomestead_annual_taxes` when provided |
| Revenue (occupied nights, turnovers) | Correct | `365 * occupancy_pct / 100` |
| Platform fee deduction | Correct | Applied to total gross revenue |
| Operating expenses (9 categories) | Correct | Cleaning, mgmt, reserves, utilities, supplies, lawn, other, registration |
| NOI, cashflow, CoC, cap rate, DSCR, gross yield | Correct | Standard real estate formulas |
| Amortization schedule | Correct | Full month-by-month, final balance = $0 |
| Year-1 equity buildup | Correct | Sum of first 12 months principal payments |
| Break-even occupancy | Mostly correct | Algebraic solution; minor inconsistency (see below) |

---

## 2. Bugs & Inconsistencies to Fix

### 2.1 Vermont Occupancy Taxes: Fields Exist But Are Never Used

**Severity: Medium** (taxes are pass-through when platform remits, but should be displayed)

The `STRAssumptions` model has fields for `state_rooms_tax_pct` (9%), `str_surcharge_pct` (3%), `local_option_tax_pct` (1%), and `platform_remits_tax`. These are stored in the database but **never read by any computation module**.

When `platform_remits_tax` is True (Airbnb/VRBO), these taxes don't reduce operator revenue — but they DO affect the guest-facing price (~12-13% added). This should at least be displayed so the investor understands competitive pricing impact.

### 2.2 `vacancy_reserve_pct`: Stored But Never Used

The field exists in the model with a default of 0%. It's never referenced in any calculation. Either implement it as an additional buffer beyond occupancy, or remove it from the model to avoid confusion.

### 2.3 Break-Even Occupancy: Minor Inconsistency

In `metrics.py`, maintenance and capex reserves are calculated as a percentage of GROSS revenue per unit of occupancy, while management fees use NET revenue. This is consistent with `expenses.py` but creates a mixed denominator in the break-even formula. Impact is small (~0.5-1% of break-even occupancy) but worth noting.

### 2.4 No Input Validation

Pydantic schemas accept any numeric value. Users can enter occupancy > 100%, negative interest rates, or negative expenses. These propagate silently through calculations.

---

## 3. Critical Missing Features

### 3.1 Rental Delay / Ramp-Up Period *(user-requested)*

**Impact: Year-1 cashflow overstated by 20-50%**

New STR properties don't generate revenue from day one. There are two components:

1. **Pre-rental delay** (renovation + setup): Typically 1-6 months between purchase and first guest. During this period, the investor pays mortgage, taxes, insurance, and utilities with zero revenue.

2. **Occupancy ramp-up**: New listings reach target occupancy over 3-12 months. Airbnb gives a "New Listing Boost" in month 1, but reviews and search ranking take time.

**Recommended fields:**
- `rental_delay_months` (integer, default 1) — months between acquisition and first rental income. All carrying costs during this period are treated as startup costs.
- This single field captures renovation delays, furnishing time, permit processing, and initial setup.

**Computation impact:**
- Year-1 revenue = `(12 - rental_delay_months) / 12 * annual_revenue_at_target_occupancy`
- Year-1 fixed costs = full 12 months (mortgage, taxes, insurance, HOA continue during delay)
- Add carrying costs during delay to `total_cash_invested` for accurate CoC calculation

### 3.2 Property Appreciation & Multi-Year Projections

**Impact: Cannot compare hold periods or evaluate long-term returns**

Currently only Year 1 is modeled. Real investors need:

- `property_appreciation_pct_annual` (default 2.5%)
- 5-year projected property value, equity, and cumulative cashflow
- Year-1 Total ROI should optionally include appreciation: `(cashflow + equity_buildup + appreciation) / cash_invested`

### 3.3 Depreciation

**Impact: Tax-advantaged returns not modeled**

STR properties can depreciate the building over 27.5 years and furniture/fixtures over 5-7 years. For a $400K property (80% building value = $320K), that's ~$11,600/year in depreciation deductions — significant for tax planning.

**Recommended fields (on MortgageScenario or STRAssumptions):**
- `land_value_pct` (default 20%) — portion of purchase price that is land (non-depreciable)
- Building depreciation is auto-calculated: `(purchase_price * (1 - land_value_pct)) / 27.5`
- Furniture depreciation: `furniture_cost / 7`

### 3.4 Burlington Gross Receipts Tax

**Impact: Burlington properties dramatically mispriced**

Burlington, VT levies an additional **9% gross receipts tax on STR revenue**. Unlike the state rooms tax (which is pass-through to guests), this is an **operator expense** — it directly reduces cashflow.

**Recommended:** Add a `local_gross_receipts_tax_pct` field (default 0%) to STRAssumptions. For Burlington, this would be 9%.

---

## 4. Important Missing Fields

### 4.1 Additional Expense Categories

| Missing Expense | Typical Cost | Priority |
|----------------|-------------|----------|
| Guest damage reserve | 2-3% of gross revenue | High |
| Marketing / photography | $200-$500/year + 2-5% of revenue | Medium |
| Accounting / tax prep | $1,000-$3,000/year | Medium |
| Software subscriptions (PMS, dynamic pricing) | $20-$50/month | Medium |
| Legal / compliance | $500-$1,500/year | Low |

The `other_monthly_expense` catch-all exists but these should be called out explicitly since they're easy to forget and material.

### 4.2 Financing Nuances Not Modeled

| Missing | Impact | Priority |
|---------|--------|----------|
| Loan origination points (1-2% for DSCR) | Understates upfront costs | High |
| Prepayment penalties (DSCR: 3-2-1 structure) | Affects exit strategy | Medium |
| Interest-only period (DSCR: 1-5 years) | Changes early cashflow | Medium |
| ARM rate adjustments | DSCR often uses ARM | Low |

### 4.3 DSCR Loan Validation

The calculator computes DSCR but doesn't validate it against lender requirements. If `loan_type == "dscr"` and computed `dscr < 1.25`, the results should flag: "Below typical lender threshold (1.25x)."

---

## 5. Modeling Improvements

### 5.1 Utilities Should Scale with Occupancy

Currently `utilities_monthly` is flat. In reality, utilities are ~50% fixed (internet, base heating) and ~50% variable (guest usage — water, laundry, extra heating/cooling).

**Option A** (simple): Keep single field but add tooltip guidance noting STR utilities run 20-40% higher than typical homes.

**Option B** (better): Split into `utilities_base_monthly` + `utilities_per_occupied_night`.

### 5.2 Maintenance/CapEx Reserves vs. Property Age

The default 5%+5% reserves are fine for newer properties but insufficient for older ones. Consider:
- Properties built before 1990: suggest 7%+7%
- Properties built before 1970: suggest 10%+10%
- Add a tooltip: "Use the higher of 5% of revenue or 1% of property value per year"

### 5.3 Occupancy/Rate Elasticity Warning

High occupancy (65%+) combined with high nightly rates ($300+) may be unrealistic. The tool should display a soft warning if both are set high: "High occupancy at this nightly rate may be optimistic. Consider checking AirDNA market data."

### 5.4 Cleaning Fee Impact on Competitiveness

Cleaning fees are modeled as revenue, but high cleaning fees reduce bookings. A $150 fee on a $200/night rate is a 75% add-on for one-night stays. Consider displaying "total guest cost per night" including cleaning fee amortized by stay length.

---

## 6. Seasonality (Future Enhancement)

The single `occupancy_pct` is the biggest simplification. Vermont properties have dramatic seasonality:

| Season | Ski Areas (Stowe, Killington) | Lake/Urban (Burlington) |
|--------|------------------------------|------------------------|
| Winter (Dec-Feb) | 70-85% | 30-40% |
| Spring (Mar-May) | 20-30% | 35-45% |
| Summer (Jun-Aug) | 50-65% | 65-80% |
| Fall (Sep-Nov) | 55-70% | 50-65% |

Impact: Using 65% annual average masks that an investor may have 3+ months of negative cashflow in shoulder seasons. This matters for cash reserve planning.

**Minimum viable approach:** Add optional `peak_occupancy_pct` and `off_peak_occupancy_pct` with a `peak_months` count. Model revenue as weighted average.

---

## 7. Recommended Priority for Implementation

### Tier 1: Fix Now (affects investment decisions)
1. **Add `rental_delay_months` field** — single biggest accuracy improvement for Year-1 projections
2. **Wire up Vermont occupancy tax display** — show guest-facing price impact
3. **Add `local_gross_receipts_tax_pct`** — critical for Burlington properties
4. **Add input validation** — prevent impossible values (occupancy > 100%, negative rates)
5. **Add DSCR threshold warning** — flag when below 1.25x

### Tier 2: Add Soon (improves accuracy significantly)
6. **Add depreciation calculation** — `(purchase_price * 0.8) / 27.5` + `furniture_cost / 7`
7. **Add `property_appreciation_pct_annual`** — include in Year-1 ROI optionally
8. **Add guest damage reserve** — new field, default 2% of gross revenue
9. **Separate loan origination points from closing costs** for DSCR loans

### Tier 3: Nice to Have (professional-grade features)
10. Multi-year projections (5-year cashflow, equity, cumulative returns)
11. Seasonal occupancy modeling (peak/off-peak split)
12. After-tax cashflow with depreciation deductions
13. IRR and equity multiple calculations
14. Prepayment penalty and interest-only period modeling

---

## Sources

- Code review: `backend/app/services/computation/` (mortgage.py, revenue.py, expenses.py, metrics.py, sensitivity.py)
- Data models: `backend/app/models/` (property.py, scenario.py, assumptions.py)
- Spec: `str-profitability-spec.md` sections 4.1-4.7
- Industry benchmarks: AirDNA, Mashvisor, BiggerPockets, Adventures in CRE, AvantStay, Key Data Dashboard
- Vermont tax: VT Dept of Taxes, Act 183 (2024), Burlington gross receipts tax ordinance
