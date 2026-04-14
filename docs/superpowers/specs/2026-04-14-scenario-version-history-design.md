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
| `id` | UUID | PK |
| `scenario_id` | UUID | FK → `mortgage_scenarios`, cascade delete |
| `name` | String | Optional user-provided name. Auto-generated if blank: "Snapshot #N - Apr 14, 2026". Auto-snapshots use "Before restore - Apr 14, 2026". |
| `snapshot_data` | JSON | Full serialized state |
| `created_at` | DateTime | Timestamp |

### `snapshot_data` Structure

```json
{
  "scenario": {
    "loan_type": "conventional",
    "purchase_price": 425000,
    "down_payment_pct": 25.0,
    "interest_rate": 5.5,
    "loan_term_years": 30,
    "closing_cost_pct": 3.0,
    "renovation_cost": 0,
    "furniture_cost": 15000,
    "pmi_monthly": 0,
    "origination_points_pct": 0
  },
  "assumptions": {
    "avg_nightly_rate": 225,
    "occupancy_pct": 70,
    "cleaning_fee_per_stay": 150,
    "...": "all STR or LTR assumption fields"
  },
  "rental_type": "str",
  "results": {
    "monthly_cashflow": 569,
    "cash_on_cash_return": 8.1,
    "noi": 18500,
    "cap_rate": 5.8,
    "dscr": 1.42,
    "monthly_pi": 1796,
    "total_monthly_expenses": 2150,
    "gross_revenue": 42000,
    "net_revenue": 37800,
    "break_even_occupancy": 52.3
  }
}
```

## API Endpoints

All under `/api/scenarios/{scenario_id}/snapshots`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create snapshot. Body: `{ "name": "optional" }`. Returns 400 if at 20-snapshot cap. |
| `GET` | `/` | List all snapshots for scenario, ordered by `created_at` desc. |
| `GET` | `/{snapshot_id}` | Get single snapshot with full data. |
| `DELETE` | `/{snapshot_id}` | Delete a snapshot. |
| `GET` | `/{snapshot_id}/diff` | Diff snapshot vs. current state. Returns changed fields with old/new/delta. |
| `POST` | `/{snapshot_id}/restore` | Auto-snapshots current state (named "Before restore - {date}"), then overwrites scenario + assumptions with snapshot values. Recomputes cached metrics. |

### Diff Response Format

```json
{
  "snapshot_name": "Before rate drop",
  "snapshot_date": "2026-04-14T14:30:00Z",
  "total_changes": 4,
  "changes": [
    {
      "field": "interest_rate",
      "label": "Interest Rate",
      "category": "Mortgage",
      "old_value": 5.5,
      "new_value": 5.25,
      "format": "percent",
      "direction": "decreased"
    },
    {
      "field": "monthly_pi",
      "label": "Monthly P&I",
      "category": "Metrics",
      "old_value": 1842,
      "new_value": 1796,
      "format": "currency",
      "direction": "decreased"
    }
  ],
  "unchanged_count": 12
}
```

### Diff Utility

A pure function that takes two dicts (snapshot state vs. current state), walks the keys, and returns a list of change objects. Fields are categorized as:

- **Mortgage** — loan_type, purchase_price, down_payment_pct, interest_rate, loan_term_years, closing costs, renovation, furniture, PMI, origination points
- **Revenue & Occupancy** — nightly rate, occupancy, cleaning fee, stay length, seasonal params (STR) or monthly rent, vacancy, pet rent (LTR)
- **Expenses** — all operating expense line items
- **Metrics** — cashflow, CoC, NOI, cap rate, DSCR, monthly P&I, gross/net revenue, break-even occupancy

Each change includes `format` (currency, percent, number) for frontend display and `direction` (increased, decreased) for delta arrows.

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

## Edge Cases

- **20-snapshot cap:** POST returns 400 with message. Frontend shows the count in drawer footer so users can manage.
- **Restore at cap (20 snapshots):** Allow the auto-snapshot as a 21st entry. User safety takes priority over a hard cap.
- **Scenario deletion:** Cascade delete removes all snapshots via FK constraint.
- **Rental type mismatch:** If snapshot's `rental_type` differs from current, the diff notes the type change and only compares common fields (mortgage params + metrics). Restore also restores the `active_rental_type` on the property.
- **Name auto-generation:** "Snapshot #N - {date}" where N is the next sequential number for that scenario. Auto-snapshots before restore use "Before restore - {date}".
- **Delete snapshot:** Simple delete with confirmation dialog. No cascading effects.

## Testing

### Backend (pytest)

- Snapshot CRUD: create, list, get, delete
- 20-cap enforcement (returns 400)
- Diff utility: changed fields detected correctly, unchanged fields excluded, correct categories and formats
- Restore flow: auto-snapshot created, scenario + assumptions overwritten, cached metrics recomputed
- Restore at cap: allows 21st auto-snapshot
- Cascade delete: deleting scenario removes all snapshots
- Rental type mismatch in diff

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
- `backend/app/schemas/snapshot.py` — Pydantic schemas
- `backend/app/routers/snapshots.py` — API endpoints
- `backend/app/services/snapshot.py` — Snapshot creation, diff utility, restore logic

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
