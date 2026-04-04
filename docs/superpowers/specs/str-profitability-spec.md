# STR Profitability Calculator — Technical Specification

## 1. Overview

A personal-use web application for evaluating the profitability of short-term rental (Airbnb/VRBO) property investments. The tool allows a user to fetch property details from a listing URL, configure one or more mortgage scenarios, estimate STR revenue and expenses, and compare multiple properties side-by-side.

**Tech stack:** FastAPI (Python) + React (TypeScript) + SQLite, deployed locally via Docker.

---

## 2. Architecture

```
┌─────────────────────────────────────┐
│           React Frontend            │
│  (Vite + TypeScript + Tailwind)     │
├─────────────────────────────────────┤
│           FastAPI Backend           │
│  ┌───────────┐  ┌────────────────┐  │
│  │  Scraper  │  │  Computation   │  │
│  │  Service  │  │    Engine      │  │
│  └───────────┘  └────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │     SQLite (via SQLAlchemy)   │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│         Docker Compose              │
│   (frontend + backend containers)   │
└─────────────────────────────────────┘
```

### Key design decisions

- **SQLite** — more than sufficient for single-user local use; no DB server to manage.
- **SQLAlchemy** — ORM with Alembic for migrations, keeps the door open for Postgres later if needed.
- **Computation engine** — all financial math lives in a pure-Python module with no side effects, making it independently testable.
- **Scraper service** — isolated module with a clean interface; if scraping breaks (it will), the fallback to manual entry is seamless.

---

## 3. Data Model

### 3.1 `Property`

The core entity. Stores fetched + manually-entered property details.

| Field               | Type          | Notes                                      |
|---------------------|---------------|--------------------------------------------|
| `id`                | UUID (PK)     |                                            |
| `created_at`        | datetime      |                                            |
| `updated_at`        | datetime      |                                            |
| `name`              | str           | User-defined label (e.g., "Lake house")    |
| `source_url`        | str, nullable | Zillow/Redfin URL if fetched               |
| `address`           | str           |                                            |
| `city`              | str           |                                            |
| `state`             | str (2-char)  |                                            |
| `zip_code`          | str           |                                            |
| `listing_price`     | Decimal       | Asking price from listing                  |
| `estimated_value`   | Decimal, nullable | Zestimate / Redfin estimate if available |
| `beds`              | int           |                                            |
| `baths`             | float         | Supports half-baths (e.g., 2.5)           |
| `sqft`              | int           |                                            |
| `lot_sqft`          | int, nullable |                                            |
| `year_built`        | int, nullable |                                            |
| `property_type`     | str           | single_family, condo, townhouse, multi_family |
| `hoa_monthly`       | Decimal       | Default 0                                  |
| `annual_taxes`      | Decimal       | From listing (may be homestead rate)       |
| `tax_rate`          | Decimal, nullable | Percentage, derived or manual           |
| `is_homestead_tax`  | bool          | Default True — listing taxes are usually homestead |
| `nonhomestead_annual_taxes` | Decimal, nullable | Manually entered or estimated; see §4.6 |
| `notes`             | text          | Free-form user notes                       |
| `is_archived`       | bool          | Soft-delete for comparison history         |

> **Non-homestead tax note:** In Vermont, property taxes have two components: municipal and education. The education portion has separate homestead and nonhomestead rates. STR investment properties are classified as nonhomestead, which carries a higher education tax rate. Listing sites (Zillow, Redfin) typically show the current owner's tax bill, which is almost always at the homestead rate. The app must flag this and allow the user to enter the actual nonhomestead tax amount, or estimate it using the nonhomestead rate for the town (see §4.6).

### 3.2 `MortgageScenario`

Multiple scenarios per property. Each scenario represents one financing configuration.

| Field                  | Type          | Notes                                      |
|------------------------|---------------|--------------------------------------------|
| `id`                   | UUID (PK)     |                                            |
| `property_id`          | UUID (FK)     |                                            |
| `name`                 | str           | e.g., "30yr conventional", "DSCR 25yr"    |
| `loan_type`            | str           | See §3.2.1                                 |
| `purchase_price`       | Decimal       | May differ from listing price (offer price)|
| `down_payment_pct`     | Decimal       | Percentage (e.g., 25.0)                    |
| `down_payment_amt`     | Decimal       | Computed or overridden                     |
| `interest_rate`        | Decimal       | Annual rate, e.g., 7.25                    |
| `loan_term_years`      | int           | 15, 20, 25, 30                             |
| `closing_cost_pct`     | Decimal       | Default 3.0%                               |
| `closing_cost_amt`     | Decimal       | Computed or overridden                     |
| `renovation_cost`      | Decimal       | One-time upfront cost                      |
| `furniture_cost`       | Decimal       | One-time STR setup cost                    |
| `other_upfront_costs`  | Decimal       | Inspection, appraisal, etc.                |
| `pmi_monthly`          | Decimal       | Only if down payment < 20% (conventional)  |
| `is_active`            | bool          | Which scenario is "selected" for cashflow  |

#### 3.2.1 Loan types

| Loan Type       | Key Characteristics                                                                 |
|-----------------|------------------------------------------------------------------------------------|
| **Conventional** | Standard Fannie/Freddie. Typically 15/20/30yr. PMI if < 20% down. Best rates.     |
| **DSCR**         | Debt Service Coverage Ratio loan. Qualification based on property income, not personal income. Common for STR investors. Typically higher rates (+1-2%), often 20-25% down minimum, may have prepayment penalties. |
| **FHA**          | 3.5% down minimum, MIP required. Technically requires owner-occupancy but relevant for house-hacking scenarios. |
| **Cash**         | No financing. Total cash invested = purchase + closing + renovation + furniture.   |

> **Recommendation:** Model Conventional and DSCR as the primary types. FHA is a nice-to-have. Cash is trivial (just eliminates the mortgage payment line).

