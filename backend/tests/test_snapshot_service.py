from app.services.snapshot import compute_diff


class TestComputeDiff:
    def test_detects_changed_numeric_field(self):
        old = {
            "scenario": {"interest_rate": 5.5},
            "assumptions": {},
            "results": {},
            "rental_type": "str",
        }
        new = {
            "scenario": {"interest_rate": 5.25},
            "assumptions": {},
            "results": {},
            "rental_type": "str",
        }
        diff = compute_diff(old, new)
        changed = [c for c in diff["changes"] if c["field"] == "scenario.interest_rate"]
        assert len(changed) == 1
        assert changed[0]["old_value"] == 5.5
        assert changed[0]["new_value"] == 5.25
        assert changed[0]["direction"] == "decreased"

    def test_ignores_unchanged_fields(self):
        state = {
            "scenario": {"interest_rate": 5.5, "loan_type": "conventional"},
            "assumptions": {},
            "results": {},
            "rental_type": "str",
        }
        diff = compute_diff(state, state)
        assert diff["total_changes"] == 0
        assert len(diff["changes"]) == 0

    def test_rental_type_mismatch(self):
        old = {
            "scenario": {},
            "assumptions": {"avg_nightly_rate": 200},
            "results": {},
            "rental_type": "str",
        }
        new = {
            "scenario": {},
            "assumptions": {"monthly_rent": 2000},
            "results": {},
            "rental_type": "ltr",
        }
        diff = compute_diff(old, new)
        assert diff["rental_type_changed"] is True
        assumption_changes = [
            c
            for c in diff["changes"]
            if c["category"] in ("Revenue & Occupancy", "Expenses")
        ]
        assert len(assumption_changes) == 0

    def test_currency_format_on_price_fields(self):
        old = {
            "scenario": {"purchase_price": 400000},
            "assumptions": {},
            "results": {},
            "rental_type": "str",
        }
        new = {
            "scenario": {"purchase_price": 425000},
            "assumptions": {},
            "results": {},
            "rental_type": "str",
        }
        diff = compute_diff(old, new)
        changed = [
            c for c in diff["changes"] if c["field"] == "scenario.purchase_price"
        ]
        assert changed[0]["format"] == "currency"
        assert changed[0]["direction"] == "increased"
