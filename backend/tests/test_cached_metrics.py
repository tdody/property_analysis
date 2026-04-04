from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_dashboard_uses_cached_metrics():
    """Dashboard should return cached metrics without recomputing."""
    resp = client.post("/api/properties", json={"name": "Cache Test"})
    assert resp.status_code == 201
    pid = resp.json()["id"]

    resp = client.get("/api/properties")
    prop = next(p for p in resp.json() if p["id"] == pid)
    assert prop["monthly_cashflow"] is None

    client.post(f"/api/properties/{pid}/scenarios", json={
        "name": "Test", "purchase_price": 300000, "down_payment_amt": 75000,
        "closing_cost_amt": 9000,
    })
    resp = client.get(f"/api/properties/{pid}/results")
    assert resp.status_code == 200

    resp = client.get("/api/properties")
    prop = next(p for p in resp.json() if p["id"] == pid)
    assert prop["monthly_cashflow"] is not None
