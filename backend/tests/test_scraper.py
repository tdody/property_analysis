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
        found = [f for f in ScrapedPropertyData.model_fields if getattr(data, f) is not None]
        missing = [f for f in ScrapedPropertyData.model_fields if getattr(data, f) is None]
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


from unittest.mock import patch, MagicMock
from app.services.scraper.redfin import scrape_redfin_property


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
