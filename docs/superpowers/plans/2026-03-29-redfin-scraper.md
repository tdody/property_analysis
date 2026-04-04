# Redfin Property Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the ability to paste a Redfin listing URL on the dashboard to auto-create a property with scraped data pre-filled.

**Architecture:** New scraper service (`services/scraper/`) makes HTTP requests to Redfin's stingray API, parses JSON responses, and returns structured property data. New API endpoint creates the property + defaults from scraped data. Dashboard gets URL input flow; Property Info tab highlights missing fields.

**Tech Stack:** httpx (HTTP client), Redfin stingray API (JSON), existing FastAPI + React stack.

**Spec:** `docs/superpowers/specs/2026-03-29-redfin-scraper-design.md`

---

## File Structure

```
backend/
├── app/
│   ├── services/
│   │   └── scraper/
│   │       ├── __init__.py
│   │       ├── models.py          # ScrapedPropertyData, ScraperResult
│   │       └── redfin.py          # parse_redfin_url, scrape_redfin_property
│   ├── schemas/
│   │   └── property.py            # ADD: ScrapeRequest, ScrapeResponse, ScraperResultSchema
│   └── routers/
│       └── properties.py          # ADD: POST /api/properties/scrape
├── pyproject.toml                 # ADD: httpx to prod deps
└── tests/
    ├── test_scraper.py            # Scraper unit tests (URL parsing, response mapping)
    └── test_api_scrape.py         # API endpoint tests (mocked scraper)

frontend/src/
├── api/
│   └── client.ts                  # ADD: ScrapeResponse type, scrapeProperty function
├── components/
│   └── Dashboard/
│       └── Dashboard.tsx          # MODIFY: add URL input flow
│   └── PropertyDetail/
│       └── PropertyInfoTab.tsx    # MODIFY: add scrape indicators
```

---

## Task 1: Scraper Models & URL Parsing (TDD)

**Files:**
- Create: `backend/app/services/scraper/__init__.py`
- Create: `backend/app/services/scraper/models.py`
- Create: `backend/app/services/scraper/redfin.py`
- Create: `backend/tests/test_scraper.py`

- [ ] **Step 1: Write failing tests for URL parsing and models**

`backend/tests/test_scraper.py`:

```python
import pytest
from app.services.scraper.redfin import parse_redfin_url, parse_redfin_json, map_property_type
from app.services.scraper.models import ScrapedPropertyData, ScraperResult


class TestParseRedfinUrl:
    def test_standard_url(self):
        pid, path = parse_redfin_url("https://www.redfin.com/VT/Burlington/123-Lake-St-05401/home/12345678")
        assert pid == "12345678"
        assert path == "/VT/Burlington/123-Lake-St-05401/home/12345678"

    def test_url_with_query_params(self):
        pid, path = parse_redfin_url("https://www.redfin.com/VT/Stowe/456-Mountain-Rd/home/99887766?utm_source=foo")
        assert pid == "99887766"
        assert path == "/VT/Stowe/456-Mountain-Rd/home/99887766"

    def test_url_with_hash(self):
        pid, path = parse_redfin_url("https://www.redfin.com/TX/Austin/789-Main/home/55555#section")
        assert pid == "55555"

    def test_url_without_www(self):
        pid, path = parse_redfin_url("https://redfin.com/VT/Burlington/123-Lake/home/11111")
        assert pid == "11111"

    def test_invalid_url_no_home(self):
        with pytest.raises(ValueError, match="Not a valid Redfin property URL"):
            parse_redfin_url("https://www.redfin.com/VT/Burlington")

    def test_invalid_url_not_redfin(self):
        with pytest.raises(ValueError, match="Not a valid Redfin property URL"):
            parse_redfin_url("https://www.zillow.com/homedetails/123/456_zpid")

    def test_invalid_url_empty(self):
        with pytest.raises(ValueError, match="Not a valid Redfin property URL"):
            parse_redfin_url("")


class TestParseRedfinJson:
    def test_strips_prefix(self):
        result = parse_redfin_json('{}&&{"payload": {"key": "value"}}')
        assert result == {"payload": {"key": "value"}}

    def test_no_prefix(self):
        result = parse_redfin_json('{"payload": {"key": "value"}}')
        assert result == {"payload": {"key": "value"}}

    def test_empty_payload(self):
        result = parse_redfin_json('{}&&{}')
        assert result == {}


class TestMapPropertyType:
    def test_single_family(self):
        assert map_property_type("Single Family Residential") == "single_family"

    def test_condo(self):
        assert map_property_type("Condo/Co-op") == "condo"

    def test_townhouse(self):
        assert map_property_type("Townhouse") == "townhouse"

    def test_multi_family(self):
        assert map_property_type("Multi-Family (2-4 Unit)") == "multi_family"

    def test_unknown_defaults_to_single_family(self):
        assert map_property_type("Land") == "single_family"
        assert map_property_type(None) == "single_family"


class TestScraperResult:
    def test_fields_found_and_missing(self):
        data = ScrapedPropertyData(
            address="123 Lake St",
            city="Burlington",
            state="VT",
            zip_code="05401",
            listing_price=425000,
            beds=3,
            baths=2.0,
            sqft=1800,
            # These are None / missing:
            lot_sqft=None,
            year_built=None,
            hoa_monthly=None,
            annual_taxes=None,
        )
        found = [f for f in data.model_fields if getattr(data, f) is not None]
        missing = [f for f in data.model_fields if getattr(data, f) is None]
        assert "address" in found
        assert "listing_price" in found
        assert "lot_sqft" in missing
        assert "annual_taxes" in missing

    def test_scraper_result_model(self):
        data = ScrapedPropertyData(address="123 Main")
        result = ScraperResult(
            data=data,
            source="redfin",
            source_url="https://www.redfin.com/test",
            fields_found=["address"],
            fields_missing=["city", "state"],
            scrape_succeeded=True,
        )
        assert result.source == "redfin"
        assert result.scrape_succeeded is True
        assert result.error_message is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pdm run pytest tests/test_scraper.py -v
```

Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement models and URL parsing**

