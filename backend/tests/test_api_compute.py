import pytest


@pytest.fixture
def setup_property(client):
    """Create a property with scenario and assumptions for computation tests."""
    resp = client.post("/api/properties", json={
        "name": "Test Property",
        "listing_price": 425000,
        "annual_taxes": 6000,
        "hoa_monthly": 0,
    })
    pid = resp.json()["id"]

    client.post(f"/api/properties/{pid}/scenarios", json={
        "name": "30yr Conv",
        "purchase_price": 425000,
        "down_payment_pct": 25.0,
        "down_payment_amt": 106250,
        "interest_rate": 7.25,
        "loan_term_years": 30,
        "closing_cost_pct": 3.0,
        "closing_cost_amt": 12750,
        "is_active": True,
    })

    client.put(f"/api/properties/{pid}/assumptions", json={
        "avg_nightly_rate": 200,
        "occupancy_pct": 65.0,
        "cleaning_fee_per_stay": 150,
        "avg_stay_length_nights": 3.0,
        "cleaning_cost_per_turn": 120,
        "insurance_annual": 2500,
    })
    return pid


class TestComputeResults:
    def test_get_results(self, client, setup_property):
        resp = client.get(f"/api/properties/{setup_property}/results")
        assert resp.status_code == 200
        data = resp.json()
        assert "mortgage" in data
        assert "revenue" in data
        assert "expenses" in data
        assert "metrics" in data
        assert data["metrics"]["noi"] > 0

    def test_results_for_specific_scenario(self, client, setup_property):
        scenarios = client.get(f"/api/properties/{setup_property}/scenarios").json()
        sid = scenarios[0]["id"]
        resp = client.get(f"/api/properties/{setup_property}/results/{sid}")
        assert resp.status_code == 200


class TestAmortization:
    def test_get_amortization(self, client, setup_property):
        scenarios = client.get(f"/api/properties/{setup_property}/scenarios").json()
        sid = scenarios[0]["id"]
        resp = client.get(f"/api/properties/{setup_property}/amortization/{sid}")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 360


class TestSensitivity:
    def test_get_sensitivity(self, client, setup_property):
        resp = client.get(f"/api/properties/{setup_property}/sensitivity")
        assert resp.status_code == 200
        data = resp.json()
        assert "occupancy_sweep" in data
        assert "rate_sweep" in data


class TestComparison:
    def test_compare_properties(self, client):
        p1 = client.post("/api/properties", json={"name": "P1", "listing_price": 400000, "annual_taxes": 5000}).json()["id"]
        p2 = client.post("/api/properties", json={"name": "P2", "listing_price": 300000, "annual_taxes": 4000}).json()["id"]

        # Add scenarios
        for pid, price in [(p1, 400000), (p2, 300000)]:
            client.post(f"/api/properties/{pid}/scenarios", json={
                "name": "Default",
                "purchase_price": price,
                "down_payment_pct": 25.0,
                "down_payment_amt": price * 0.25,
                "interest_rate": 7.0,
            })
            client.put(f"/api/properties/{pid}/assumptions", json={
                "avg_nightly_rate": 200,
                "occupancy_pct": 65.0,
            })

        resp = client.get(f"/api/compare?ids={p1},{p2}")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2


class TestComputeWithTier1Fields:
    def test_results_include_rental_delay(self, client):
        # Create property with assumptions that have rental delay
        resp = client.post("/api/properties", json={"name": "Delay Test", "listing_price": 400000, "annual_taxes": 6000})
        pid = resp.json()["id"]
        # Update assumptions with rental delay
        client.put(f"/api/properties/{pid}/assumptions", json={"rental_delay_months": 2})
        # Create scenario
        client.post(f"/api/properties/{pid}/scenarios", json={
            "name": "Test", "purchase_price": 400000, "down_payment_pct": 25,
            "down_payment_amt": 100000, "interest_rate": 7.25, "loan_term_years": 30,
            "closing_cost_pct": 3, "closing_cost_amt": 12000,
        })
        # Get results
        resp = client.get(f"/api/properties/{pid}/results")
        assert resp.status_code == 200
        data = resp.json()
        assert data["rental_delay_months"] == 2

    def test_dscr_warning_when_low(self, client):
        # Create property with DSCR loan and poor metrics
        resp = client.post("/api/properties", json={"name": "DSCR Test", "listing_price": 600000, "annual_taxes": 10000})
        pid = resp.json()["id"]
        client.put(f"/api/properties/{pid}/assumptions", json={"avg_nightly_rate": 100, "occupancy_pct": 40})
        client.post(f"/api/properties/{pid}/scenarios", json={
            "name": "DSCR Loan", "loan_type": "dscr", "purchase_price": 600000,
            "down_payment_pct": 25, "down_payment_amt": 150000,
            "interest_rate": 8.0, "loan_term_years": 30,
            "closing_cost_pct": 3, "closing_cost_amt": 18000,
        })
        resp = client.get(f"/api/properties/{pid}/results")
        assert resp.status_code == 200
        data = resp.json()
        if data["metrics"]["dscr"] < 1.25:
            assert data["metrics"]["dscr_warning"] is not None
            assert "1.25" in data["metrics"]["dscr_warning"]

    def test_gross_receipts_tax_in_expenses(self, client):
        resp = client.post("/api/properties", json={"name": "Burlington", "listing_price": 400000, "annual_taxes": 6000})
        pid = resp.json()["id"]
        client.put(f"/api/properties/{pid}/assumptions", json={"local_gross_receipts_tax_pct": 9.0})
        client.post(f"/api/properties/{pid}/scenarios", json={
            "name": "Test", "purchase_price": 400000, "down_payment_pct": 25,
            "down_payment_amt": 100000, "interest_rate": 7.25, "loan_term_years": 30,
            "closing_cost_pct": 3, "closing_cost_amt": 12000,
        })
        resp = client.get(f"/api/properties/{pid}/results")
        assert resp.status_code == 200
        data = resp.json()
        assert data["expenses"]["breakdown"]["gross_receipts_tax"] > 0

    def test_tax_impact_display(self, client):
        resp = client.post("/api/properties", json={"name": "VT Tax", "listing_price": 400000, "annual_taxes": 6000})
        pid = resp.json()["id"]
        # Default assumptions have VT taxes (9% + 3% + 1% = 13%)
        client.post(f"/api/properties/{pid}/scenarios", json={
            "name": "Test", "purchase_price": 400000, "down_payment_pct": 25,
            "down_payment_amt": 100000, "interest_rate": 7.25, "loan_term_years": 30,
            "closing_cost_pct": 3, "closing_cost_amt": 12000,
        })
        resp = client.get(f"/api/properties/{pid}/results")
        assert resp.status_code == 200
        data = resp.json()
        assert data["tax_impact"] is not None
        assert data["tax_impact"]["guest_facing_tax_pct"] == 13.0
        assert data["tax_impact"]["platform_remits"] is True
