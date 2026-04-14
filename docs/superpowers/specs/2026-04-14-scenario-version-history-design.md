# Scenario Version History — Design Spec

**Linear Issue:** THI-26
**Date:** 2026-04-14
**Status:** Approved

## Overview

Track changes to a property's scenarios over time by allowing users to snapshot a scenario's full state (mortgage parameters, assumptions, and computed results), then compare current vs. previous snapshots to understand the impact of changes.

**Use-case:** User models a property at 5.5% interest and 70% occupancy. A week later, rates drop to 5.25% and they update. They compare: "How much did that rate change improve my CoC?" Without versioning, the old numbers are gone.

## Decisions

| Decision | Choice |
|----------|--------|
| Snapshot contents | Full state: mortgage scenario + STR/LTR assumptions + computed results |
| Triggering | Manual only, optional user-provided name |
| Diff view layout | Side-by-side table with Snapshot / Current / Delta columns |
| UI location | ScenarioCard on Financing tab, slide-over drawer for history & diff |
| Restore behavior | Overwrite current values, auto-snapshot current state first |
| Data model | Single JSON blob per snapshot |

## Data Model

### New Table: `scenario_snapshots`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String(36) | PK, `default=lambda: str(uuid.uuid4())` — matches existing pattern |
| `scenario_id` | String(36) | FK → `mortgage_scenarios.id`, cascade delete |
| `name` | String | Optional user-provided name. Auto-generated if blank: "Snapshot #N - Apr 14, 2026". Auto-snapshots use "Before restore - Apr 14, 2026". |
| `snapshot_data` | JSON | Full serialized state (see below) |
| `created_at` | DateTime | Timestamp, `default=func.now()` |

Snapshots are **immutable** — there is no `updated_at` column and no update endpoint. Once created, a snapshot's data never changes.

### `snapshot_data` Structure

All fields from the ORM models are serialized — the examples below are illustrative, not exhaustive. Snapshot creation serializes every column from the relevant models using their Pydantic schema `.model_dump()`.

```json
{
  "scenario": {
    "loan_type": "conventional",
    "purchase_price": 425000,
    "down_payment_pct": 25.0,
    "down_payment_amt": 106250,
    "interest_rate": 5.5,
    "loan_term_years": 30,
    "io_period_years": null,
    "closing_cost_pct": 3.0,
    "closing_cost_amt": 12750,
    "renovation_cost": 0,
    "furniture_cost": 15000,
    "other_upfront_costs": 0,
    "pmi_monthly": 0,
    "origination_points_pct": 0,
    "is_active": true
  },
  "assumptions": {
    "/* All fields from STRAssumptions or LTRAssumptions model */": "...",
    "/* STR example: avg_nightly_rate, occupancy_pct, cleaning_fee_per_stay, */": "...",
    "/* avg_stay_length_nights, all expense fields, seasonal fields, tax fields, */": "...",
    "/* depreciation fields, growth fields, etc. */": "...",
    "/* LTR example: monthly_rent, lease_duration_months, pet_rent_monthly, */": "...",
    "/* vacancy_rate_pct, all expense fields, growth fields, etc. */": "..."
  },
  "rental_type": "str",
  "results": {
    "/* Full nested ComputedResults structure from compute_for_scenario() */": "...",
    "mortgage": {
      "loan_amount": 318750,
      "monthly_pi": 1796,
      "pmi": 0,
      "total_monthly_housing": 1796
    },
    "revenue": {
      "gross_revenue": 42000,
      "net_revenue": 37800,
      "effective_occupancy": 70.0
    },
    "expenses": {
      "total_monthly": 2150,
      "breakdown": { "/* all expense line items */": "..." }
    },
    "metrics": {
      "noi": 18500,
      "monthly_cashflow": 569,
      "cash_on_cash_return": 8.1,
      "cap_rate": 5.8,
      "dscr": 1.42,
      "break_even_occupancy": 52.3,
      "gross_yield": 9.88,
      "total_roi": 12.5
    },
    "depreciation": { "/* building/furniture depreciation if applicable */": "..." },
    "tax_impact": { "/* tax calculations if applicable */": "..." }
  }
}
```

**Key detail:** The `results` field stores the **full nested `ComputedResults` dict** as returned by `compute_for_scenario()` (STR) or `compute_for_scenario_ltr()` (LTR) in `services/analysis.py`. This preserves the complete structure including `mortgage`, `revenue`, `expenses`, `metrics`, `depreciation`, and `tax_impact` sub-objects.

## API Endpoints

