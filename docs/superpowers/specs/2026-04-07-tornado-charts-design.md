# Sensitivity Tornado Charts — Design Spec

**Linear issue:** THI-23
**Date:** 2026-04-07
**Status:** Approved

## Overview

Add tornado chart sensitivity analysis to the property analysis app. A one-at-a-time sensitivity analysis that varies each input variable across its plausible range while holding all others at baseline, then ranks them by impact on a chosen output metric. Users can click any bar to drill down into a detailed line chart sweep for that variable.

## Target Metrics

Three selectable target metrics, toggled via a pill selector:

- **Monthly Cashflow** (default)
- **Cash-on-Cash Return**
- **Cap Rate**

## Backend

### Computation Module

New file: `backend/app/services/computation/tornado.py`

Two pure functions: `compute_tornado()` (STR) and `compute_ltr_tornado()` (LTR).

**Signature (STR):**

```python
def compute_tornado(
    metric_key: str,  # "monthly_cashflow" | "cash_on_cash_return" | "cap_rate"
    # All STR assumption values as individual params (following existing pattern)
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
    # Additional params needed for CoC and cap rate
    total_cash_invested: float,
    purchase_price: float,
    monthly_pi: float,
) -> dict:
```

**Algorithm:**

1. Define variable list with `(name, label, baseline, low, high)` tuples using variable-specific ranges (see ranges below).
2. Compute the target metric at baseline (all defaults).
3. For each variable:
   a. Compute metric at `low` value (all others at baseline).
   b. Compute metric at `high` value (all others at baseline).
   c. Compute ~10 evenly-spaced sweep points across `[low, high]` for drill-down.
4. Sort bars by absolute spread `abs(high_output - low_output)` descending.
5. Return result dict.

**Internal helper:** A `_compute_metric()` function that runs the full pipeline (revenue → expenses → NOI → metric extraction) for a given set of params and returns the requested metric value. This reuses existing computation functions from `revenue.py`, `expenses.py`, `metrics.py`.

### Variable Ranges

**STR variables:**

| Variable | Range Type | Low | High |
|----------|-----------|-----|------|
| Occupancy Rate | Absolute pts | baseline - 15 | baseline + 15 (capped at 100) |
| Nightly Rate | Percentage | baseline * 0.75 | baseline * 1.25 |
| Platform Fee | Absolute pts | baseline - 3 (min 0) | baseline + 3 |
| Property Mgmt % | Absolute pts | baseline - 5 (min 0) | baseline + 5 |
| Cleaning Cost/Turn | Percentage | baseline * 0.70 | baseline * 1.30 |
| Maintenance Reserve | Absolute pts | baseline - 3 (min 0) | baseline + 3 |
| CapEx Reserve | Absolute pts | baseline - 3 (min 0) | baseline + 3 |
| Avg Stay Length | Absolute nights | baseline - 1.5 (min 1) | baseline + 1.5 |

**LTR variables:**

| Variable | Range Type | Low | High |
|----------|-----------|-----|------|
| Monthly Rent | Percentage | baseline * 0.80 | baseline * 1.20 |
| Vacancy Rate | Absolute pts | baseline - 5 (min 0) | baseline + 5 |
| Property Mgmt % | Absolute pts | baseline - 5 (min 0) | baseline + 5 |
| Maintenance Reserve | Absolute pts | baseline - 3 (min 0) | baseline + 3 |
| CapEx Reserve | Absolute pts | baseline - 3 (min 0) | baseline + 3 |
| Tenant Turnover Cost | Percentage | baseline * 0.50 | baseline * 1.50 |

### Pydantic Schemas

Added to `backend/app/schemas/results.py`:

