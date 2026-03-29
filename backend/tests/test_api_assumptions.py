import pytest


@pytest.fixture
def property_id(client):
    resp = client.post("/api/properties", json={"name": "Test", "listing_price": 400000})
    return resp.json()["id"]


class TestAssumptions:
    def test_get_default_assumptions(self, client, property_id):
        resp = client.get(f"/api/properties/{property_id}/assumptions")
        assert resp.status_code == 200
        data = resp.json()
        assert data["occupancy_pct"] == 65.0
        assert data["platform_fee_pct"] == 3.0
        assert data["insurance_annual"] == 2500

    def test_update_assumptions(self, client, property_id):
        resp = client.put(f"/api/properties/{property_id}/assumptions", json={
            "avg_nightly_rate": 250,
            "occupancy_pct": 70.0,
        })
        assert resp.status_code == 200
        assert resp.json()["avg_nightly_rate"] == 250
        assert resp.json()["occupancy_pct"] == 70.0