All under `/api/properties/{property_id}/scenarios/{scenario_id}/snapshots` — matching the existing nested route pattern where scenarios are scoped under properties.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create snapshot. Body: `{ "name": "optional" }`. Returns 400 if at 20-snapshot cap. |
| `GET` | `/` | List all snapshots for scenario, ordered by `created_at` desc. No pagination needed (20-cap means response length serves as count). |
| `GET` | `/{snapshot_id}` | Get single snapshot with full data. |
| `DELETE` | `/{snapshot_id}` | Delete a snapshot. |
| `GET` | `/{snapshot_id}/diff` | Diff snapshot vs. current state (see "Current State Computation" below). |
| `POST` | `/{snapshot_id}/restore` | Auto-snapshots current state (named "Before restore - {date}"), then overwrites scenario + assumptions with snapshot values. Recomputes cached metrics. |

### Pydantic Schemas (`backend/app/schemas/snapshot.py`)

```python
class SnapshotCreate(BaseModel):
    name: Optional[str] = None  # Auto-generated if blank

class SnapshotListItem(BaseModel):
    id: str
    scenario_id: str
    name: str
    created_at: datetime
    # Key metrics extracted from snapshot_data for preview
    monthly_cashflow: Optional[float] = None
    cash_on_cash_return: Optional[float] = None

class SnapshotResponse(BaseModel):
    id: str
    scenario_id: str
    name: str
    snapshot_data: dict
    created_at: datetime

class DiffChange(BaseModel):
    field: str
    label: str
    category: str  # "Mortgage", "Revenue & Occupancy", "Expenses", "Metrics"
    old_value: Any
    new_value: Any
    format: str  # "currency", "percent", "number", "text"
    direction: Optional[str] = None  # "increased", "decreased", None for text

class DiffResponse(BaseModel):
    snapshot_name: str
    snapshot_date: datetime
    total_changes: int
    changes: list[DiffChange]
    unchanged_count: int
    rental_type_changed: bool = False
    snapshot_rental_type: Optional[str] = None
    current_rental_type: Optional[str] = None
```

### Current State Computation

The `GET /{snapshot_id}/diff` endpoint computes "current state" by:
1. Reading the current `MortgageScenario` and `STRAssumptions`/`LTRAssumptions` from the database
2. Calling `compute_for_scenario()` or `compute_for_scenario_ltr()` from `services/analysis.py` to generate the full results dict
3. Assembling the same `snapshot_data` shape (scenario + assumptions + results + rental_type) for the current state
4. Running the diff utility against the stored snapshot blob

This is a non-trivial operation (not just a DB read) — it requires the `property_id` to load the property and its assumptions, which is why the route is nested under `/api/properties/{property_id}/...`.

### Snapshot Creation Flow

Creating a snapshot also calls the compute service:
1. Load the `MortgageScenario`, `Property`, and active assumptions from DB
2. Call `compute_for_scenario()` / `compute_for_scenario_ltr()` to get current results
3. Serialize scenario fields via Pydantic `.model_dump()`, assumptions fields via `.model_dump()`, and results dict
4. Assemble `snapshot_data` blob and persist

### Diff Utility

A pure function that takes two dicts (snapshot state vs. current state), walks the keys, and returns a list of change objects. Fields are categorized as:

- **Mortgage** — loan_type, purchase_price, down_payment_pct, down_payment_amt, interest_rate, loan_term_years, io_period_years, closing_cost_pct, closing_cost_amt, renovation_cost, furniture_cost, other_upfront_costs, pmi_monthly, origination_points_pct
- **Revenue & Occupancy** — nightly rate, occupancy, cleaning fee, stay length, seasonal params (STR) or monthly rent, vacancy, pet rent (LTR)
- **Expenses** — all operating expense line items
- **Metrics** — cashflow, CoC, NOI, cap rate, DSCR, monthly P&I, gross/net revenue, break-even occupancy, gross yield, total ROI

Each change includes `format` (currency, percent, number, text) for frontend display and `direction` (increased, decreased) for delta arrows.

## Frontend UI

### ScenarioCard Additions

Two new buttons in the ScenarioCard footer (Financing tab):

- **"Save Snapshot"** — blue button with camera icon. Opens a small name input dialog (optional, with placeholder "e.g., Before rate drop"). On submit, calls POST to create snapshot and shows success toast.
- **"History (N)"** — outline button with clock icon and badge showing snapshot count. Opens the history drawer.

### History Drawer

Slides in from the right side of the screen. Contains:

- **Header:** "Version History" title with close button
- **Subtitle:** scenario name + snapshot count
- **Snapshot list:** Each entry shows:
  - Snapshot name (bold)
  - Date and time
  - Key metrics preview: CoC and monthly cashflow (extracted from `snapshot_data.results`)
  - "Compare" and "Restore" action links
- **Footer:** "N of 20 snapshots used"

### Diff View

