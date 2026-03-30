import json
import re
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
        trackable_fields = [f for f in ScrapedPropertyData.model_fields if f != "property_type"]
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
