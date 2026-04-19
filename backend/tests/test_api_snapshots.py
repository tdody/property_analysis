import pytest


@pytest.fixture
def property_id(client):
    resp = client.post(
        "/api/properties", json={"name": "Test", "listing_price": 400000}
    )
    return resp.json()["id"]


@pytest.fixture
def scenario_id(client, property_id):
    resp = client.post(
        f"/api/properties/{property_id}/scenarios",
        json={
            "name": "Test Scenario",
            "purchase_price": 400000,
            "down_payment_pct": 25.0,
            "down_payment_amt": 100000,
            "interest_rate": 7.25,
        },
    )
    return resp.json()["id"]


def _snap_url(property_id, scenario_id):
    return f"/api/properties/{property_id}/scenarios/{scenario_id}/snapshots"


class TestSnapshotCRUD:
    def test_create_snapshot(self, client, property_id, scenario_id):
        resp = client.post(
            _snap_url(property_id, scenario_id), json={"name": "Initial"}
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Initial"
        assert "scenario_id" in resp.json()

    def test_create_snapshot_auto_name(self, client, property_id, scenario_id):
        resp = client.post(_snap_url(property_id, scenario_id), json={})
        assert resp.status_code == 201
        assert resp.json()["name"].startswith("Snapshot #")

    def test_list_snapshots(self, client, property_id, scenario_id):
        client.post(_snap_url(property_id, scenario_id), json={"name": "S1"})
        client.post(_snap_url(property_id, scenario_id), json={"name": "S2"})
        resp = client.get(_snap_url(property_id, scenario_id))
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_get_snapshot(self, client, property_id, scenario_id):
        create_resp = client.post(
            _snap_url(property_id, scenario_id), json={"name": "Detail"}
        )
        snap_id = create_resp.json()["id"]
        resp = client.get(f"{_snap_url(property_id, scenario_id)}/{snap_id}")
        assert resp.status_code == 200
        assert "snapshot_data" in resp.json()

    def test_delete_snapshot(self, client, property_id, scenario_id):
        create_resp = client.post(
            _snap_url(property_id, scenario_id), json={"name": "Del"}
        )
        snap_id = create_resp.json()["id"]
        resp = client.delete(f"{_snap_url(property_id, scenario_id)}/{snap_id}")
        assert resp.status_code == 200
        listing = client.get(_snap_url(property_id, scenario_id))
        assert len(listing.json()) == 0

    def test_snapshot_cap_at_20(self, client, property_id, scenario_id):
        for i in range(20):
            resp = client.post(
                _snap_url(property_id, scenario_id), json={"name": f"S{i}"}
            )
            assert resp.status_code == 201
        resp = client.post(
            _snap_url(property_id, scenario_id), json={"name": "Over limit"}
        )
        assert resp.status_code == 400

    def test_restore_at_cap_allows_21st(self, client, property_id, scenario_id):
        """Restore at 20-snapshot cap should allow auto-snapshot as 21st entry."""
        for i in range(20):
            client.post(_snap_url(property_id, scenario_id), json={"name": f"S{i}"})
        resp = client.post(_snap_url(property_id, scenario_id), json={"name": "Over"})
        assert resp.status_code == 400
        snaps = client.get(_snap_url(property_id, scenario_id)).json()
        snap_id = snaps[-1]["id"]
        resp = client.post(f"{_snap_url(property_id, scenario_id)}/{snap_id}/restore")
        assert resp.status_code == 200
        snaps = client.get(_snap_url(property_id, scenario_id)).json()
        assert len(snaps) == 21

    def test_diff_snapshot(self, client, property_id, scenario_id):
        client.post(_snap_url(property_id, scenario_id), json={"name": "Before"})
        client.put(
            f"/api/properties/{property_id}/scenarios/{scenario_id}",
            json={"interest_rate": 6.0},
        )
        listing = client.get(_snap_url(property_id, scenario_id)).json()
        snap_id = listing[0]["id"]
        resp = client.get(f"{_snap_url(property_id, scenario_id)}/{snap_id}/diff")
        assert resp.status_code == 200
        assert resp.json()["total_changes"] > 0

    def test_restore_snapshot(self, client, property_id, scenario_id):
        client.post(_snap_url(property_id, scenario_id), json={"name": "Original"})
        client.put(
            f"/api/properties/{property_id}/scenarios/{scenario_id}",
            json={"interest_rate": 6.0},
        )
        listing = client.get(_snap_url(property_id, scenario_id)).json()
        snap_id = listing[0]["id"]
        resp = client.post(f"{_snap_url(property_id, scenario_id)}/{snap_id}/restore")
        assert resp.status_code == 200
        scenario = client.get(f"/api/properties/{property_id}/scenarios").json()
        restored = [s for s in scenario if s["id"] == scenario_id][0]
        assert restored["interest_rate"] == 7.25
        snaps = client.get(_snap_url(property_id, scenario_id)).json()
        auto_names = [
            s["name"] for s in snaps if s["name"].startswith("Before restore")
        ]
        assert len(auto_names) == 1

    def test_cascade_delete(self, client, property_id, scenario_id):
        client.post(_snap_url(property_id, scenario_id), json={"name": "Cascade"})
        client.delete(f"/api/properties/{property_id}/scenarios/{scenario_id}")
        scenarios = client.get(f"/api/properties/{property_id}/scenarios").json()
        assert len(scenarios) == 0

    def test_restore_does_not_touch_assumptions(self, client, property_id, scenario_id):
        """Restoring a scenario snapshot must leave property-wide assumptions alone."""
        client.put(
            f"/api/properties/{property_id}/assumptions",
            json={"avg_nightly_rate": 250.0},
        )
        client.post(_snap_url(property_id, scenario_id), json={"name": "Base"})
        client.put(
            f"/api/properties/{property_id}/assumptions",
            json={"avg_nightly_rate": 500.0},
        )
        client.put(
            f"/api/properties/{property_id}/scenarios/{scenario_id}",
            json={"interest_rate": 6.0},
        )
        snap_id = client.get(_snap_url(property_id, scenario_id)).json()[0]["id"]
        resp = client.post(f"{_snap_url(property_id, scenario_id)}/{snap_id}/restore")
        assert resp.status_code == 200
        assumptions = client.get(f"/api/properties/{property_id}/assumptions").json()
        assert assumptions["avg_nightly_rate"] == 500.0