`backend/app/services/scraper/__init__.py` — empty file.

`backend/app/services/scraper/models.py`:

```python
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
    source: str
    source_url: str
    fields_found: list[str]
    fields_missing: list[str]
    scrape_succeeded: bool
    error_message: str | None = None
```

`backend/app/services/scraper/redfin.py`:

```python
import json
import re


def parse_redfin_url(url: str) -> tuple[str, str]:
    """Extract (property_id, url_path) from a Redfin URL."""
    match = re.search(r'redfin\.com(/[^?#]+/home/(\d+))', url)
    if not match:
        raise ValueError("Not a valid Redfin property URL")
    return match.group(2), match.group(1)


def parse_redfin_json(text: str) -> dict:
    """Strip Redfin's JSON hijacking prefix and parse."""
    prefix = "{}&&"
    if text.startswith(prefix):
        text = text[len(prefix):]
    return json.loads(text)


def map_property_type(redfin_type: str | None) -> str:
    """Map Redfin property type string to our enum."""
    if not redfin_type:
        return "single_family"
    lower = redfin_type.lower()
    if "condo" in lower or "co-op" in lower:
        return "condo"
    if "townhouse" in lower:
        return "townhouse"
    if "multi" in lower:
        return "multi_family"
    if "single" in lower:
        return "single_family"
    return "single_family"
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pdm run pytest tests/test_scraper.py -v
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/scraper/ backend/tests/test_scraper.py
git commit -m "feat: add scraper models and Redfin URL parsing with tests

- ScrapedPropertyData and ScraperResult Pydantic models
- Redfin URL parser (extract property ID and path)
- JSON prefix stripping for stingray API responses
- Property type mapping (Redfin → our enum)"
```

---

## Task 2: Redfin Scraper HTTP Client (TDD)

**Files:**
- Modify: `backend/app/services/scraper/redfin.py`
- Modify: `backend/tests/test_scraper.py`
- Modify: `backend/pyproject.toml`

- [ ] **Step 1: Add httpx to production dependencies**

