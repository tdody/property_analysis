class TestCreateProperty:
    def test_create_minimal(self, client):
        resp = client.post("/api/properties", json={"name": "Lake House"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Lake House"
        assert "id" in data

    def test_create_full(self, client):
        resp = client.post(
            "/api/properties",
            json={
                "name": "Mountain Cabin",
                "address": "123 Mountain Rd",
                "city": "Stowe",
                "state": "VT",
                "zip_code": "05672",
                "listing_price": 425000,
                "beds": 3,
                "baths": 2.5,
                "sqft": 1800,
                "property_type": "single_family",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["listing_price"] == 425000
        assert data["beds"] == 3


class TestListProperties:
    def test_list_empty(self, client):
        resp = client.get("/api/properties")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_with_properties(self, client):
        client.post("/api/properties", json={"name": "Prop 1"})
        client.post("/api/properties", json={"name": "Prop 2"})
        resp = client.get("/api/properties")
        assert len(resp.json()) == 2

    def test_list_excludes_archived(self, client):
        resp = client.post("/api/properties", json={"name": "Archived"})
        pid = resp.json()["id"]
        client.delete(f"/api/properties/{pid}")
        resp = client.get("/api/properties")
        assert len(resp.json()) == 0


class TestGetProperty:
    def test_get_existing(self, client):
        resp = client.post("/api/properties", json={"name": "Test"})
        pid = resp.json()["id"]
        resp = client.get(f"/api/properties/{pid}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test"

    def test_get_not_found(self, client):
        resp = client.get("/api/properties/nonexistent")
        assert resp.status_code == 404


class TestUpdateProperty:
    def test_update_fields(self, client):
        resp = client.post("/api/properties", json={"name": "Old Name"})
        pid = resp.json()["id"]
        resp = client.put(
            f"/api/properties/{pid}", json={"name": "New Name", "beds": 4}
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"
        assert resp.json()["beds"] == 4


class TestDeleteProperty:
    def test_soft_delete(self, client):
        resp = client.post("/api/properties", json={"name": "To Delete"})
        pid = resp.json()["id"]
        resp = client.delete(f"/api/properties/{pid}")
        assert resp.status_code == 200
        # Should not appear in list
        resp = client.get("/api/properties")
        assert len(resp.json()) == 0