```python
class TornadoSweepPoint(BaseModel):
    input_value: float
    output_value: float

class TornadoBar(BaseModel):
    variable_name: str       # internal key, e.g. "occupancy_pct"
    variable_label: str      # display name, e.g. "Occupancy Rate"
    baseline_input: float
    low_input: float
    high_input: float
    low_output: float        # metric value when input is at low
    high_output: float       # metric value when input is at high
    spread: float            # abs(high_output - low_output)
    sweep: list[TornadoSweepPoint]  # ~10 points for drill-down

class TornadoResponse(BaseModel):
    metric_key: str
    metric_label: str
    baseline_value: float
    bars: list[TornadoBar]   # sorted by spread descending
```

### API Endpoints

Added to `backend/app/routers/compute.py`:

- `GET /api/properties/{property_id}/tornado?metric=monthly_cashflow` — STR tornado
- `GET /api/properties/{property_id}/ltr-tornado?metric=monthly_cashflow` — LTR tornado

Both return `TornadoResponse`. The `metric` query param defaults to `"monthly_cashflow"`. Valid values: `"monthly_cashflow"`, `"cash_on_cash_return"`, `"cap_rate"`.

The endpoint fetches property, active scenario, and assumptions from the DB (same pattern as existing sensitivity endpoints), computes housing/loan params, then calls the computation function.

## Frontend

### TypeScript Types

Added to `frontend/src/types/index.ts`:

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

### API Client

Added to `frontend/src/api/client.ts`:

```typescript
export const getTornado = (propertyId: string, metric: string = "monthly_cashflow") =>
  api.get<TornadoData>(`/properties/${propertyId}/tornado`, { params: { metric } }).then(r => r.data);

export const getLTRTornado = (propertyId: string, metric: string = "monthly_cashflow") =>
  api.get<TornadoData>(`/properties/${propertyId}/ltr-tornado`, { params: { metric } }).then(r => r.data);
```

### New Tab: SensitivityTab

New file: `frontend/src/components/PropertyDetail/SensitivityTab.tsx`

**Props:** `{ propertyId: string; activeRentalType: 'str' | 'ltr' }`

**Layout (top to bottom):**

1. **Metric pill selector** — 3 toggle buttons in a pill group matching the existing tab styling. Active pill is highlighted. Clicking fetches new tornado data for that metric.

2. **TornadoChart** — Custom SVG component:
   - Horizontal bars centered on a vertical baseline line
   - Red bars extend left (downside / worst case), green bars extend right (upside / best case)
   - Variable labels on the left
   - Value annotations at bar ends (e.g., "-$312", "+$298")
   - Header shows metric name and baseline value
   - Legend at bottom
   - Each bar row is clickable (cursor: pointer, hover highlight)
   - Sorted by spread descending (biggest impact at top)

3. **DrillDownChart** — Appears below when a bar is clicked:
   - Line chart following existing `SensitivityChart` SVG pattern from ResultsTab
   - X-axis: input variable range (low to high)
   - Y-axis: metric value
   - Baseline input marked with dashed vertical line and label
   - Zero line if metric crosses zero
   - Header shows "Variable Name → Metric Name"
   - Close button to dismiss

**State:**
- `selectedMetric: string` — current metric key (default: "monthly_cashflow")
- `tornadoData: TornadoData | null` — fetched data
- `selectedBar: TornadoBar | null` — clicked bar for drill-down (null = collapsed)
- `loading: boolean` / `error: string | null`

**Data fetching:** `useEffect` triggers on `selectedMetric` or `propertyId` change. Calls `getTornado()` or `getLTRTornado()` based on `activeRentalType`.

### Tab Integration

In `frontend/src/components/PropertyDetail/PropertyDetail.tsx`:

- Add `"Sensitivity"` to the `TABS` array
- Import and render `SensitivityTab` when active
- Pass `propertyId` and `activeRentalType` as props

## Out of Scope

- No changes to existing sensitivity charts in ResultsTab
- No new database models or migrations
- No caching (computation is trivial arithmetic)
- No user-configurable variable ranges
- No new npm/pip dependencies (SVG charts only)