In `backend/pyproject.toml`, add `"httpx>=0.28.0"` to `dependencies` (it's currently only in dev deps):

```toml
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "sqlalchemy>=2.0.0",
    "alembic>=1.14.0",
    "pydantic>=2.0.0",
    "pydantic-settings>=2.0.0",
    "aiosqlite>=0.21.0",
    "httpx>=0.28.0",
]
```

```bash
cd backend
pdm install
```

- [ ] **Step 2: Write failing tests for the scrape function**

Add to `backend/tests/test_scraper.py`:

```python
from unittest.mock import patch, MagicMock
from app.services.scraper.redfin import scrape_redfin_property
from app.services.scraper.models import ScraperResult


# Realistic mock responses based on stingray API structure
MOCK_INITIAL_INFO_RESPONSE = '{}&&{"payload": {"listingId": "987654"}}'

MOCK_ABOVE_FOLD_RESPONSE = '{}&&{"payload": {"addressInfo": {"formattedStreetLine": "123 Lake St", "city": "Burlington", "state": "VT", "zip": "05401"}, "beds": 3, "baths": 2.5, "sqFt": {"value": 1800}, "propertyTypeName": "Single Family Residential", "listPrice": 425000, "avm": {"predictedValue": 440000}}}'

MOCK_BELOW_FOLD_RESPONSE = '{}&&{"payload": {"publicRecordsInfo": {"basicInfo": {"lotSqFt": 8500, "yearBuilt": 1995}, "taxInfo": {"taxesDue": 6200}}, "amenitiesInfo": {"hoaDues": null}}}'

MOCK_ABOVE_FOLD_PARTIAL = '{}&&{"payload": {"addressInfo": {"formattedStreetLine": "456 Main St", "city": "Stowe", "state": "VT", "zip": "05672"}, "beds": 2, "baths": 1.0, "sqFt": null, "propertyTypeName": null, "listPrice": 289000}}'

MOCK_BELOW_FOLD_EMPTY = '{}&&{"payload": {}}'


class TestScrapeRedfinProperty:
    @patch("app.services.scraper.redfin.time.sleep")
    @patch("app.services.scraper.redfin.httpx.get")
    def test_full_scrape(self, mock_get, mock_sleep):
        responses = [
            MagicMock(status_code=200, text=MOCK_INITIAL_INFO_RESPONSE),
            MagicMock(status_code=200, text=MOCK_ABOVE_FOLD_RESPONSE),
            MagicMock(status_code=200, text=MOCK_BELOW_FOLD_RESPONSE),
        ]
        mock_get.side_effect = responses

        result = scrape_redfin_property("https://www.redfin.com/VT/Burlington/123-Lake-St-05401/home/12345678")

        assert result.scrape_succeeded is True
        assert result.data.address == "123 Lake St"
        assert result.data.city == "Burlington"
        assert result.data.state == "VT"
        assert result.data.zip_code == "05401"
        assert result.data.listing_price == 425000
        assert result.data.estimated_value == 440000
        assert result.data.beds == 3
        assert result.data.baths == 2.5
        assert result.data.sqft == 1800
        assert result.data.lot_sqft == 8500
        assert result.data.year_built == 1995
        assert result.data.annual_taxes == 6200
        assert result.data.property_type == "single_family"
        assert "address" in result.fields_found
        assert len(result.fields_missing) <= 2  # hoa_monthly might be None

    @patch("app.services.scraper.redfin.time.sleep")
    @patch("app.services.scraper.redfin.httpx.get")
    def test_partial_scrape(self, mock_get, mock_sleep):
        responses = [
            MagicMock(status_code=200, text=MOCK_INITIAL_INFO_RESPONSE),
            MagicMock(status_code=200, text=MOCK_ABOVE_FOLD_PARTIAL),
            MagicMock(status_code=200, text=MOCK_BELOW_FOLD_EMPTY),
        ]
        mock_get.side_effect = responses

        result = scrape_redfin_property("https://www.redfin.com/VT/Stowe/456-Main/home/99999")

        assert result.scrape_succeeded is True
        assert result.data.address == "456 Main St"
        assert result.data.beds == 2
        assert result.data.sqft is None
        assert "sqft" in result.fields_missing
        assert "lot_sqft" in result.fields_missing

    @patch("app.services.scraper.redfin.httpx.get")
    def test_scrape_http_error(self, mock_get):
        mock_get.side_effect = Exception("Connection refused")

        result = scrape_redfin_property("https://www.redfin.com/VT/Burlington/123/home/11111")

        assert result.scrape_succeeded is False
        assert result.error_message is not None
        assert "Connection refused" in result.error_message

    @patch("app.services.scraper.redfin.httpx.get")
    def test_scrape_403_forbidden(self, mock_get):
        mock_get.return_value = MagicMock(status_code=403, text="Forbidden")

        result = scrape_redfin_property("https://www.redfin.com/VT/Burlington/123/home/11111")

        assert result.scrape_succeeded is False
        assert "403" in result.error_message
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend
pdm run pytest tests/test_scraper.py::TestScrapeRedfinProperty -v
```

Expected: FAIL — `scrape_redfin_property` doesn't exist.

- [ ] **Step 4: Implement the scrape function**

Add to `backend/app/services/scraper/redfin.py`:

```python
import time
import httpx
from app.services.scraper.models import ScrapedPropertyData, ScraperResult

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.redfin.com/",
}

BASE_URL = "https://www.redfin.com"


def _safe_get(d: dict, *keys):
    """Safely traverse nested dict keys, returning None if any key is missing."""
    for key in keys:
        if not isinstance(d, dict):
            return None
        d = d.get(key)
        if d is None:
            return None
    return d


def _extract_property_data(above: dict, below: dict) -> ScrapedPropertyData:
    """Extract property fields from stingray API responses."""
    above_payload = above.get("payload", {})
    below_payload = below.get("payload", {})

    # Handle sqFt which can be a dict with "value" key or None
    sqft_raw = _safe_get(above_payload, "sqFt")
    sqft = sqft_raw.get("value") if isinstance(sqft_raw, dict) else sqft_raw

    return ScrapedPropertyData(
        address=_safe_get(above_payload, "addressInfo", "formattedStreetLine"),
        city=_safe_get(above_payload, "addressInfo", "city"),
        state=_safe_get(above_payload, "addressInfo", "state"),
        zip_code=_safe_get(above_payload, "addressInfo", "zip"),
        listing_price=(
            _safe_get(above_payload, "listPrice")
            or _safe_get(above_payload, "listingMinMaxPrices", "listPrice")
            or _safe_get(above_payload, "addressInfo", "listingPrice")
        ),
        estimated_value=_safe_get(above_payload, "avm", "predictedValue"),
        beds=_safe_get(above_payload, "beds"),
        baths=_safe_get(above_payload, "baths"),
        sqft=int(sqft) if sqft else None,
        lot_sqft=_safe_get(below_payload, "publicRecordsInfo", "basicInfo", "lotSqFt"),
        year_built=_safe_get(below_payload, "publicRecordsInfo", "basicInfo", "yearBuilt"),
        property_type=map_property_type(_safe_get(above_payload, "propertyTypeName")),
        hoa_monthly=_safe_get(below_payload, "amenitiesInfo", "hoaDues"),
        annual_taxes=_safe_get(below_payload, "publicRecordsInfo", "taxInfo", "taxesDue"),
    )


def scrape_redfin_property(url: str) -> ScraperResult:
    """Scrape property data from a Redfin listing URL."""
    try:
        property_id, url_path = parse_redfin_url(url)
    except ValueError as e:
        return ScraperResult(
            data=ScrapedPropertyData(),
            source="redfin",
            source_url=url,
            fields_found=[],
            fields_missing=list(ScrapedPropertyData.model_fields.keys()),
            scrape_succeeded=False,
            error_message=str(e),
        )

    try:
        # Step 1: Get listing ID from initialInfo
        resp = httpx.get(
            f"{BASE_URL}/stingray/api/home/details/initialInfo",
            params={"path": url_path},
            headers=HEADERS,
            timeout=15,
        )
        if resp.status_code != 200:
            return ScraperResult(
                data=ScrapedPropertyData(),
                source="redfin",
                source_url=url,
                fields_found=[],
                fields_missing=list(ScrapedPropertyData.model_fields.keys()),
                scrape_succeeded=False,
                error_message=f"initialInfo request failed: {resp.status_code}",
            )
        initial_data = parse_redfin_json(resp.text)
        listing_id = _safe_get(initial_data, "payload", "listingId") or ""

        time.sleep(2)  # Rate limiting

        # Step 2: Get above-the-fold data
        resp = httpx.get(
            f"{BASE_URL}/stingray/api/home/details/aboveTheFold",
            params={"propertyId": property_id, "listingId": listing_id, "accessLevel": "1"},
            headers=HEADERS,
            timeout=15,
        )
        above_data = parse_redfin_json(resp.text) if resp.status_code == 200 else {}

        time.sleep(2)  # Rate limiting

        # Step 3: Get below-the-fold data
        resp = httpx.get(
            f"{BASE_URL}/stingray/api/home/details/belowTheFold",
            params={"propertyId": property_id, "listingId": listing_id, "accessLevel": "1"},
            headers=HEADERS,
            timeout=15,
        )
        below_data = parse_redfin_json(resp.text) if resp.status_code == 200 else {}

        # Extract property data
        data = _extract_property_data(above_data, below_data)

        # Compute fields_found and fields_missing
        # Exclude property_type since it always gets a default from map_property_type
        trackable_fields = [f for f in data.model_fields if f != "property_type"]
        fields_found = [f for f in trackable_fields if getattr(data, f) is not None]
        fields_missing = [f for f in trackable_fields if getattr(data, f) is None]

        return ScraperResult(
            data=data,
            source="redfin",
            source_url=url,
            fields_found=fields_found,
            fields_missing=fields_missing,
            scrape_succeeded=len(fields_found) > 0,
            error_message=None if fields_found else "No data could be extracted",
        )

    except Exception as e:
        return ScraperResult(
            data=ScrapedPropertyData(),
            source="redfin",
            source_url=url,
            fields_found=[],
            fields_missing=list(ScrapedPropertyData.model_fields.keys()),
            scrape_succeeded=False,
            error_message=str(e),
        )
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
pdm run pytest tests/test_scraper.py -v
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/scraper/redfin.py backend/tests/test_scraper.py backend/pyproject.toml backend/pdm.lock
git commit -m "feat: add Redfin stingray API scraper with tests

- HTTP client for initialInfo, aboveTheFold, belowTheFold endpoints
- Safe nested dict traversal for response parsing
- Rate limiting (2s between requests)
- Graceful error handling (HTTP errors, timeouts, missing data)"
```

---

## Task 3: Scrape API Endpoint (TDD)

**Files:**
- Modify: `backend/app/schemas/property.py`
- Modify: `backend/app/routers/properties.py`
- Create: `backend/tests/test_api_scrape.py`

- [ ] **Step 1: Add Pydantic schemas**

Add to `backend/app/schemas/property.py`:

```python
class ScrapeRequest(BaseModel):
    url: str


class ScraperResultSchema(BaseModel):
    source: str
    source_url: str
    fields_found: list[str]
    fields_missing: list[str]
    scrape_succeeded: bool
    error_message: str | None


class ScrapeResponse(BaseModel):
    property_id: str | None
    scraper_result: ScraperResultSchema
```

- [ ] **Step 2: Write failing tests for the API endpoint**

`backend/tests/test_api_scrape.py`:

```python
from unittest.mock import patch
from app.services.scraper.models import ScrapedPropertyData, ScraperResult


MOCK_SCRAPER_RESULT_SUCCESS = ScraperResult(
    data=ScrapedPropertyData(
        address="123 Lake St",
        city="Burlington",
        state="VT",
        zip_code="05401",
        listing_price=425000,
        beds=3,
        baths=2.5,
        sqft=1800,
        property_type="single_family",
    ),
    source="redfin",
    source_url="https://www.redfin.com/VT/Burlington/123-Lake-St/home/12345",
    fields_found=["address", "city", "state", "zip_code", "listing_price", "beds", "baths", "sqft", "property_type"],
    fields_missing=["lot_sqft", "year_built", "hoa_monthly", "annual_taxes", "estimated_value"],
    scrape_succeeded=True,
)

MOCK_SCRAPER_RESULT_FAILURE = ScraperResult(
    data=ScrapedPropertyData(),
    source="redfin",
    source_url="https://www.redfin.com/VT/Burlington/123/home/99999",
    fields_found=[],
    fields_missing=list(ScrapedPropertyData.model_fields.keys()),
    scrape_succeeded=False,
    error_message="403 Forbidden",
)


class TestScrapeEndpoint:
    @patch("app.routers.properties.scrape_redfin_property")
    def test_scrape_success_creates_property(self, mock_scrape, client):
        mock_scrape.return_value = MOCK_SCRAPER_RESULT_SUCCESS

        resp = client.post("/api/properties/scrape", json={"url": "https://www.redfin.com/VT/Burlington/123-Lake-St/home/12345"})

        assert resp.status_code == 201
        data = resp.json()
        assert data["property_id"] is not None
        assert data["scraper_result"]["scrape_succeeded"] is True
        assert "address" in data["scraper_result"]["fields_found"]

        # Verify the property was created with scraped data
        prop_resp = client.get(f"/api/properties/{data['property_id']}")
        assert prop_resp.status_code == 200
        prop = prop_resp.json()
        assert prop["address"] == "123 Lake St"
        assert prop["city"] == "Burlington"
        assert prop["listing_price"] == 425000
        assert prop["beds"] == 3
        assert prop["source_url"] == "https://www.redfin.com/VT/Burlington/123-Lake-St/home/12345"

    @patch("app.routers.properties.scrape_redfin_property")
    def test_scrape_success_creates_scenario(self, mock_scrape, client):
        mock_scrape.return_value = MOCK_SCRAPER_RESULT_SUCCESS

        resp = client.post("/api/properties/scrape", json={"url": "https://www.redfin.com/VT/Burlington/123/home/12345"})
        pid = resp.json()["property_id"]

        # Verify default scenario was created with listing price
        scenarios = client.get(f"/api/properties/{pid}/scenarios").json()
        assert len(scenarios) == 1
        assert scenarios[0]["purchase_price"] == 425000
        assert scenarios[0]["is_active"] is True

    @patch("app.routers.properties.scrape_redfin_property")
    def test_scrape_success_creates_assumptions(self, mock_scrape, client):
        mock_scrape.return_value = MOCK_SCRAPER_RESULT_SUCCESS

        resp = client.post("/api/properties/scrape", json={"url": "https://www.redfin.com/VT/Burlington/123/home/12345"})
        pid = resp.json()["property_id"]

        # Verify default assumptions were created
        assumptions = client.get(f"/api/properties/{pid}/assumptions").json()
        assert assumptions["occupancy_pct"] == 65.0

    @patch("app.routers.properties.scrape_redfin_property")
    def test_scrape_failure_returns_error(self, mock_scrape, client):
        mock_scrape.return_value = MOCK_SCRAPER_RESULT_FAILURE

        resp = client.post("/api/properties/scrape", json={"url": "https://www.redfin.com/VT/Burlington/123/home/99999"})

        assert resp.status_code == 200
        data = resp.json()
        assert data["property_id"] is None
        assert data["scraper_result"]["scrape_succeeded"] is False
        assert "403" in data["scraper_result"]["error_message"]

    def test_scrape_invalid_url(self, client):
        resp = client.post("/api/properties/scrape", json={"url": "https://www.zillow.com/something"})
        assert resp.status_code == 422
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend
pdm run pytest tests/test_api_scrape.py -v
```

- [ ] **Step 4: Implement the scrape endpoint**

Add to `backend/app/routers/properties.py`:

```python
from app.services.scraper.redfin import scrape_redfin_property
from app.schemas.property import ScrapeRequest, ScrapeResponse, ScraperResultSchema


@router.post("/scrape", response_model=ScrapeResponse, status_code=201)
def scrape_property_endpoint(data: ScrapeRequest, db: Session = Depends(get_db)):
    # Validate URL format before calling scraper
    try:
        from app.services.scraper.redfin import parse_redfin_url
        parse_redfin_url(data.url)
    except ValueError:
        raise HTTPException(status_code=422, detail="Not a valid Redfin property URL")

    result = scrape_redfin_property(data.url)

    if not result.scrape_succeeded:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=200,
            content=ScrapeResponse(
                property_id=None,
                scraper_result=ScraperResultSchema(**result.model_dump(exclude={"data"})),
            ).model_dump(),
        )

    # Create property from scraped data
    scraped = result.data
    prop = Property(
        name=scraped.address or "Untitled Property",
        source_url=result.source_url,
        address=scraped.address or "",
        city=scraped.city or "",
        state=scraped.state or "",
        zip_code=scraped.zip_code or "",
        listing_price=scraped.listing_price or 0,
        estimated_value=scraped.estimated_value,
        beds=scraped.beds or 0,
        baths=scraped.baths or 0,
        sqft=scraped.sqft or 0,
        lot_sqft=scraped.lot_sqft,
        year_built=scraped.year_built,
        property_type=scraped.property_type or "single_family",
        hoa_monthly=scraped.hoa_monthly or 0,
        annual_taxes=scraped.annual_taxes or 0,
    )
    db.add(prop)
    db.flush()

    # Create default assumptions
    assumptions = STRAssumptions(property_id=prop.id)
    db.add(assumptions)

    # Create default scenario with listing price as purchase price
    scenario = MortgageScenario(
        property_id=prop.id,
        name="Default Scenario",
        purchase_price=scraped.listing_price or 0,
        down_payment_amt=(scraped.listing_price or 0) * 0.25,
        closing_cost_amt=(scraped.listing_price or 0) * 0.03,
        is_active=True,
    )
    db.add(scenario)

    db.commit()
    db.refresh(prop)

    return ScrapeResponse(
        property_id=prop.id,
        scraper_result=ScraperResultSchema(**result.model_dump(exclude={"data"})),
    )
```

**Note:** Since this uses POST and the existing `/{property_id}` routes use GET/PUT/DELETE, there's no route collision. However, place the scrape endpoint after `create_property` and before `get_property` for readability.

- [ ] **Step 5: Run tests**

```bash
cd backend
pdm run pytest tests/test_api_scrape.py tests/test_api_properties.py -v
```

Expected: All PASS (no regressions).

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/property.py backend/app/routers/properties.py backend/tests/test_api_scrape.py
git commit -m "feat: add POST /api/properties/scrape endpoint with tests

- Accepts Redfin URL, scrapes data, creates property + defaults
- Auto-creates MortgageScenario with listing price as purchase price
- Returns fields_found/fields_missing for frontend indicators
- Graceful failure with error message for frontend fallback"
```

---

## Task 4: Frontend — Dashboard URL Input & API Client

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/components/Dashboard/Dashboard.tsx`

- [ ] **Step 1: Add scrape types and API function**

Add to `frontend/src/api/client.ts`:

```typescript
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

- [ ] **Step 2: Update Dashboard with URL input flow**

Modify `frontend/src/components/Dashboard/Dashboard.tsx`:

Add a URL input section above the existing "create manually" form:

- Text input with placeholder "Paste a Redfin URL..."
- "Fetch" button (gradient indigo, matching Clean Elevated style)
- Loading state: disable input + button, show spinner + "Fetching property data from Redfin..."
- Error state: red text below input
- Success: navigate to `/property/{id}` using `useNavigate()`
- "— or create manually —" divider between URL flow and existing name form

The URL flow calls `scrapeProperty(url)`. On success (property_id is not null), navigate to the property page with the `fields_missing` list passed via URL state (`navigate(\`/property/\${id}\`, { state: { fieldsMissing } })`). On failure, show the error message and keep the form open.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/components/Dashboard/Dashboard.tsx
git commit -m "feat: add Redfin URL input flow to dashboard

- URL input with Fetch button (primary action)
- Loading state with spinner while scraping
- Error display with manual fallback
- Auto-navigate to property on success
- Pass fields_missing via router state"
```

---

## Task 5: Frontend — Property Info Tab Scrape Indicators

**Files:**
- Modify: `frontend/src/components/PropertyDetail/PropertyInfoTab.tsx`

- [ ] **Step 1: Add scrape indicators**

Modify `frontend/src/components/PropertyDetail/PropertyInfoTab.tsx`:

When the property has a `source_url` (indicating it came from scraping):

1. **Info banner at top of the tab:**
   - Indigo/blue info banner: "Property data populated from Redfin — review highlighted fields below"
   - Dismissible (X button, uses local state)
   - Style: `bg-indigo-50 border border-indigo-200 rounded-xl p-4`

2. **Field-level indicators:**
   - Read `fieldsMissing` from `useLocation().state` (passed from Dashboard navigation)
   - Fields in `fieldsMissing` list get: amber border (`border-amber-300`) + helper text "Not found — enter manually" (`text-xs text-amber-500`)
   - Fields NOT in `fieldsMissing` (i.e., scraped successfully) get: small "Redfin" pill next to label (`text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-medium`)

3. **Fallback:** If no `fieldsMissing` state is available (user navigated directly, not from scrape), determine missing fields by checking which values are still at defaults (0, empty string, null). This is approximate but covers the reload case.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PropertyDetail/PropertyInfoTab.tsx
git commit -m "feat: add scrape indicators to Property Info tab

- Info banner when property has source_url
- Amber highlight on missing fields with helper text
- Small Redfin pill badge on scraped fields
- Dismissible banner"
```

---

## Summary

| Task | Component | Key Deliverable |
|------|-----------|----------------|
| 1 | Scraper Models + URL Parsing | Pydantic models, URL parser, property type mapper (TDD) |
| 2 | Redfin HTTP Client | Stingray API client with rate limiting (TDD) |
| 3 | Scrape API Endpoint | POST /api/properties/scrape with auto-creation (TDD) |
| 4 | Frontend Dashboard | URL input flow with loading/error states |
| 5 | Frontend Property Info | Scrape indicators (banner, badges, amber highlights) |
