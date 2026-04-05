# Redfin Import Proper Tagging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a scraped snapshot on properties so field tags ("Redfin", "Redfin (edited)", missing) are derived from persisted data instead of transient router state.

**Architecture:** Add an immutable `scraped_snapshot` JSON column to the `properties` table. The backend populates it at scrape time with `fields_found` values. The frontend replaces all transient tagging logic with a pure `getFieldTag()` function that compares current values against the snapshot.

**Tech Stack:** Python/FastAPI/SQLAlchemy (backend), Alembic (migration), React/TypeScript (frontend), pytest (tests)

---

### Task 1: Alembic Migration — Add `scraped_snapshot` Column

**Files:**
- Create: `backend/alembic/versions/b2c3d4e5f6g7_add_scraped_snapshot.py`

- [ ] **Step 1: Generate the migration file**

Create the migration file with the following content:

```python
"""add scraped_snapshot column

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6g7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('properties', sa.Column('scraped_snapshot', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('properties', 'scraped_snapshot')
```

- [ ] **Step 2: Run the migration**

Run: `cd backend && alembic upgrade head`
Expected: Migration applies cleanly.

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/b2c3d4e5f6g7_add_scraped_snapshot.py
git commit -m "feat(db): add scraped_snapshot column to properties table"
```

---

### Task 2: Backend Model & Schema — Add `scraped_snapshot`

**Files:**
- Modify: `backend/app/models/property.py:5` (add `Text` import already present, add column)
- Modify: `backend/app/schemas/property.py:76-104` (add field to `PropertyResponse`)

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_api_scrape.py`:

```python
@patch("app.routers.properties.scrape_redfin_property")
def test_scrape_success_stores_snapshot(self, mock_scrape, client):
    mock_scrape.return_value = MOCK_SCRAPER_RESULT_SUCCESS

    resp = client.post("/api/properties/scrape", json={"url": "https://www.redfin.com/VT/Burlington/123-Lake-St/home/12345"})
    pid = resp.json()["property_id"]

    prop = client.get(f"/api/properties/{pid}").json()
    snapshot = prop["scraped_snapshot"]

    # Snapshot should include exactly the fields_found values
    assert snapshot is not None
    assert snapshot["address"] == "123 Lake St"
    assert snapshot["city"] == "Burlington"
    assert snapshot["listing_price"] == 425000
    assert snapshot["beds"] == 3
    assert snapshot["baths"] == 2.5
    assert snapshot["sqft"] == 1800

    # Fields that were missing should NOT be in the snapshot
    assert "lot_sqft" not in snapshot
    assert "year_built" not in snapshot
    assert "hoa_monthly" not in snapshot
    assert "annual_taxes" not in snapshot
    assert "estimated_value" not in snapshot

    # image_url and property_type are not trackable fields in the snapshot
    assert "image_url" not in snapshot
    assert "property_type" not in snapshot
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_api_scrape.py::TestScrapeEndpoint::test_scrape_success_stores_snapshot -v`
Expected: FAIL — `scraped_snapshot` not in response or is `None`.

- [ ] **Step 3: Add `scraped_snapshot` column to the Property model**

In `backend/app/models/property.py`, add after the `notes` column (line 46):

```python
scraped_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
```

- [ ] **Step 4: Add `scraped_snapshot` to `PropertyResponse` schema**

In `backend/app/schemas/property.py`, add to the `PropertyResponse` class (after `active_rental_type`):

```python
scraped_snapshot: dict | None = None
```

Add a `@field_validator` to deserialize the JSON string:

```python
from pydantic import BaseModel, Field, field_validator
import json

# Inside PropertyResponse class:
@field_validator("scraped_snapshot", mode="before")
@classmethod
def parse_snapshot(cls, v: str | dict | None) -> dict | None:
    if v is None:
        return None
    if isinstance(v, str):
        return json.loads(v)
    return v
```

- [ ] **Step 5: Run test to verify it still fails**

Run: `cd backend && python -m pytest tests/test_api_scrape.py::TestScrapeEndpoint::test_scrape_success_stores_snapshot -v`
Expected: FAIL — snapshot is `None` because the scrape endpoint doesn't populate it yet.

- [ ] **Step 6: Commit model and schema changes**

```bash
git add backend/app/models/property.py backend/app/schemas/property.py backend/tests/test_api_scrape.py
git commit -m "feat(backend): add scraped_snapshot to Property model and response schema"
```

---

### Task 3: Backend Endpoint — Populate `scraped_snapshot` at Scrape Time

**Files:**
- Modify: `backend/app/routers/properties.py:60-134` (scrape endpoint)

- [ ] **Step 1: Update the scrape endpoint to build and store the snapshot**

In `backend/app/routers/properties.py`, after the property is created (after `db.add(prop)` on line 100, before `db.flush()` on line 101), add the snapshot logic. Actually, we need the scraped data to build the snapshot, so add it right after the property is added:

```python
import json

# After line 100 (db.add(prop)), before db.flush():
# Build scraped snapshot from fields_found
snapshot = {}
for field_name in result.fields_found:
    if field_name in ("property_type", "image_url"):
        continue  # Not tracked in snapshot
    val = getattr(result.data, field_name, None)
    if val is not None:
        snapshot[field_name] = val
prop.scraped_snapshot = json.dumps(snapshot) if snapshot else None
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd backend && python -m pytest tests/test_api_scrape.py::TestScrapeEndpoint::test_scrape_success_stores_snapshot -v`
Expected: PASS

- [ ] **Step 3: Write test for scrape failure — no snapshot stored**

Add to `backend/tests/test_api_scrape.py`:

```python
@patch("app.routers.properties.scrape_redfin_property")
def test_scrape_failure_no_snapshot(self, mock_scrape, client):
    mock_scrape.return_value = MOCK_SCRAPER_RESULT_FAILURE

    resp = client.post("/api/properties/scrape", json={"url": "https://www.redfin.com/VT/Burlington/123/home/99999"})
    assert resp.json()["property_id"] is None
    # No property created, so no snapshot to check — just verify no crash
```

- [ ] **Step 4: Write test for manually created property — snapshot is null**

Add to `backend/tests/test_api_scrape.py` (or a new test in an existing property test file):

```python
def test_manual_property_has_no_snapshot(self, client):
    resp = client.post("/api/properties", json={"name": "Manual Property", "listing_price": 300000})
    assert resp.status_code == 201
    prop = client.get(f"/api/properties/{resp.json()['id']}").json()
    assert prop["scraped_snapshot"] is None
```

- [ ] **Step 5: Run all scrape tests**

Run: `cd backend && python -m pytest tests/test_api_scrape.py -v`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/properties.py backend/tests/test_api_scrape.py
git commit -m "feat(backend): populate scraped_snapshot in scrape endpoint"
```

---

### Task 4: Frontend Types & API — Add `scraped_snapshot`

**Files:**
- Modify: `frontend/src/types/index.ts:20-47` (Property interface)
- Modify: `frontend/src/api/client.ts:61-71` (ScrapeResponse — no changes needed, but verify)

- [ ] **Step 1: Add `scraped_snapshot` to the Property TypeScript interface**

In `frontend/src/types/index.ts`, add to the `Property` interface (after `active_rental_type`):

```typescript
scraped_snapshot: Record<string, string | number | null> | null;
```

- [ ] **Step 2: Verify the build still passes**

Run: `cd frontend && npx tsc --noEmit`
Expected: Type errors in `PropertyInfoTab.tsx` or `Dashboard.tsx` if they construct `Property` objects, but likely clean since they get `Property` from the API.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(frontend): add scraped_snapshot to Property type"
```

---

### Task 5: Frontend — Update `CurrencyInput` to Accept `tag` Prop

**Files:**
- Modify: `frontend/src/components/shared/CurrencyInput.tsx`

- [ ] **Step 1: Define `FieldTag` type and update `CurrencyInput` props**

Replace the `missing` and `scraped` props with a single `tag` prop:

```typescript
export type FieldTag = "redfin" | "redfin-edited" | "missing" | null;

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tooltip?: string;
  className?: string;
  /** Field source tag — controls badge and border styling */
  tag?: FieldTag;
}
```

- [ ] **Step 2: Update `CurrencyInput` component body**

```typescript
export function CurrencyInput({ label, value, onChange, tooltip, className = "", tag }: CurrencyInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value) || 0;
      onChange(val);
    },
    [onChange]
  );

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}
        {tooltip && <TooltipIcon text={tooltip} />}
        {tag === "redfin" && (
          <span className="ml-1.5 text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 px-1.5 py-0.5 rounded font-medium">
            Redfin
          </span>
        )}
        {tag === "redfin-edited" && (
          <span className="ml-1.5 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-medium">
            Redfin (edited)
          </span>
        )}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
        <input
          type="number"
          value={value || ""}
          onChange={handleChange}
          className={`w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100 ${
            tag === "missing" ? "border-amber-300 dark:border-amber-500" : "border-slate-200 dark:border-slate-600"
          }`}
        />
      </div>
      {tag === "missing" && (
        <p className="text-xs text-amber-500 mt-1">Not found — enter manually</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npx tsc --noEmit`
Expected: Type errors in `PropertyInfoTab.tsx` where `missing={...}` and `scraped={...}` are now invalid props. This is expected — we'll fix it in Task 6.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shared/CurrencyInput.tsx
git commit -m "feat(frontend): replace scraped/missing props with tag prop on CurrencyInput"
```

---

### Task 6: Frontend — Rewrite `PropertyInfoTab` Tagging Logic

**Files:**
- Modify: `frontend/src/components/PropertyDetail/PropertyInfoTab.tsx`

This is the main task — replace all transient state-based tagging with snapshot-based derivation.

- [ ] **Step 1: Add `getFieldTag` helper and import `FieldTag`**

At the top of `PropertyInfoTab.tsx`, add the import and helper:

```typescript
import type { FieldTag } from "../shared/CurrencyInput.tsx";

