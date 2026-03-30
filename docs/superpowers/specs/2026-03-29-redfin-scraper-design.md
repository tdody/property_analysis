# Redfin Property Scraper — Design Spec

## 1. Overview

Add the ability to create a property by pasting a Redfin listing URL on the dashboard. The backend scrapes property data via Redfin's semi-public stingray API, creates a property with pre-filled fields, and redirects the user to the Property Detail page where missing fields are highlighted for manual entry.

**Scope:** Redfin only (Zillow deferred). Personal use, low volume. No headless browser — plain HTTP requests via `httpx`.

---

## 2. User Flow

1. User browses Redfin in another tab, finds a property
2. Copies the URL (e.g., `https://www.redfin.com/VT/Burlington/123-Lake-St-05401/home/12345678`)
3. On the STR Calculator dashboard, pastes the URL into the "Fetch from Redfin" input
4. Clicks "Fetch" (or presses Enter)
5. Backend scrapes the property data, creates a new Property + default STRAssumptions + default MortgageScenario (with purchase_price = listing_price)
6. Frontend redirects to `/property/{id}`
7. Property Info tab shows pre-filled fields with a banner: "X of Y fields populated from Redfin — review highlighted fields"
8. Fields that were NOT found are highlighted with an amber border so user knows to fill them in
9. Fields that WERE scraped show a small "Redfin" indicator

**Error cases:**
- Invalid URL (not a Redfin property URL) → inline error message, no navigation
- Scrape fails (blocked, timeout, network error) → error message with "Create manually instead" fallback
- Partial data → proceed with what was found (this is the normal/expected case)

---

## 3. Backend

### 3.1 Scraper Service

**Files:**
- `backend/app/services/scraper/__init__.py`
- `backend/app/services/scraper/redfin.py`
- `backend/app/services/scraper/models.py`

#### 3.1.1 Data Models

```python
# backend/app/services/scraper/models.py

from pydantic import BaseModel

class ScrapedPropertyData(BaseModel):
    address: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    listing_price: float | None = None
    estimated_value: float | None = None
    beds: int | None = None
    baths: float | None = None
    sqft: int | None = None
    lot_sqft: int | None = None
    year_built: int | None = None
    property_type: str | None = None
    hoa_monthly: float | None = None
    annual_taxes: float | None = None

class ScraperResult(BaseModel):
    data: ScrapedPropertyData
    source: str  # "redfin"
    source_url: str
    fields_found: list[str]
    fields_missing: list[str]
    scrape_succeeded: bool
    error_message: str | None = None
```

#### 3.1.2 Redfin Scraper

**Approach:** Use Redfin's stingray API endpoints which return structured JSON. This is more reliable than HTML parsing.

**Steps:**
1. Parse the Redfin URL to extract the `propertyId` from the `/home/{id}` segment
2. Call `/stingray/api/home/details/initialInfo?path={url_path}` to get the `listingId`
3. Call `/stingray/api/home/details/aboveTheFold?propertyId={id}&listingId={lid}` for basic property data
4. Call `/stingray/api/home/details/belowTheFold?propertyId={id}&listingId={lid}` for extended data (taxes, HOA, lot size)
5. Parse the JSON responses and map to `ScrapedPropertyData`
6. Return a `ScraperResult` with found/missing field lists

**URL parsing:**
```python
import re

def parse_redfin_url(url: str) -> tuple[str, str]:
    """Extract property_id and url_path from a Redfin URL.

    Returns (property_id, url_path) or raises ValueError.
    """
    # Match: https://www.redfin.com/STATE/CITY/ADDRESS/home/PROPERTY_ID
    match = re.search(r'redfin\.com(/[^?#]+/home/(\d+))', url)
    if not match:
        raise ValueError("Not a valid Redfin property URL")
    return match.group(2), match.group(1)
```

**HTTP requests:**
```python
import httpx
import time

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.redfin.com/",
}

# Redfin stingray responses are prefixed with "{}&&" to prevent JSON hijacking.
# Strip this prefix before parsing.
def parse_redfin_json(text: str) -> dict:
    prefix = "{}&&"
    if text.startswith(prefix):
        text = text[len(prefix):]
    return json.loads(text)
```

