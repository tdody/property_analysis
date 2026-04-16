import pytest


@pytest.fixture
def setup_str_property(client):
    """Create an STR property with scenario and assumptions."""
    resp = client.post(
        "/api/properties",
        json={
            "name": "Test STR Property",
            "listing_price": 425000,
            "annual_taxes": 6000,
            "hoa_monthly": 0,
            "address": "123 Main St",
            "city": "Burlington",
            "state": "VT",
            "zip_code": "05401",
        },
    )
    pid = resp.json()["id"]

    client.post(
        f"/api/properties/{pid}/scenarios",
        json={
            "name": "30yr Conv",
            "purchase_price": 425000,
            "down_payment_pct": 25.0,
            "down_payment_amt": 106250,
            "interest_rate": 7.25,
            "loan_term_years": 30,
            "closing_cost_pct": 3.0,
            "closing_cost_amt": 12750,
            "is_active": True,
        },
    )

    client.put(
        f"/api/properties/{pid}/assumptions",
        json={
            "avg_nightly_rate": 200,
            "occupancy_pct": 65.0,
            "cleaning_fee_per_stay": 150,
            "avg_stay_length_nights": 3.0,
            "cleaning_cost_per_turn": 120,
            "insurance_annual": 2500,
        },
    )
    return pid


@pytest.fixture
def setup_ltr_property(client):
    """Create an LTR property with scenario and assumptions."""
    resp = client.post(
        "/api/properties",
        json={
            "name": "Test LTR Property",
            "listing_price": 350000,
            "annual_taxes": 5000,
            "hoa_monthly": 0,
            "active_rental_type": "ltr",
            "address": "456 Oak Ave",
            "city": "Burlington",
            "state": "VT",
            "zip_code": "05401",
        },
    )
    pid = resp.json()["id"]

    client.post(
        f"/api/properties/{pid}/scenarios",
        json={
            "name": "30yr Conv",
            "purchase_price": 350000,
            "down_payment_pct": 25.0,
            "down_payment_amt": 87500,
            "interest_rate": 7.0,
            "loan_term_years": 30,
            "closing_cost_pct": 3.0,
            "closing_cost_amt": 10500,
            "is_active": True,
        },
    )

    client.put(
        f"/api/properties/{pid}/ltr-assumptions",
        json={
            "monthly_rent": 2200,
            "insurance_annual": 2000,
        },
    )
    return pid


class TestPDFExportSTR:
    def test_export_pdf_returns_valid_pdf(self, client, setup_str_property):
        resp = client.get(f"/api/properties/{setup_str_property}/export/pdf")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content[:5] == b"%PDF-"
        assert len(resp.content) > 1000

    def test_export_pdf_has_content_disposition(self, client, setup_str_property):
        resp = client.get(f"/api/properties/{setup_str_property}/export/pdf")
        assert "content-disposition" in resp.headers
        assert "lender_packet.pdf" in resp.headers["content-disposition"]

    def test_export_pdf_404_for_missing_property(self, client):
        resp = client.get("/api/properties/nonexistent-id/export/pdf")
        assert resp.status_code == 404


class TestPDFExportLTR:
    def test_export_ltr_pdf(self, client, setup_ltr_property):
        resp = client.get(f"/api/properties/{setup_ltr_property}/export/pdf")
        assert resp.status_code == 200
        assert resp.content[:5] == b"%PDF-"
        assert len(resp.content) > 1000


class TestCharts:
    def test_projection_chart_returns_png(self):
        from app.services.pdf.charts import render_projection_chart

        projections = [
            {
                "year": y,
                "annual_cashflow": 5000 * y,
                "equity": 50000 + 10000 * y,
                "property_value": 400000 + 10000 * y,
            }
            for y in range(1, 6)
        ]
        png = render_projection_chart(projections)
        assert isinstance(png, bytes)
        assert png[:4] == b"\x89PNG"

    def test_sensitivity_chart_returns_png(self):
        from app.services.pdf.charts import render_sensitivity_chart

        occ_sweep = [
            {"occupancy_pct": o, "monthly_cashflow": (o - 50) * 20}
            for o in range(30, 101, 5)
        ]
        rate_sweep = [
            {"nightly_rate": r, "monthly_cashflow": (r - 150) * 5}
            for r in range(140, 261, 10)
        ]
        png = render_sensitivity_chart(occ_sweep, rate_sweep)
        assert isinstance(png, bytes)
        assert png[:4] == b"\x89PNG"

    def test_ltr_sensitivity_chart_returns_png(self):
        from app.services.pdf.charts import render_ltr_sensitivity_chart

        vac_sweep = [
            {"vacancy_pct": v, "monthly_cashflow": 500 - v * 30} for v in range(0, 26)
        ]
        rent_sweep = [
            {"monthly_rent": r, "monthly_cashflow": r - 1800}
            for r in range(1500, 2600, 100)
        ]
        png = render_ltr_sensitivity_chart(vac_sweep, rent_sweep)
        assert isinstance(png, bytes)
        assert png[:4] == b"\x89PNG"


class TestSettingsBranding:
    def test_get_settings_includes_branding_fields(self, client):
        resp = client.get("/api/settings")
        data = resp.json()
        assert "company_name" in data
        assert "logo_filename" in data

    def test_update_company_name(self, client):
        resp = client.put("/api/settings", json={"company_name": "Acme Properties LLC"})
        assert resp.status_code == 200
        assert resp.json()["company_name"] == "Acme Properties LLC"

    def test_logo_404_when_none_uploaded(self, client):
        resp = client.get("/api/settings/logo")
        assert resp.status_code == 404