function getFieldTag(
  field: string,
  currentValue: string | number | null | undefined,
  snapshot: Record<string, string | number | null> | null
): FieldTag {
  if (!snapshot) return null;
  if (!(field in snapshot)) return "missing";
  if (String(snapshot[field]) === String(currentValue)) return "redfin";
  return "redfin-edited";
}
```

- [ ] **Step 2: Remove transient tagging logic**

Remove:
- The `deriveMissingFields` function (lines 34-50)
- The `useLocation` import and `location`/`locationState` usage (lines 2, 53-54)
- The `fieldsMissing` derivation (lines 64-66)
- The `isMissing` and `isFound` helpers (lines 68-69)
- The `fieldClass` helper (lines 71-74)

- [ ] **Step 3: Add snapshot-based helpers**

Replace the removed code with:

```typescript
const snapshot = property.scraped_snapshot;
const isScraped = snapshot !== null && snapshot !== undefined;

const tag = (field: string) => getFieldTag(field, form[field as keyof Property], snapshot);

const fieldClass = (field: string) => {
  const t = tag(field);
  return `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-100 ${
    t === "missing" ? "border-amber-300 dark:border-amber-500" : "border-slate-200 dark:border-slate-600"
  }`;
};
```

**Important:** The info banner condition (line 109) currently uses `isScraped` which was `Boolean(property.source_url)`. The new `isScraped` is now derived from `snapshot !== null`, which is the correct behavior — the banner shows only for properties with a scraped snapshot. No template change needed, just verify the banner still works.
```

- [ ] **Step 4: Update `RedfinBadge` component**

Replace the existing `RedfinBadge` with one that handles all tag states:

```typescript
const RedfinBadge = ({ field }: { field: string }) => {
  const t = tag(field);
  if (t === "redfin") {
    return (
      <span className="ml-1.5 text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 px-1.5 py-0.5 rounded font-medium">
        Redfin
      </span>
    );
  }
  if (t === "redfin-edited") {
    return (
      <span className="ml-1.5 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-medium">
        Redfin (edited)
      </span>
    );
  }
  return null;
};
```

- [ ] **Step 5: Update `MissingHelper` component**

Replace with:

```typescript
const MissingHelper = ({ field }: { field: string }) =>
  tag(field) === "missing" ? (
    <p className="text-xs text-amber-500 mt-1">Not found — enter manually</p>
  ) : null;
```

- [ ] **Step 6: Update `CurrencyInput` usages in the template**

Replace all `CurrencyInput` calls that use `missing={...}` and `scraped={...}` with `tag={tag("field_name")}`. For example:

```tsx
<CurrencyInput
  label="Listing Price"
  value={form.listing_price}
  onChange={(v) => updateField("listing_price", v)}
  tooltip={TOOLTIPS.listing_price}
  tag={tag("listing_price")}
/>
```

Apply this pattern to all `CurrencyInput` usages:
- `listing_price`
- `estimated_value`
- `annual_taxes`
- `hoa_monthly`

- [ ] **Step 7: Verify the build passes**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/PropertyDetail/PropertyInfoTab.tsx
git commit -m "feat(frontend): replace transient tagging with snapshot-based getFieldTag"
```

---

### Task 7: Frontend — Remove `fieldsMissing` from Dashboard Navigation

**Files:**
- Modify: `frontend/src/components/Dashboard/Dashboard.tsx:105-122`

- [ ] **Step 1: Simplify the scrape success navigation**

In `Dashboard.tsx`, replace the `handleScrape` callback. Change lines 111-113:

```typescript
// Before:
const fieldsMissing = result.scraper_result.fields_missing;
navigate(`/property/${result.property_id}`, { state: { fieldsMissing } });

// After:
navigate(`/property/${result.property_id}`);
```

- [ ] **Step 2: Verify the build passes**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Dashboard/Dashboard.tsx
git commit -m "feat(frontend): remove fieldsMissing from scrape navigation state"
```

---

### Task 8: Run Full Test Suite & Manual Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && python -m pytest -v`
Expected: All tests PASS.

- [ ] **Step 2: Run frontend type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run frontend build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Verify no remaining references to removed code**

Search for leftover references:
- `deriveMissingFields` should not appear anywhere
- `fieldsMissing` should not appear in `Dashboard.tsx` or `PropertyInfoTab.tsx` (may still appear in `client.ts` ScrapeResponse type, which is fine — the API still returns it)
- `locationState` should not appear in `PropertyInfoTab.tsx`

- [ ] **Step 5: Commit any fixes if needed, then final verification commit**

If all checks pass, no additional commit needed.
