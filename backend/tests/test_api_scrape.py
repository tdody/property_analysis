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

    @patch("app.routers.properties.scrape_redfin_property")
    def test_scrape_success_stores_snapshot(self, mock_scrape, client):
        mock_scrape.return_value = MOCK_SCRAPER_RESULT_SUCCESS

        resp = client.post("/api/properties/scrape", json={"url": "https://www.redfin.com/VT/Burlington/123-Lake-St/home/12345"})
        pid = resp.json()["property_id"]

        prop = client.get(f"/api/properties/{pid}").json()
        snapshot = prop["scraped_snapshot"]

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

    def test_manual_property_has_no_snapshot(self, client):
        resp = client.post("/api/properties", json={"name": "Manual Property", "listing_price": 300000})
        assert resp.status_code == 201
        prop = client.get(f"/api/properties/{resp.json()['id']}").json()
        assert prop["scraped_snapshot"] is None

    def test_scrape_invalid_url(self, client):
        resp = client.post("/api/properties/scrape", json={"url": "https://www.zillow.com/something"})
        assert resp.status_code == 422
