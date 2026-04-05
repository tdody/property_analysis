# Redfin Import Proper Tagging — Design Spec

**Issue:** THI-14
**Date:** 2026-04-05
**Status:** Approved

## Problem

When a field cannot be retrieved by the Redfin scraper, the field should not display the "Redfin" tag. Currently, tagging relies on transient router state (`fieldsMissing`) and a heuristic fallback (`deriveMissingFields`) that checks for zero/empty values. This means:

1. If a user manually fills in a field that was missing from Redfin, it incorrectly appears as "from Redfin" (the heuristic sees a non-empty value and assumes it was scraped).
2. If a user edits a scraped value, there's no way to distinguish between "Redfin original" and "user-modified."
3. Router state is lost on page refresh, forcing reliance on the unreliable heuristic.

## Solution

Store an immutable **scraped snapshot** on the property at scrape time. The frontend derives all tag states by comparing current field values against this snapshot.

## Architecture

### Database

Add a single nullable `Text` column to the `properties` table:

- **Column:** `scraped_snapshot` (`Text`, nullable, default `None`)
- **Content:** JSON-serialized dict of field names to their scraped values
- **Only includes fields that were successfully scraped** (i.e., `fields_found`). Fields not retrieved are absent from the dict.
- **Immutable:** Set once at property creation via the scrape endpoint; never updated thereafter.

Example value:
```json
{"address": "123 Main St", "city": "Burlington", "beds": 3, "listing_price": 500000, "annual_taxes": 4200}
```

### Backend Changes

1. **Alembic migration:** Add `scraped_snapshot` column to `properties`.
2. **`Property` model:** Add `scraped_snapshot: Mapped[str | None]` column.
3. **`scrape_property_endpoint`:** After creating the property, build the snapshot dict from `fields_found` and the corresponding values on the scraped data, serialize to JSON, and store on the property.
4. **`PropertyResponse` schema:** Add `scraped_snapshot: dict | None` field. Use a `@field_validator` to deserialize the JSON string from the DB into a dict for the API response.
5. **No changes to the update endpoint** — the snapshot is immutable.

### Frontend Changes

#### Type Updates

Add to the `Property` TypeScript interface:
```typescript
scraped_snapshot: Record<string, string | number | null> | null;
```

#### Tag Derivation Logic

Replace all transient state logic with a pure function:

```typescript
type FieldTag = "redfin" | "redfin-edited" | "missing" | null;

function getFieldTag(
  field: string,
  currentValue: string | number | null,
  snapshot: Record<string, string | number | null> | null
): FieldTag {
  if (!snapshot) return null;                          // Not a scraped property
  if (!(field in snapshot)) return "missing";          // Scraped but field wasn't found
  if (String(snapshot[field]) === String(currentValue)) return "redfin";  // Exact match
  return "redfin-edited";                              // Value was changed
}
```

String coercion handles int/float mismatches (e.g., `3` vs `3.0`).

#### Visual States

| Tag | Badge | Border | Helper Text |
|-----|-------|--------|-------------|
| `"redfin"` | Indigo "Redfin" badge (existing style) | Default slate | None |
| `"redfin-edited"` | Muted "Redfin (edited)" badge (`bg-slate-100 text-slate-500`) | Default slate | None |
| `"missing"` | None | Amber | "Not found — enter manually" |
| `null` | None | Default slate | None |

#### Component Changes

- **`PropertyInfoTab.tsx`:** Remove `deriveMissingFields()`, remove `useLocation()` for field tagging, remove `fieldsMissing` state. Replace `isFound`/`isMissing` helpers with `getFieldTag()`. Update `RedfinBadge` to handle both `"redfin"` and `"redfin-edited"` states. Info banner keyed off `scraped_snapshot` instead of `source_url`.
- **`CurrencyInput.tsx`:** Replace `scraped`/`missing` boolean props with a single `tag: FieldTag` prop.
- **`Dashboard.tsx`:** Remove `fieldsMissing` from router state navigation (no longer needed).

#### Removals

- `deriveMissingFields()` function
- `fieldsMissing` router state passing
- `locationState` usage for tag logic

## Edge Cases

### Existing scraped properties (no snapshot)
Properties already in the DB with `source_url` but no `scraped_snapshot` will show no field tags. This is acceptable — the previous transient tagging was already unreliable on refresh.

### Type comparison
String coercion (`String(a) === String(b)`) avoids int/float mismatches. Null-to-value changes are detected as edits.

### Field cleared by user
If the snapshot has `"lot_sqft": 500` and the user clears it to `null`, `String(null) !== String(500)` → shows "Redfin (edited)".

## Scope — What's NOT Changing

- Scraper logic (`redfin.py` extraction)
- `ScraperResult` model / `fields_found` / `fields_missing` in scrape response
- Property creation flow (adds snapshot storage, otherwise same)
- `source_url` field on the property (remains as-is)

## Testing

- **Backend:** Test that scrape endpoint stores snapshot correctly; test that snapshot only includes `fields_found`; test that snapshot is returned in property GET response.
- **Frontend:** Test `getFieldTag()` for all four states; test that editing a scraped field transitions from "redfin" to "redfin-edited"; test that non-scraped properties show no tags.
