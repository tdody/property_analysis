import pytest


@pytest.fixture
def property_id(client):
    resp = client.post(
        "/api/properties", json={"name": "Test", "listing_price": 400000}
    )
    return resp.json()["id"]


class TestScenarioCRUD:
    def test_create_scenario(self, client, property_id):
        resp = client.post(
            f"/api/properties/{property_id}/scenarios",
            json={
                "name": "30yr Conventional",
                "purchase_price": 400000,
                "down_payment_pct": 25.0,
                "down_payment_amt": 100000,
                "interest_rate": 7.25,
            },
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "30yr Conventional"

    def test_list_scenarios(self, client, property_id):
        client.post(f"/api/properties/{property_id}/scenarios", json={"name": "S1"})
        client.post(f"/api/properties/{property_id}/scenarios", json={"name": "S2"})
        resp = client.get(f"/api/properties/{property_id}/scenarios")
        assert len(resp.json()) == 2

    def test_update_scenario(self, client, property_id):
        resp = client.post(
            f"/api/properties/{property_id}/scenarios", json={"name": "Old"}
        )
        sid = resp.json()["id"]
        resp = client.put(
            f"/api/properties/{property_id}/scenarios/{sid}",
            json={"name": "New", "interest_rate": 6.5},
        )
        assert resp.json()["name"] == "New"
        assert resp.json()["interest_rate"] == 6.5

    def test_delete_scenario(self, client, property_id):
        resp = client.post(
            f"/api/properties/{property_id}/scenarios", json={"name": "Del"}
        )
        sid = resp.json()["id"]
        resp = client.delete(f"/api/properties/{property_id}/scenarios/{sid}")
        assert resp.status_code == 200
        resp = client.get(f"/api/properties/{property_id}/scenarios")
        assert len(resp.json()) == 0

    def test_duplicate_scenario(self, client, property_id):
        resp = client.post(
            f"/api/properties/{property_id}/scenarios",
            json={
                "name": "Original",
                "purchase_price": 400000,
                "interest_rate": 7.0,
            },
        )
        sid = resp.json()["id"]
        resp = client.post(f"/api/properties/{property_id}/scenarios/{sid}/duplicate")
        assert resp.status_code == 201
        assert resp.json()["name"] == "Original (copy)"
        assert resp.json()["purchase_price"] == 400000

    def test_activate_scenario(self, client, property_id):
        client.post(
            f"/api/properties/{property_id}/scenarios",
            json={"name": "S1", "is_active": True},
        )
        r2 = client.post(
            f"/api/properties/{property_id}/scenarios",
            json={"name": "S2", "is_active": False},
        )
        sid2 = r2.json()["id"]
        client.put(f"/api/properties/{property_id}/scenarios/{sid2}/activate")
        scenarios = client.get(f"/api/properties/{property_id}/scenarios").json()
        active = [s for s in scenarios if s["is_active"]]
        assert len(active) == 1
        assert active[0]["id"] == sid2