Replaces drawer content when "Compare" is clicked:

- **Back navigation** to return to snapshot list
- **Header bar:** "Comparing: {snapshot_name} → Current" with change count
- **Side-by-side table:**
  - Columns: Field | Snapshot | Current | Delta
  - Changed rows highlighted with light background
  - Delta column shows directional arrows (▲/▼) with green/red coloring based on whether the change is favorable
  - Unchanged fields hidden by default with "Show all" toggle
- **Footer:** "Restore This Snapshot" button

### Restore Flow

1. User clicks "Restore" on a snapshot (from list or diff view)
2. Confirmation dialog: "This will save your current configuration as a snapshot and restore '{name}'. Continue?"
3. On confirm: calls POST `/{snapshot_id}/restore`
4. Backend auto-snapshots current state, overwrites scenario + assumptions, recomputes cache
5. Frontend refreshes scenario data and shows success toast
6. Drawer closes

## Restore: Assumption Table Handling

Restore writes to the assumption table matching `snapshot_data.rental_type`:
- If `rental_type` is `"str"`: update the property's `str_assumptions` row with the snapshot's assumption values
- If `rental_type` is `"ltr"`: update the property's `ltr_assumptions` row with the snapshot's assumption values
- The other assumption table is **left untouched** — restoring an STR snapshot does not clear or modify LTR assumptions
- The property's `active_rental_type` is updated to match `snapshot_data.rental_type`

## Edge Cases

- **20-snapshot cap:** POST returns 400 with message. Frontend shows the count in drawer footer so users can manage.
- **Restore at cap (20 snapshots):** Allow the auto-snapshot as a 21st entry. User safety takes priority over a hard cap.
- **Scenario deletion:** Cascade delete removes all snapshots via FK constraint.
- **Rental type mismatch in diff:** If snapshot's `rental_type` differs from current, the diff sets `rental_type_changed: true` and only compares common fields (mortgage params + metrics). Assumption fields are skipped since the schemas differ.
- **Name auto-generation:** "Snapshot #N - {date}" where N is the next sequential number for that scenario. Auto-snapshots before restore use "Before restore - {date}".
- **Delete snapshot:** Simple delete with confirmation dialog. No cascading effects.
- **Empty state:** When a scenario has no snapshots, the History button shows no badge and the drawer shows "No snapshots yet. Save a snapshot to start tracking changes."

## Testing

### Backend (pytest)

- Snapshot CRUD: create, list, get, delete
- 20-cap enforcement (returns 400)
- Snapshot creation calls compute service and serializes full state
- Diff utility: changed fields detected correctly, unchanged fields excluded, correct categories and formats
- Diff endpoint calls compute service for current state
- Restore flow: auto-snapshot created, scenario + assumptions overwritten, correct assumption table updated, cached metrics recomputed
- Restore at cap: allows 21st auto-snapshot
- Restore with rental type change: updates active_rental_type, writes correct assumption table
- Cascade delete: deleting scenario removes all snapshots
- Rental type mismatch in diff: only common fields compared

### Frontend (component tests)

- ScenarioCard renders snapshot buttons with correct count
- History drawer opens/closes, lists snapshots in date order
- Diff table renders changed rows with correct highlighting and deltas
- "Show all" toggle reveals unchanged fields
- Save snapshot dialog with optional name input
- Restore confirmation flow
- Empty state: no snapshots yet message

## Files to Create/Modify

### Backend (new)
- `backend/app/models/snapshot.py` — ScenarioSnapshot ORM model
- `backend/app/schemas/snapshot.py` — Pydantic schemas (SnapshotCreate, SnapshotListItem, SnapshotResponse, DiffChange, DiffResponse)
- `backend/app/routers/snapshots.py` — API endpoints nested under `/api/properties/{property_id}/scenarios/{scenario_id}/snapshots`
- `backend/app/services/snapshot.py` — Snapshot creation (with compute call), diff utility, restore logic

### Backend (modify)
- `backend/app/main.py` — Register snapshots router
- `backend/app/models/__init__.py` — Export new model (if using)

### Frontend (new)
- `frontend/src/components/PropertyDetail/SnapshotButton.tsx` — Save Snapshot button + name dialog
- `frontend/src/components/PropertyDetail/HistoryDrawer.tsx` — Drawer with snapshot list
- `frontend/src/components/PropertyDetail/SnapshotDiffView.tsx` — Side-by-side diff table

### Frontend (modify)
- `frontend/src/components/PropertyDetail/ScenarioCard.tsx` — Add snapshot/history buttons
- `frontend/src/api/` — New snapshot API client methods
- `frontend/src/types/` — Snapshot TypeScript interfaces

### Database
- New Alembic migration for `scenario_snapshots` table
