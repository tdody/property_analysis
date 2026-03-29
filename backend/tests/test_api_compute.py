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