**Response mapping:** The stingray API returns nested structures. Key fields to extract:

| Target Field | aboveTheFold Path | belowTheFold Path |
|---|---|---|
| address | `payload.addressInfo.formattedStreetLine` | — |
| city | `payload.addressInfo.city` | — |
| state | `payload.addressInfo.state` | — |
| zip_code | `payload.addressInfo.zip` | — |
| listing_price | `payload.listingMinMaxPrices.listPrice` or `payload.addressInfo.listingPrice` | — |
| estimated_value | `payload.avm.predictedValue` | — |
| beds | `payload.beds` | — |
| baths | `payload.baths` | — |
| sqft | `payload.sqFt.value` | — |
| lot_sqft | — | `payload.publicRecordsInfo.basicInfo.lotSqFt` |
| year_built | — | `payload.publicRecordsInfo.basicInfo.yearBuilt` |
| property_type | `payload.propertyTypeName` | — |
| hoa_monthly | — | `payload.amenitiesInfo.hoaDues` |
| annual_taxes | — | `payload.publicRecordsInfo.taxInfo.taxesDue` |

> **Note:** These paths are based on research and may need adjustment during implementation. The scraper should handle missing nested keys gracefully (return None for that field, don't crash).

**Rate limiting:** Add a 2-second delay between the two API calls. This is personal use with very low volume.

**Caching:** Not needed for V1. Volume is ~5-10 URLs per session at most.

#### 3.1.3 Property Type Mapping

Redfin returns property types like "Single Family Residential", "Condo/Co-op", "Townhouse", "Multi-Family (2-4 Unit)". Map to our enum:

| Redfin Value | Our Value |
|---|---|
| Single Family Residential | single_family |
| Condo/Co-op | condo |
| Townhouse | townhouse |
| Multi-Family* | multi_family |
| (anything else) | single_family (default) |

### 3.2 API Endpoint

**`POST /api/properties/scrape`**

Request:
```json
{
  "url": "https://www.redfin.com/VT/Burlington/123-Lake-St-05401/home/12345678"
}
```

Response (success — full or partial):
```json
{
  "property_id": "uuid-of-created-property",
  "scraper_result": {
    "source": "redfin",
    "source_url": "https://www.redfin.com/...",
    "fields_found": ["address", "city", "state", "zip_code", "listing_price", "beds", "baths", "sqft"],
    "fields_missing": ["lot_sqft", "year_built", "hoa_monthly", "annual_taxes"],
    "scrape_succeeded": true,
    "error_message": null
  }
}
```

Response (failure):
```json
{
  "property_id": null,
  "scraper_result": {
    "source": "redfin",
    "source_url": "https://www.redfin.com/...",
    "fields_found": [],
    "fields_missing": ["all"],
    "scrape_succeeded": false,
    "error_message": "Failed to fetch property data: 403 Forbidden"
  }
}
```

**Behavior:**
- Validates the URL is a Redfin property URL (contains `redfin.com` and `/home/{id}`)
- Calls the scraper service
- If any data was returned (even partial): creates a Property + default STRAssumptions + a default MortgageScenario (with `purchase_price` = `listing_price` if available). Returns 201.
- If scrape completely failed: returns 200 with `property_id: null` and the error. Frontend offers manual fallback.
- Invalid URL format: returns 422 validation error.

### 3.3 Pydantic Schemas

```python
# Add to backend/app/schemas/property.py

class ScrapeRequest(BaseModel):
    url: str

class ScrapeResponse(BaseModel):
    property_id: str | None
    scraper_result: ScraperResultSchema

class ScraperResultSchema(BaseModel):
    source: str
    source_url: str
    fields_found: list[str]
    fields_missing: list[str]
    scrape_succeeded: bool
    error_message: str | None
```

### 3.4 Dependencies

Add `httpx` to `pyproject.toml` production dependencies (it's currently only in dev deps for test client):

```toml
dependencies = [
    ...
    "httpx>=0.28.0",
]
```

---

## 4. Frontend

### 4.1 Dashboard Changes

Replace the current "+ New Property" form with a two-option flow:

```
┌──────────────────────────────────────────────────┐
│  ┌──────────────────────────────────┐ ┌────────┐ │
│  │ Paste Redfin URL...              │ │ Fetch  │ │
│  └──────────────────────────────────┘ └────────┘ │
│                                                  │
│           — or create manually —                 │
│                                                  │
│  ┌────────────────────────────┐                  │
│  │ Property Name              │  [Create]        │
│  └────────────────────────────┘                  │
└──────────────────────────────────────────────────┘
```

- URL input with "Fetch" button at top (primary action)
- "or create manually" divider below
- Existing name-only form below that (secondary action)
- Loading state while scraping: spinner + "Fetching property data from Redfin..."
- Error state: red text below URL input, form stays open

### 4.2 API Client Addition

```typescript
// Add to frontend/src/api/client.ts

export interface ScrapeResponse {
  property_id: string | null;
  scraper_result: {
    source: string;
    source_url: string;
    fields_found: string[];
    fields_missing: string[];
    scrape_succeeded: boolean;
    error_message: string | null;
  };
}

export const scrapeProperty = (url: string) =>
  api.post<ScrapeResponse>("/properties/scrape", { url }).then((r) => r.data);
```

### 4.3 Property Info Tab — Scrape Indicators

When a property has `source_url` set (indicating it was scraped):

- **Banner at top:** "X of Y fields populated from Redfin — review highlighted fields below"
  - Style: indigo/blue info banner, consistent with Clean Elevated design
  - Shows only on first visit (or until user dismisses)

- **Scraped fields:** Small "Redfin" badge next to the label (subtle, non-intrusive)
  - Style: tiny pill `text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded`

- **Missing fields:** Amber border on the input (`border-amber-300`) + small "Not found — enter manually" helper text
  - Style: `text-xs text-amber-500` below the input

**Implementation:** The frontend determines which fields are "missing" by checking which property fields are still at their zero/empty defaults after scraping. The `fields_found` / `fields_missing` arrays from the scrape response can be stored temporarily (in component state during navigation) or derived from the property data itself.

---

## 5. Error Handling

| Scenario | Backend | Frontend |
|---|---|---|
| Not a Redfin URL | 422 error | "Please enter a valid Redfin property URL" |
| Redfin blocks request (403/429) | Return ScraperResult with error | Show error + "Create manually instead" link |
| Redfin timeout | Return ScraperResult with error | Same as above |
| Network error | Return ScraperResult with error | Same as above |
| Partial data (normal case) | Create property, return fields_found/missing | Redirect to property, highlight missing |
| stingray API format changed | Fields return as None, appear in fields_missing | Same as partial data — user fills in manually |

---

## 6. Testing

### Backend Tests
- `backend/tests/test_scraper.py`:
  - Test URL parsing (valid Redfin URLs, invalid URLs, edge cases)
  - Test response mapping (mock stingray API responses → ScrapedPropertyData)
  - Test property type mapping
  - Test fields_found/fields_missing computation
  - Test JSON prefix stripping (`{}&&` removal)

- `backend/tests/test_api_scrape.py`:
  - Test POST /api/properties/scrape with mocked scraper
  - Test property + assumptions + scenario auto-creation
  - Test invalid URL returns 422
  - Test scrape failure returns proper error response

### What NOT to test
- Don't test actual Redfin API calls (would be flaky and hit real servers)
- Mock `httpx` responses with realistic stingray JSON fixtures

---

## 7. Files Changed/Created

**Backend (new):**
- `backend/app/services/scraper/__init__.py`
- `backend/app/services/scraper/models.py`
- `backend/app/services/scraper/redfin.py`
- `backend/tests/test_scraper.py`
- `backend/tests/test_api_scrape.py`

**Backend (modified):**
- `backend/pyproject.toml` — move httpx to production deps
- `backend/app/schemas/property.py` — add ScrapeRequest, ScrapeResponse
- `backend/app/routers/properties.py` — add POST /api/properties/scrape endpoint

**Frontend (modified):**
- `frontend/src/api/client.ts` — add scrapeProperty function + types
- `frontend/src/components/Dashboard/Dashboard.tsx` — add URL input flow
- `frontend/src/components/PropertyDetail/PropertyInfoTab.tsx` — add scrape indicators (banner, field badges, amber highlights)