### 3.3 `STRAssumptions`

One set of revenue/expense assumptions per property. Linked 1:1.

| Field                     | Type          | Notes                                        |
|---------------------------|---------------|----------------------------------------------|
| `id`                      | UUID (PK)     |                                              |
| `property_id`             | UUID (FK)     | One-to-one                                   |
| **Revenue**               |               |                                              |
| `avg_nightly_rate`        | Decimal       | User input                                   |
| `occupancy_pct`           | Decimal       | Annual average, e.g., 65.0                   |
| `cleaning_fee_per_stay`   | Decimal       | Passed through to guest; net-zero or profit   |
| `avg_stay_length_nights`  | Decimal       | Used to compute turnover frequency            |
| **Operating Expenses**    |               |                                              |
| `platform_fee_pct`        | Decimal       | Airbnb host fee, default 3.0                  |
| `cleaning_cost_per_turn`  | Decimal       | What you pay the cleaner per turnover         |
| `property_mgmt_pct`       | Decimal       | 0 if self-managed; 20-25% if managed          |
| `utilities_monthly`       | Decimal       | Electric, gas, water, internet, trash          |
| `insurance_annual`        | Decimal       | Single field: total annual STR policy cost. STR properties need specialized coverage (not standard homeowner's). Enter your actual or quoted policy cost. Default $2,500. |
| `maintenance_reserve_pct` | Decimal       | % of gross revenue, default 5%                 |
| `capex_reserve_pct`       | Decimal       | % of gross revenue for capital expenditures, default 5% |
| `supplies_monthly`        | Decimal       | Toiletries, linens replacement, etc.           |
| `lawn_snow_monthly`       | Decimal       | Relevant for Vermont properties                |
| `other_monthly_expense`   | Decimal       | Catch-all                                      |
| `vacancy_reserve_pct`     | Decimal       | Additional buffer beyond occupancy, default 0  |
| **Vermont / State Taxes** |               |                                              |
| `state_rooms_tax_pct`     | Decimal       | Vermont Meals & Rooms Tax, default 9.0%        |
| `str_surcharge_pct`       | Decimal       | Vermont STR surcharge (Act 183), default 3.0%  |
| `local_option_tax_pct`    | Decimal       | Local option tax, default 1.0% (varies by town; 0% if town hasn't adopted) |
| `local_str_registration_fee` | Decimal   | Annual municipal STR registration fee, default 0 (varies: $100-$125 in towns that require it) |
| `platform_remits_tax`     | bool          | If True (e.g., Airbnb), platform collects & remits state/local taxes — these are pass-through to guest, not an operator expense. Default True. |

### 3.4 `ComputedResults`

Cached computation outputs. Recomputed on any input change. Stored for comparison views.

| Field                        | Type    | Notes                                  |
|------------------------------|---------|----------------------------------------|
| `id`                         | UUID    |                                        |
| `property_id`                | UUID    |                                        |
| `scenario_id`                | UUID    | Links to which mortgage scenario       |
| `computed_at`                | datetime|                                        |
| **Mortgage outputs**         |         |                                        |
| `loan_amount`                | Decimal |                                        |
| `monthly_pi`                 | Decimal | Principal + Interest                   |
| `monthly_pmi`                | Decimal |                                        |
| `monthly_tax`                | Decimal |                                        |
| `monthly_insurance`          | Decimal | Insurance / 12                         |
| `monthly_hoa`                | Decimal |                                        |
| `total_monthly_housing`      | Decimal | PI + PMI + Tax + Insurance + HOA       |
| `total_cash_invested`        | Decimal | Down + closing + reno + furniture + other |
| **Revenue outputs**          |         |                                        |
| `gross_annual_revenue`       | Decimal |                                        |
| `net_annual_revenue`         | Decimal | After platform fees                    |
| `annual_turnovers`           | int     |                                        |
| **Expense outputs**          |         |                                        |
| `total_annual_operating_exp` | Decimal | All operating expenses                 |
| `total_annual_fixed_costs`   | Decimal | Mortgage + tax + insurance + HOA       |
| **Key Metrics**              |         |                                        |
| `monthly_cashflow`           | Decimal | Net revenue - all costs, monthly       |
| `annual_cashflow`            | Decimal |                                        |
| `cash_on_cash_return`        | Decimal | Annual cashflow / total cash invested   |
| `cap_rate`                   | Decimal | NOI / purchase price                   |
| `noi`                        | Decimal | Net Operating Income (revenue - opex, before debt service) |
| `break_even_occupancy`       | Decimal | Occupancy % needed to cover all costs  |
| `dscr`                       | Decimal | NOI / annual debt service              |
| `gross_yield`                | Decimal | Gross revenue / purchase price         |
| `total_roi_year1`            | Decimal | (Cashflow + equity buildup) / cash invested |

---

## 4. Computation Methodology

All computations are pure functions: `f(property, scenario, assumptions) → results`. No side effects. Independently unit-testable.

### 4.1 Mortgage Calculations

```
loan_amount = purchase_price - down_payment_amt

# Standard amortization formula
monthly_rate = annual_rate / 100 / 12
n_payments = loan_term_years * 12
monthly_pi = loan_amount * (monthly_rate * (1 + monthly_rate)^n_payments) / ((1 + monthly_rate)^n_payments - 1)

# For Cash type: monthly_pi = 0

# PMI (conventional only, if down_payment_pct < 20)
monthly_pmi = user_input or estimate (loan_amount * 0.005 / 12)  # ~0.5% annually

monthly_tax = annual_taxes / 12
# IMPORTANT: Use nonhomestead_annual_taxes if available (see §4.6)
# Listing taxes are almost always homestead rate; STR properties pay more
monthly_tax = (nonhomestead_annual_taxes or annual_taxes) / 12
monthly_insurance = insurance_annual / 12
monthly_hoa = hoa_monthly

total_monthly_housing = monthly_pi + monthly_pmi + monthly_tax + monthly_insurance + monthly_hoa

total_cash_invested = down_payment_amt + closing_cost_amt + renovation_cost + furniture_cost + other_upfront_costs
```

### 4.2 Revenue Calculations

```
occupied_nights_per_year = 365 * (occupancy_pct / 100)
gross_annual_revenue = occupied_nights_per_year * avg_nightly_rate

# Cleaning fee revenue (passed to guest)
annual_turnovers = occupied_nights_per_year / avg_stay_length_nights
cleaning_fee_revenue = annual_turnovers * cleaning_fee_per_stay

total_gross_revenue = gross_annual_revenue + cleaning_fee_revenue

# Platform fees apply to total guest payment
platform_fees_annual = total_gross_revenue * (platform_fee_pct / 100)
net_annual_revenue = total_gross_revenue - platform_fees_annual
```

### 4.3 Operating Expense Calculations

```
# Turnover-based costs
annual_cleaning_cost = annual_turnovers * cleaning_cost_per_turn

# Revenue-based costs
property_mgmt_cost = net_annual_revenue * (property_mgmt_pct / 100)
maintenance_reserve = gross_annual_revenue * (maintenance_reserve_pct / 100)
capex_reserve = gross_annual_revenue * (capex_reserve_pct / 100)

# Fixed monthly costs (annualized)
utilities_annual = utilities_monthly * 12
supplies_annual = supplies_monthly * 12
lawn_snow_annual = lawn_snow_monthly * 12
other_annual = other_monthly_expense * 12

# Registration fee (town-specific, annual)
registration_annual = local_str_registration_fee

total_annual_operating_exp = (
    annual_cleaning_cost
    + property_mgmt_cost
    + maintenance_reserve
    + capex_reserve
    + utilities_annual
    + supplies_annual
    + lawn_snow_annual
    + other_annual
    + registration_annual
)
```

### 4.4 Key Metrics

```
# Net Operating Income (before debt service)
noi = net_annual_revenue - total_annual_operating_exp

# Annual fixed costs (debt service + tax + HOA — insurance already in opex)
annual_debt_service = monthly_pi * 12
annual_fixed_costs = total_monthly_housing * 12

# Cashflow
annual_cashflow = noi - annual_debt_service
monthly_cashflow = annual_cashflow / 12

# Cash-on-Cash Return
cash_on_cash_return = annual_cashflow / total_cash_invested  # as percentage

# Cap Rate (financing-independent)
cap_rate = noi / purchase_price

# DSCR
dscr = noi / annual_debt_service  # >1.0 means income covers debt; lenders want ≥1.25

# Gross Yield
gross_yield = gross_annual_revenue / purchase_price

# Break-Even Occupancy
# Find occupancy_pct where annual_cashflow = 0
# Revenue and some costs scale linearly with occupancy; others are fixed.
#
# Let occ = occupancy fraction (0 to 1)
# Revenue(occ) = occ * 365 * nightly_rate
# Cleaning_fee_revenue(occ) = (occ * 365 / avg_stay_length) * cleaning_fee_per_stay
# Total_gross(occ) = Revenue(occ) + Cleaning_fee_revenue(occ)
# Net_revenue(occ) = Total_gross(occ) * (1 - platform_fee_pct/100)
#
# Variable opex (scales with occ):
#   cleaning_cost(occ) = (occ * 365 / avg_stay_length) * cleaning_cost_per_turn
#   mgmt_cost(occ) = Net_revenue(occ) * (property_mgmt_pct / 100)
#   maintenance(occ) = Revenue(occ) * (maintenance_reserve_pct / 100)
#   capex(occ) = Revenue(occ) * (capex_reserve_pct / 100)
#
# Fixed opex (constant regardless of occupancy):
#   F = utilities + supplies + lawn_snow + other + registration (all annualized)
#
# Fixed costs:
#   H = total_monthly_housing * 12  (PI + PMI + tax + insurance + HOA)
#
# Solve: Net_revenue(occ) - variable_opex(occ) - F - H = 0
#
# Since all variable terms are linear in occ, this is:
#   occ * A - occ * B - F - H = 0
#   occ = (F + H) / (A - B)
#
# where A = per-unit-occ net revenue, B = per-unit-occ variable costs

nightly_net_factor = 365 * avg_nightly_rate * (1 - platform_fee_pct/100)
turn_net_factor = (365 / avg_stay_length) * cleaning_fee_per_stay * (1 - platform_fee_pct/100)
A_revenue_per_occ = nightly_net_factor + turn_net_factor

clean_cost_per_occ = (365 / avg_stay_length) * cleaning_cost_per_turn
mgmt_per_occ = A_revenue_per_occ * (property_mgmt_pct / 100)
maint_per_occ = 365 * avg_nightly_rate * (maintenance_reserve_pct / 100)
capex_per_occ = 365 * avg_nightly_rate * (capex_reserve_pct / 100)
B_variable_cost_per_occ = clean_cost_per_occ + mgmt_per_occ + maint_per_occ + capex_per_occ

fixed_total = F + H  # fixed opex + fixed housing costs
break_even_occupancy = fixed_total / (A_revenue_per_occ - B_variable_cost_per_occ)
# Result is a fraction; multiply by 100 for percentage

# Year-1 Total ROI (includes equity)
# Equity buildup from amortization table: sum of principal portions of first 12 payments
year1_equity_buildup = sum(principal_portion(month) for month in 1..12)
total_roi_year1 = (annual_cashflow + year1_equity_buildup) / total_cash_invested
```

### 4.5 Amortization Schedule

Generate a full month-by-month amortization table for each scenario. Useful for:
- Showing equity buildup over time
- Computing principal vs. interest split for tax purposes
- Projecting 5-year / 10-year total returns

```
For each month m (1 to n_payments):
    interest_payment = remaining_balance * monthly_rate
    principal_payment = monthly_pi - interest_payment
    remaining_balance -= principal_payment
```

### 4.6 Vermont Property Tax: Non-Homestead Adjustment

Vermont has a dual education tax rate system. STR investment properties are classified as **nonhomestead**, which typically carries a higher education tax rate than homestead. This is critical because listing sites show the current owner's tax bill (almost always at the homestead rate).

**How it works:**
- Vermont property tax bills consist of: **municipal tax** (same rate for all) + **education tax** (different rate for homestead vs. nonhomestead).
- The statewide nonhomestead education rate for FY26 is **$1.703 per $100** of assessed value, before CLA adjustment.
- The homestead rate varies by town based on per-pupil spending.
- The CLA (Common Level of Appraisal) adjusts rates based on how accurate the town's assessments are relative to market value.

**Implementation approach:**
```
# Option A: User knows the nonhomestead tax amount (best)
# They can look it up on their town's tax rate page or call the assessor
annual_taxes_for_calc = nonhomestead_annual_taxes  # user input

# Option B: Estimate from homestead taxes shown on listing
# This is approximate — the ratio varies significantly by town
# A reasonable heuristic for Vermont:
#   nonhomestead_taxes ≈ listing_taxes * 1.15 to 1.40
# But this varies so much by town that the UI should flag this as an estimate
# and strongly encourage the user to look up the actual rate.

# The UI should:
# 1. Show the listing taxes with a warning: "⚠ This is likely the homestead rate"
# 2. Provide a field for nonhomestead taxes
# 3. Link to the VT Dept of Taxes rate lookup page
```

### 4.7 Vermont Occupancy Taxes (Pass-Through)

Vermont STRs are subject to multiple layers of occupancy tax. These are collected from guests and remitted to the state — they are **not an operator expense** if the platform handles remittance (Airbnb does). However, they affect the guest's total cost and therefore competitiveness.

```
# Tax rates (as of 2024, verify annually):
state_rooms_tax = 9.0%        # Vermont Meals & Rooms Tax
str_surcharge = 3.0%           # Act 183 (effective Aug 1, 2024)
local_option_tax = 0-1.0%     # Town-dependent (Burlington, Stowe, Killington have 1%)
# Total guest tax burden: 12-13%

# If platform_remits_tax is True:
#   These taxes are transparent to the operator — Airbnb/VRBO collects and remits.
#   They do NOT reduce operator revenue.
#   They DO increase guest-facing price, which may affect booking rates.
#
# If platform_remits_tax is False (e.g., direct bookings):
#   Operator must collect and remit. The taxes are still pass-through
#   (collected from guest), but operator bears administrative burden.
#   Model as: taxes_collected = gross_revenue * total_tax_rate
#   These are NOT included in operating expenses (they're held in trust).

# Burlington-specific: additional 9% gross receipts tax on STR revenue
# This IS an operator expense (not pass-through). Add as a field if needed.
```

---

## 5. Property Data Fetching (Scraper Service)

### 5.1 Strategy: Hybrid

1. **Attempt scrape** — User pastes a Zillow or Redfin URL. The backend fetches the page and parses key fields.
2. **Fallback to manual** — If scraping fails (blocked, layout change, etc.), the UI pre-populates what it can and flags missing fields for manual entry.

### 5.2 Implementation approach

```python
# Scraper interface
class PropertyData(BaseModel):
    address: str | None
    city: str | None
    state: str | None
    zip_code: str | None
    listing_price: Decimal | None
    estimated_value: Decimal | None
    beds: int | None
    baths: float | None
    sqft: int | None
    lot_sqft: int | None
    year_built: int | None
    property_type: str | None
    hoa_monthly: Decimal | None
    annual_taxes: Decimal | None

class ScraperResult(BaseModel):
    data: PropertyData
    source: str  # "zillow" | "redfin"
    fields_found: list[str]
    fields_missing: list[str]
    scrape_succeeded: bool

def scrape_property(url: str) -> ScraperResult:
    ...
```

### 5.3 Scraping techniques (in priority order)

1. **Redfin** — Redfin has a semi-public "stingray" API that returns JSON for property pages. More stable than HTML parsing. Pattern: `https://www.redfin.com/stingray/api/home/details/belowTheFold?propertyId=...`
2. **Zillow** — Harder to scrape. Try extracting the `__NEXT_DATA__` JSON blob from the page source (contains structured property data). Requires a realistic User-Agent header.
3. **Fallback** — If both fail, return a partial `ScraperResult` and let the UI handle manual entry.

### 5.4 Considerations

- **Rate limiting**: Add a 2-3 second delay between requests. This is personal use, so volume is low.
- **Caching**: Cache raw scrape results for 24 hours to avoid repeated hits during iterative analysis.
- **User-Agent rotation**: Use a small pool of realistic browser UAs.
- **No headless browser** (initially): Start with simple `httpx` requests. Only escalate to Playwright if needed.
- **Legal**: This is personal use on publicly accessible pages. No redistribution of data.

---

## 6. UI Design

### 6.1 Screen: Dashboard (Home)

The landing page. Shows all saved properties as cards in a grid.

```
┌──────────────────────────────────────────────────────┐
│  STR Profitability Calculator          [+ New Property] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Lake House   │  │ Downtown     │  │ Mountain   │ │
│  │ Burlington   │  │ Condo        │  │ Cabin      │ │
│  │              │  │              │  │            │ │
│  │ $425,000     │  │ $289,000     │  │ $375,000   │ │
│  │ 3bd / 2ba    │  │ 2bd / 1ba    │  │ 4bd / 3ba  │ │
│  │              │  │              │  │            │ │
│  │ CF: $823/mo  │  │ CF: -$120/mo │  │ CF: $1,450 │ │
│  │ CoC: 8.2%    │  │ CoC: -1.4%   │  │ CoC: 12.1% │ │
│  │              │  │              │  │            │ │
│  │ [View] [Del] │  │ [View] [Del] │  │ [View][Del]│ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                      │
│  [Compare Selected ▼]                                │
└──────────────────────────────────────────────────────┘
```

- Each card shows: name, address summary, price, bed/bath, top-line cashflow & CoC for the active scenario.
- Cards are color-coded: green (positive cashflow), red (negative), yellow (marginal).
- Checkbox on each card for multi-select → "Compare Selected" button.

### 6.2 Screen: Property Detail

Tabbed layout within a single property.

**Tab 1: Property Info**
- Displays fetched/entered property details (editable).
- "Fetch from URL" input at the top with status indicator (success/partial/failed).
- All fields from the `Property` model, organized in logical groups:
  - Location (address, city, state, zip)
  - Details (beds, baths, sqft, lot, year built, type)
  - Financials (listing price, estimated value, taxes, HOA)
  - Notes

**Tab 2: Financing**
- List of mortgage scenarios for this property (add/edit/delete/duplicate).
- Each scenario is an expandable card:
  - Loan type selector (Conventional / DSCR / FHA / Cash)
  - Purchase price, down payment (% and $ linked), interest rate, term
  - Closing costs (% and $ linked)
  - One-time costs: renovation, furniture, other
  - PMI (auto-calculated for conventional < 20% down; editable override)
  - Computed summary: loan amount, monthly P&I, total cash to close
- "Star" icon to mark one scenario as active (used in cashflow and dashboard).

**Tab 3: Revenue & Expenses**
- Two-column layout:
  - Left: Revenue inputs (nightly rate, occupancy %, cleaning fee, avg stay length)
  - Right: Expense inputs, grouped:
    - Platform & Management (platform fee %, mgmt fee %)
    - Turnover Costs (cleaning cost per turn)
    - Monthly Fixed (utilities, supplies, lawn/snow, other)
    - Annual (insurance)
    - Reserves (maintenance %, capex %)
- Each field has a sensible default with a "reset to default" icon.
- Every input field has an `ⓘ` tooltip icon (see §11 for full tooltip text reference).
  - Desktop: tooltip appears on hover, stays visible while hovering.
  - Mobile: tooltip appears on tap, dismisses on tap-away.
  - Tooltip component: max-width 320px, soft background, includes default value highlighted in bold if applicable.
  - Fields where the default depends on property attributes (e.g., cleaning cost depends on bed count) should show a dynamic default suggestion: "Suggested for a 3BR: $120-$150".

**Tab 4: Results**
- Top: Scenario selector (dropdown or toggle between saved scenarios).
- Metric cards row:
  - Monthly Cashflow (large, prominent)
  - Annual Cashflow
  - Cash-on-Cash Return
  - Cap Rate
  - NOI
  - Break-Even Occupancy
  - DSCR
  - Gross Yield
  - Year-1 Total ROI
- Breakdown sections:
  - Revenue waterfall (gross → platform fees → net)
  - Expense breakdown (pie chart or stacked bar)
  - Monthly cost breakdown table (PI, tax, insurance, HOA, opex items)
- Sensitivity mini-tool:
  - Slider for occupancy (50-100%) showing cashflow curve
  - Slider for nightly rate (±30%) showing cashflow curve
- Amortization table (collapsible): month-by-month for first 5 years, with running equity total.

### 6.3 Screen: Comparison View

Side-by-side view of 2-4 selected properties.

```
┌─────────────────────────────────────────────────────────┐
│  Compare Properties                          [← Back]   │
├──────────────┬──────────────┬──────────────┬────────────┤
│              │ Lake House   │ Downtown     │ Cabin      │
├──────────────┼──────────────┼──────────────┼────────────┤
│ Price        │ $425,000     │ $289,000     │ $375,000   │
│ Beds/Baths   │ 3/2          │ 2/1          │ 4/3        │
│ Sqft         │ 1,800        │ 950          │ 2,200      │
├──────────────┼──────────────┼──────────────┼────────────┤
│ Cash Invested│ $125,400     │ $82,100      │ $110,800   │
│ Monthly CF   │ $823         │ -$120        │ $1,450     │
│ Annual CF    │ $9,876       │ -$1,440      │ $17,400    │
│ CoC Return   │ 8.2%         │ -1.4%        │ 12.1%      │
│ Cap Rate     │ 6.8%         │ 4.2%         │ 9.3%       │
│ NOI          │ $28,900      │ $12,100      │ $34,800    │
│ Break-Even   │ 48%          │ 72%          │ 38%        │
│ DSCR         │ 1.42         │ 0.88         │ 1.78       │
├──────────────┼──────────────┼──────────────┼────────────┤
│ Verdict      │ ✅ Strong     │ ❌ Negative  │ ✅ Best    │
└──────────────┴──────────────┴──────────────┴────────────┘
```

- Rows are sortable (click header to sort by that metric).
- Best-in-class values highlighted per row.
- Active mortgage scenario shown for each; dropdown to switch.

---

## 7. Backend API

### 7.1 Endpoints

**Properties**
| Method | Endpoint                        | Description                       |
|--------|---------------------------------|-----------------------------------|
| GET    | `/api/properties`               | List all (with summary metrics)   |
| POST   | `/api/properties`               | Create new property               |
| GET    | `/api/properties/{id}`          | Get property with all relations   |
| PUT    | `/api/properties/{id}`          | Update property fields            |
| DELETE | `/api/properties/{id}`          | Soft-delete (archive)             |
| POST   | `/api/properties/scrape`        | Scrape a URL, return PropertyData |

**Mortgage Scenarios**
| Method | Endpoint                                       | Description                 |
|--------|------------------------------------------------|-----------------------------|
| GET    | `/api/properties/{id}/scenarios`               | List scenarios for property |
| POST   | `/api/properties/{id}/scenarios`               | Create scenario             |
| PUT    | `/api/properties/{id}/scenarios/{sid}`          | Update scenario             |
| DELETE | `/api/properties/{id}/scenarios/{sid}`          | Delete scenario             |
| POST   | `/api/properties/{id}/scenarios/{sid}/duplicate`| Duplicate scenario          |
| PUT    | `/api/properties/{id}/scenarios/{sid}/activate` | Set as active scenario      |

**STR Assumptions**
| Method | Endpoint                                 | Description                      |
|--------|------------------------------------------|----------------------------------|
| GET    | `/api/properties/{id}/assumptions`       | Get assumptions                  |
| PUT    | `/api/properties/{id}/assumptions`       | Update assumptions               |

**Computation**
| Method | Endpoint                                          | Description                     |
|--------|---------------------------------------------------|---------------------------------|
| GET    | `/api/properties/{id}/results`                    | Get results for active scenario |
| GET    | `/api/properties/{id}/results/{sid}`              | Get results for specific scenario|
| GET    | `/api/properties/{id}/amortization/{sid}`         | Amortization schedule           |
| GET    | `/api/properties/{id}/sensitivity`                | Sensitivity analysis data       |
| GET    | `/api/compare?ids=uuid1,uuid2,uuid3`             | Comparison data for N properties|

### 7.2 Response shape (example: results)

```json
{
  "property_id": "uuid",
  "scenario_id": "uuid",
  "scenario_name": "30yr Conventional",
  "computed_at": "2026-03-28T14:00:00Z",
  "mortgage": {
    "loan_amount": 318750,
    "monthly_pi": 2175.43,
    "monthly_pmi": 0,
    "total_monthly_housing": 2850.18,
    "total_cash_invested": 125400
  },
  "revenue": {
    "gross_annual": 58400,
    "net_annual": 56648,
    "annual_turnovers": 79
  },
  "expenses": {
    "total_annual_operating": 27748,
    "breakdown": { ... }
  },
  "metrics": {
    "monthly_cashflow": 823.12,
    "annual_cashflow": 9877.44,
    "cash_on_cash_return": 7.88,
    "cap_rate": 6.79,
    "noi": 28900,
    "break_even_occupancy": 48.2,
    "dscr": 1.42,
    "gross_yield": 13.74,
    "total_roi_year1": 10.2
  }
}
```

---

## 8. Project Structure

```
str-calculator/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic/
│   │   └── versions/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan
│   │   ├── config.py            # Settings (DB path, etc.)
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   ├── models/
│   │   │   ├── property.py
│   │   │   ├── scenario.py
│   │   │   └── assumptions.py
│   │   ├── schemas/             # Pydantic request/response models
│   │   │   ├── property.py
│   │   │   ├── scenario.py
│   │   │   ├── assumptions.py
│   │   │   └── results.py
│   │   ├── routers/
│   │   │   ├── properties.py
│   │   │   ├── scenarios.py
│   │   │   ├── assumptions.py
│   │   │   └── compute.py
│   │   ├── services/
│   │   │   ├── scraper/
│   │   │   │   ├── base.py      # ScraperResult model
│   │   │   │   ├── zillow.py
│   │   │   │   ├── redfin.py
│   │   │   │   └── cache.py
│   │   │   └── computation/
│   │   │       ├── mortgage.py  # Pure functions
│   │   │       ├── revenue.py
│   │   │       ├── expenses.py
│   │   │       ├── metrics.py
│   │   │       └── sensitivity.py
│   │   └── tests/
│   │       ├── test_mortgage.py
│   │       ├── test_revenue.py
│   │       ├── test_metrics.py
│   │       └── test_scraper.py
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/                 # API client (axios/fetch)
│   │   ├── components/
│   │   │   ├── Dashboard/
│   │   │   ├── PropertyDetail/
│   │   │   ├── Comparison/
│   │   │   └── shared/          # MetricCard, CurrencyInput, etc.
│   │   ├── hooks/               # useProperty, useScenarios, etc.
│   │   ├── pages/
│   │   └── types/
│   └── tailwind.config.js
└── README.md
```

---

## 9. Deployment (Docker Compose)

```yaml
version: "3.8"
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data          # SQLite file persists here
    environment:
      - DATABASE_URL=sqlite:///app/data/str_calc.db

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

---

## 10. Defaults & Assumptions

Sensible defaults for STR analysis (user can always override):

| Parameter              | Default  | Rationale                              |
|------------------------|----------|----------------------------------------|
| Down payment %         | 25%      | Common for investment properties       |
| Closing costs %        | 3%       | Typical range is 2-5%                  |
| Platform fee %         | 3%       | Airbnb host-only fee                   |
| Property mgmt %        | 0%       | Assumed self-managed initially         |
| Avg stay length        | 3 nights | Typical STR in tourist/vacation areas  |
| Maintenance reserve %  | 5%       | Industry standard                      |
| CapEx reserve %        | 5%       | Industry standard                      |
| Vacancy reserve %      | 0%       | Already captured by occupancy input    |
| Insurance (annual)     | $2,500   | STR-specific policy ballpark           |
| Supplies (monthly)     | $100     | Consumables and linen replacement      |
| Utilities (monthly)    | $250     | Varies heavily by property size        |
| VT Rooms Tax %         | 9%       | State Meals & Rooms Tax                |
| VT STR Surcharge %     | 3%       | Act 183 of 2024                        |
| Local Option Tax %     | 1%       | Varies by town (0% if not adopted)     |
| STR Registration Fee   | $0       | Varies: $100-$125 in towns that require it |
| Platform remits tax    | True     | Airbnb/VRBO collect & remit VT taxes   |
| Is homestead tax       | True     | Listing taxes are usually homestead rate — flag for adjustment |

---

## 11. Input Field Tooltips & Defaults Reference

Every input field in the UI should have an `ⓘ` icon that reveals a tooltip on hover/tap. Tooltips provide: what the field is, a sensible default or rule of thumb, and how to think about the value. Below is the full reference.

### 11.1 Property Info

| Field | Default | Tooltip Text |
|-------|---------|-------------|
| Listing Price | (from scrape) | The asking price from the listing. Your purchase price (set in Financing) may differ based on your offer. |
| Estimated Value | (from scrape) | Zestimate or Redfin estimate. Useful as a sanity check against asking price, but don't rely on it — these estimates can be off by 5-15%. |
| Annual Taxes | (from scrape) | ⚠️ **This is almost certainly the homestead rate.** Investment/STR properties in Vermont are taxed at the higher nonhomestead rate. See the "Non-Homestead Taxes" field below. |
| Non-Homestead Taxes | (manual) | The actual annual tax you'll pay as a non-owner-occupant. Look up your town's nonhomestead education tax rate on the VT Dept of Taxes website, or call the town assessor. Typically 15-40% higher than the homestead amount shown on listings. |
| HOA (Monthly) | $0 | Monthly HOA or condo association fee. Common for condos and townhouses. Verify whether the HOA allows short-term rentals — many don't. |

### 11.2 Financing (Mortgage Scenarios)

| Field | Default | Tooltip Text |
|-------|---------|-------------|
| Purchase Price | = Listing Price | Your offer price. May be above or below the listing price depending on market conditions and negotiation. |
| Down Payment % | 25% | Investment property loans typically require 20-25% down. DSCR loans usually require 20-25%. Conventional with < 20% triggers PMI. |
| Down Payment $ | (computed) | Auto-calculated from purchase price × down payment %. You can override this to set a specific dollar amount. |
| Interest Rate | 7.25% | Current market rate for investment property loans. Investment properties typically carry rates 0.5-0.75% higher than primary residence loans. DSCR loans run 1-2% higher than conventional. Check current rates at Bankrate or NerdWallet. |
| Loan Term | 30 years | Common options: 15yr (higher payment, faster equity, lower total interest), 20yr, 25yr (common for DSCR), 30yr (lowest payment, most common). |
| Closing Costs % | 3% | Typical range: 2-5% of purchase price. Includes lender fees, title insurance, appraisal, attorney fees, recording fees, and prepaid items (taxes, insurance). |
| Closing Costs $ | (computed) | Auto-calculated from purchase price × closing %. Override for a specific dollar amount if you have an estimate from your lender. |
| Renovation Cost | $0 | One-time cost to get the property STR-ready. Includes any remodeling, repairs, painting, landscaping. Even turnkey properties often need $5K-$15K in updates for STR use. |
| Furniture Cost | $0 | One-time cost to furnish the property for STR guests. Rule of thumb: $3K-$5K per bedroom for mid-range furnishing (beds, linens, towels, kitchenware, décor). A 3BR property typically runs $10K-$20K fully furnished. |
| Other Upfront Costs | $0 | Inspection ($300-$500), appraisal ($400-$600), home warranty, smart locks, security cameras, WiFi setup, professional photography, etc. |
| PMI (Monthly) | (auto) | Private Mortgage Insurance, required for conventional loans with < 20% down. Typically 0.5-1.0% of loan amount per year. Drops off automatically when equity reaches 20%. Not applicable for DSCR or cash. |
| Loan Type | Conventional | **Conventional**: Best rates, 15/20/30yr, PMI if < 20% down. **DSCR**: Qualifies on property income (not personal), 20-25% down min, rates ~1-2% higher, common for STR investors. **FHA**: 3.5% down, requires owner-occupancy. **Cash**: No loan — total investment = purchase + closing + reno + furniture. |

### 11.3 Revenue

| Field | Default | Tooltip Text |
|-------|---------|-------------|
| Avg Nightly Rate | — | Your expected average nightly rate across all seasons. Research comparable STR listings in the area on Airbnb/VRBO. Look at similar bed count, amenities, and location. Tools like AirDNA provide market averages by area. |
| Occupancy % | 65% | Percentage of nights booked per year. 65% is a solid benchmark for established STR markets. New listings typically start at 40-50% and ramp up over 6-12 months. Top performers hit 75-85%. Rural/seasonal markets may average 45-55%. |
| Cleaning Fee per Stay | $150 | Fee charged to the guest per booking. US averages by bedroom count: 1BR ≈ $100, 2BR ≈ $155, 3BR ≈ $175, 4BR+ ≈ $200-$300+. Set competitively relative to your market — aim for 25-50% of your nightly rate. |
| Avg Stay Length | 3 nights | Average number of nights per booking. Urban STRs average 2-3 nights. Vacation/resort areas: 4-7 nights. Longer stays = fewer turnovers = lower cleaning costs but also lower cleaning fee revenue. |

### 11.4 Operating Expenses

| Field | Default | Tooltip Text |
|-------|---------|-------------|
| Platform Fee % | 3% | Airbnb's split-fee model charges hosts 3% per booking (guests pay the rest). VRBO charges 5-8%. If using Airbnb's host-only model (required if using channel managers), the fee is 14-15%. Adjust based on your primary platform. |
| Cleaning Cost per Turnover | $120 | What you pay your cleaner each turnover. Varies by size and market. Typical ranges: 1BR $50-$90, 2BR $70-$130, 3BR $100-$150, 4BR+ $150-$300. Rule of thumb: $50/bathroom + $35/bedroom. Includes labor, basic supplies, and laundry. |
| Property Mgmt % | 0% | Fee paid to a property manager as a % of net revenue. 0% if self-managing. Full-service management typically charges 20-25% and handles guest communication, pricing, cleaning coordination, and maintenance. Co-hosting or partial management: 10-15%. |
| Utilities (Monthly) | $250 | Total monthly utilities: electric, gas, water, sewer, internet, trash, streaming services. STRs run higher utility costs than typical homes due to guest usage patterns. Budget $150-$250 for a 1-2BR, $250-$400 for a 3-4BR. Internet ($60-$100/mo) is non-negotiable for STR. |
| Insurance (Annual) | $2,500 | Total annual STR insurance policy cost. Standard homeowner's insurance does NOT cover STR use — you need a specialized STR policy (from providers like Proper, CBIZ, Safely, or Obie). Typical range: $1,500-$3,000/yr depending on property value, location, and rental frequency. Get quotes early — this can make or break your numbers. |
| Maintenance Reserve % | 5% | Percentage of gross revenue set aside for routine maintenance (plumbing, HVAC repairs, appliance fixes, painting touch-ups). Industry standard is 5%. Alternative rule of thumb: 1% of property value per year. Use whichever is higher. |
| CapEx Reserve % | 5% | Percentage of gross revenue reserved for major capital expenditures (roof, HVAC system, water heater, appliances, deck). These are big-ticket items that happen every 5-15 years. 5% is standard. Some investors use 10% total (combined maintenance + capex). |
| Supplies (Monthly) | $100 | Consumables replaced regularly: toiletries, paper products, coffee, cleaning supplies, light bulbs, batteries, small linens. Budget $50-$100 for a 1-2BR, $100-$200 for a 3-4BR. Buying in bulk helps. |
| Lawn & Snow (Monthly) | $0 | Landscaping, mowing, leaf cleanup, snow removal. Highly seasonal in Vermont. Annual contracts for mowing ($100-$200/mo, 6 months) and plowing ($50-$150/mo, 5 months) are common. Enter a monthly average across the year, e.g., $100-$150. Set to $0 for condos. |
| Other Monthly Expense | $0 | Catch-all for anything not covered above: pest control, pool/hot tub maintenance, security monitoring, bookkeeping software, dynamic pricing tools (PriceLabs ~$20/mo), channel manager fees, etc. |

### 11.5 Vermont / State Taxes

| Field | Default | Tooltip Text |
|-------|---------|-------------|
| VT Rooms Tax % | 9% | Vermont Meals & Rooms Tax applied to all STR bookings of < 30 nights. Collected from the guest. If you use Airbnb or VRBO, the platform collects and remits this for you automatically. |
| STR Surcharge % | 3% | Additional surcharge on STR rents enacted by Act 183 of 2024. Collected from the guest on top of the 9% rooms tax. Also remitted by major platforms. |
| Local Option Tax % | 1% | Additional municipal tax adopted by some Vermont towns. Currently 1% where adopted (Burlington, Stowe, Killington, and others). Set to 0% if your town hasn't adopted it. Check with your town clerk. |
| STR Registration Fee | $0 | Annual municipal registration fee. Not all towns require it. Examples: Stowe $100/unit/yr, Dover $125/yr. Check your specific town's requirements. |
| Platform Remits Tax | Yes | If Yes (Airbnb, VRBO), the platform collects all VT rooms/meals taxes from guests and remits to the state on your behalf. These taxes are pass-through — not your expense. If No (direct bookings), you must collect and remit quarterly to VT Dept of Taxes yourself. |

### 11.6 Key Metrics (Results Tab)

| Metric | Tooltip Text |
|--------|-------------|
| Monthly Cashflow | Net monthly income after all expenses, debt service, taxes, and reserves. Positive = the property pays you. Negative = you're subsidizing it out of pocket. Target: > $200/mo for a viable STR. |
| Annual Cashflow | Monthly cashflow × 12. Your annual profit from the property after all costs. |
| Cash-on-Cash Return (CoC) | Annual cashflow ÷ total cash invested. Measures return on the actual cash you put in (not the property's total value). A good STR target is 8-12%. Below 5% may not justify the effort vs. passive investments. |
| Cap Rate | Net Operating Income (NOI) ÷ purchase price. A financing-independent measure of property value. Useful for comparing properties regardless of how they're financed. Good STR cap rates: 6-10%. |
| NOI (Net Operating Income) | Gross revenue minus all operating expenses, before debt service. This is the property's income independent of how you finance it. Used to calculate cap rate and DSCR. |
| Break-Even Occupancy | The minimum occupancy % needed to cover all costs (mortgage, taxes, insurance, operating expenses). Below this, you lose money. A good STR should break even at 40-55%. Above 65% means the margins are thin. |
| DSCR | Debt Service Coverage Ratio = NOI ÷ annual debt service. Measures how comfortably the property's income covers its loan payments. > 1.0 means income covers debt. Lenders typically want ≥ 1.25 for DSCR loans. Below 1.0 = negative cashflow. |
| Gross Yield | Gross annual revenue ÷ purchase price. A quick screening metric before diving into expenses. Good STR gross yields: 12-20%. Below 10% may struggle to cashflow after expenses. |
| Year-1 Total ROI | (Annual cashflow + first-year equity buildup from amortization) ÷ total cash invested. More complete than CoC because it includes the principal paydown building your equity. |

---

## 12. Future Enhancements (Out of Scope for V1)

- **AirDNA integration** — Auto-populate nightly rate and occupancy from market data.
- **Seasonality modeling** — Monthly breakdown of rates and occupancy.
- **Tax analysis** — Depreciation (27.5 year schedule), deductible expenses, STR-specific tax rules (material participation, 14-day rule).
- **Multi-year projections** — Appreciation, rent growth, equity buildup over 5/10/30 years.
- **Export** — PDF report per property for sharing with partners or lenders.
- **Map view** — Show properties on a map with color-coded profitability markers.
