import json
import pytest
from unittest.mock import patch, MagicMock

from app.services.scraper.redfin import (
    parse_redfin_url,
    parse_redfin_json,
    map_property_type,
    scrape_redfin_property,
    _extract_from_jsonld,
    _extract_from_html_embedded,
)
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

    def test_apartment(self):
        assert map_property_type("Apartment") == "condo"

    def test_townhouse(self):
        assert map_property_type("Townhouse") == "townhouse"

    def test_multi_family(self):
        assert map_property_type("Multi-Family (2-4 Unit)") == "multi_family"

    def test_unknown_defaults_to_single_family(self):
        assert map_property_type("Land") == "single_family"
        assert map_property_type(None) == "single_family"


# --- Mock HTML page with JSON-LD and embedded data ---

MOCK_JSONLD = json.dumps({
    "@context": "https://schema.org",
    "@type": ["Product", "RealEstateListing"],
    "name": "123 Lake St",
    "offers": {"@type": "Offer", "priceCurrency": "USD", "price": 425000},
    "mainEntity": {
        "@type": "SingleFamilyResidence",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "123 Lake St",
            "addressLocality": "Burlington",
            "addressRegion": "VT",
            "postalCode": "05401",
        },
        "numberOfBedrooms": 3,
        "numberOfBathroomsTotal": 2.5,
        "floorSize": {"@type": "QuantitativeValue", "value": 1800, "unitText": "FTK"},
        "yearBuilt": 1995,
        "accommodationCategory": "Single Family Residential",
    },
})

MOCK_HTML_FULL = f"""
<html>
<head><title>Test</title></head>
<body>
<script type="application/ld+json">{MOCK_JSONLD}</script>
<script>var data = {{"taxesDue": 6200, "hoaDues": 150, "lotSqFt": 8500}};</script>
</body>
</html>
"""

MOCK_JSONLD_PARTIAL = json.dumps({
    "@context": "https://schema.org",
    "@type": ["Product", "RealEstateListing"],
    "offers": {"price": 289000},
    "mainEntity": {
        "@type": "Apartment",
        "address": {
            "streetAddress": "456 Main St",
            "addressLocality": "Stowe",
            "addressRegion": "VT",
            "postalCode": "05672",
        },
        "numberOfBedrooms": 2,
        "numberOfBathroomsTotal": 1.0,
        "accommodationCategory": "Condominium",
    },
})

MOCK_HTML_PARTIAL = f"""
<html><body>
<script type="application/ld+json">{MOCK_JSONLD_PARTIAL}</script>
</body></html>
"""

MOCK_HTML_NO_JSONLD = "<html><body><h1>No data</h1></body></html>"


class TestExtractFromJsonld:
    def test_extracts_listing_data(self):
        result = _extract_from_jsonld(MOCK_HTML_FULL)
        assert result["@type"] == ["Product", "RealEstateListing"]
        assert result["offers"]["price"] == 425000
        assert result["mainEntity"]["numberOfBedrooms"] == 3

    def test_no_jsonld_returns_empty(self):
        result = _extract_from_jsonld(MOCK_HTML_NO_JSONLD)
        assert result == {}


class TestExtractFromHtmlEmbedded:
    def test_extracts_tax_hoa_lot(self):
        result = _extract_from_html_embedded(MOCK_HTML_FULL)
        assert result["annual_taxes"] == 6200
        assert result["hoa_monthly"] == 150
        assert result["lot_sqft"] == 8500

    def test_no_embedded_data(self):
        result = _extract_from_html_embedded(MOCK_HTML_NO_JSONLD)
        assert result == {}


class TestScraperResult:
    def test_fields_found_and_missing(self):
        data = ScrapedPropertyData(
            address="123 Lake St", city="Burlington", state="VT",
            zip_code="05401", listing_price=425000, beds=3, baths=2.0, sqft=1800,
        )
        found = [f for f in ScrapedPropertyData.model_fields if getattr(data, f) is not None]
        missing = [f for f in ScrapedPropertyData.model_fields if getattr(data, f) is None]
        assert "address" in found
        assert "listing_price" in found
        assert "lot_sqft" in missing
        assert "annual_taxes" in missing


class TestScrapeRedfinProperty:
    @patch("app.services.scraper.redfin.httpx.get")
    def test_full_scrape(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, text=MOCK_HTML_FULL)

        result = scrape_redfin_property("https://www.redfin.com/VT/Burlington/123-Lake-St-05401/home/12345678")

        assert result.scrape_succeeded is True
        assert result.data.address == "123 Lake St"
        assert result.data.city == "Burlington"
        assert result.data.state == "VT"
        assert result.data.zip_code == "05401"
        assert result.data.listing_price == 425000
        assert result.data.beds == 3
        assert result.data.baths == 2.5
        assert result.data.sqft == 1800
        assert result.data.year_built == 1995
        assert result.data.lot_sqft == 8500
        assert result.data.annual_taxes == 6200
        assert result.data.hoa_monthly == 150
        assert result.data.property_type == "single_family"
        assert "address" in result.fields_found

    @patch("app.services.scraper.redfin.httpx.get")
    def test_partial_scrape(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, text=MOCK_HTML_PARTIAL)

        result = scrape_redfin_property("https://www.redfin.com/VT/Stowe/456-Main/home/99999")

        assert result.scrape_succeeded is True
        assert result.data.address == "456 Main St"
        assert result.data.beds == 2
        assert result.data.sqft is None
        assert result.data.lot_sqft is None
        assert "sqft" in result.fields_missing
        assert "lot_sqft" in result.fields_missing

    @patch("app.services.scraper.redfin.httpx.get")
    def test_scrape_http_error(self, mock_get):
        mock_get.side_effect = Exception("Connection refused")

        result = scrape_redfin_property("https://www.redfin.com/VT/Burlington/123/home/11111")

        assert result.scrape_succeeded is False
        assert "Connection refused" in result.error_message

    @patch("app.services.scraper.redfin.httpx.get")
    def test_scrape_403_forbidden(self, mock_get):
        mock_get.return_value = MagicMock(status_code=403, text="Forbidden")

        result = scrape_redfin_property("https://www.redfin.com/VT/Burlington/123/home/11111")

        assert result.scrape_succeeded is False
        assert "403" in result.error_message

    @patch("app.services.scraper.redfin.httpx.get")
    def test_scrape_no_jsonld(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, text=MOCK_HTML_NO_JSONLD)

        result = scrape_redfin_property("https://www.redfin.com/VT/Burlington/123/home/11111")

        assert result.scrape_succeeded is False
        assert "No data" in result.error_message
