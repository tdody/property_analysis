import json
import re

import httpx

from app.services.scraper.models import ScrapedPropertyData, ScraperResult

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


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
    if "condo" in lower or "co-op" in lower or "apartment" in lower:
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


def _extract_from_jsonld(html: str) -> dict:
    """Extract property data from JSON-LD RealEstateListing block."""
    ld_matches = re.findall(
        r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL
    )
    for m in ld_matches:
        try:
            data = json.loads(m)
            types = data.get("@type", [])
            if isinstance(types, list) and "RealEstateListing" in types:
                return data
            if types == "RealEstateListing":
                return data
        except (json.JSONDecodeError, AttributeError):
            continue
    return {}


def _extract_from_html_embedded(html: str) -> dict:
    """Extract tax and HOA data from embedded JSON in the HTML page.

    Redfin embeds JSON data in the page in various forms — sometimes with
    regular quotes, sometimes with escaped quotes (\\"). We handle both.
    """
    result = {}

    # Extract taxesDue (handles both "taxesDue": and \"taxesDue\":)
    tax_match = re.search(r'\\?"taxesDue\\?"\s*:\s*([\d.]+)', html)
    if tax_match:
        try:
            result["annual_taxes"] = float(tax_match.group(1))
        except ValueError:
            pass

    # Extract hoaDues
    hoa_match = re.search(r'\\?"hoaDues\\?"\s*:\s*([\d.]+)', html)
    if hoa_match:
        try:
            result["hoa_monthly"] = float(hoa_match.group(1))
        except ValueError:
            pass

    # Extract lotSqFt or lotSize.value
    lot_match = re.search(r'\\?"lotSqFt\\?"\s*:\s*(\d+)', html)
    if not lot_match:
        lot_match = re.search(r'\\?"lotSize\\?"\s*:\s*\{\\?"value\\?"\s*:\s*(\d+)', html)
    if lot_match:
        try:
            result["lot_sqft"] = int(lot_match.group(1))
        except ValueError:
            pass

    return result


def _extract_property_data(jsonld: dict, html_extras: dict) -> ScrapedPropertyData:
    """Extract property fields from JSON-LD and embedded HTML data."""
    main_entity = jsonld.get("mainEntity", {})
    address_info = main_entity.get("address", {})
    offers = jsonld.get("offers", {})

    # Property type from mainEntity @type or accommodationCategory
    raw_type = main_entity.get("accommodationCategory") or main_entity.get("@type")

    # sqft from floorSize
    floor_size = main_entity.get("floorSize", {})
    sqft = None
    if isinstance(floor_size, dict) and floor_size.get("value"):
        try:
            sqft = int(floor_size["value"])
        except (ValueError, TypeError):
            pass

    # Image URL from JSON-LD photo field
    photo = jsonld.get("photo")
    if isinstance(photo, list) and photo:
        photo = photo[0]
    if isinstance(photo, dict):
        photo = photo.get("contentUrl") or photo.get("url")
    image_url = photo if isinstance(photo, str) else None

    return ScrapedPropertyData(
        address=address_info.get("streetAddress"),
        city=address_info.get("addressLocality"),
        state=address_info.get("addressRegion"),
        zip_code=address_info.get("postalCode"),
        listing_price=offers.get("price"),
        estimated_value=None,  # Not in JSON-LD
        beds=main_entity.get("numberOfBedrooms"),
        baths=main_entity.get("numberOfBathroomsTotal"),
        sqft=sqft,
        lot_sqft=html_extras.get("lot_sqft"),
        year_built=main_entity.get("yearBuilt"),
        property_type=map_property_type(raw_type),
        hoa_monthly=html_extras.get("hoa_monthly"),
        annual_taxes=html_extras.get("annual_taxes"),
        image_url=image_url,
    )


def scrape_redfin_property(url: str) -> ScraperResult:
    """Scrape property data from a Redfin listing URL.

    Fetches the property page HTML and extracts data from:
    1. JSON-LD structured data (address, price, beds, baths, sqft, year built)
    2. Embedded JSON in the page (taxes, HOA, lot size)
    """
    try:
        parse_redfin_url(url)  # Validate URL format
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
        resp = httpx.get(url, headers=HEADERS, follow_redirects=True, timeout=20)
        if resp.status_code != 200:
            return ScraperResult(
                data=ScrapedPropertyData(),
                source="redfin",
                source_url=url,
                fields_found=[],
                fields_missing=list(ScrapedPropertyData.model_fields.keys()),
                scrape_succeeded=False,
                error_message=f"Page request failed: {resp.status_code}",
            )

        html = resp.text

        # Extract from JSON-LD
        jsonld = _extract_from_jsonld(html)

        # Extract tax/HOA/lot from embedded JSON in HTML
        html_extras = _extract_from_html_embedded(html)

        # Build property data
        data = _extract_property_data(jsonld, html_extras)

        # Compute fields_found and fields_missing
        # Exclude property_type since it always gets a default
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
