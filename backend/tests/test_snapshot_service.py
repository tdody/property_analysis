from app.services.snapshot import compute_diff


class TestComputeDiff:
    def test_detects_changed_numeric_field(self):
        old = {"scenario": {"interest_rate": 5.5}}
        new = {"scenario": {"interest_rate": 5.25}}
        diff = compute_diff(old, new)
        changed = [c for c in diff["changes"] if c["field"] == "scenario.interest_rate"]
        assert len(changed) == 1
        assert changed[0]["old_value"] == 5.5
        assert changed[0]["new_value"] == 5.25
        assert changed[0]["direction"] == "decreased"

    def test_ignores_unchanged_fields(self):
        state = {"scenario": {"interest_rate": 5.5, "loan_type": "conventional"}}
        diff = compute_diff(state, state)
        assert diff["total_changes"] == 0
        assert len(diff["changes"]) == 0

    def test_currency_format_on_price_fields(self):
        old = {"scenario": {"purchase_price": 400000}}
        new = {"scenario": {"purchase_price": 425000}}
        diff = compute_diff(old, new)
        changed = [
            c for c in diff["changes"] if c["field"] == "scenario.purchase_price"
        ]
        assert changed[0]["format"] == "currency"
        assert changed[0]["direction"] == "increased"

    def test_assumption_changes_ignored(self):
        """Assumption-level changes must not appear in a scenario-scoped diff."""
        old = {
            "scenario": {"interest_rate": 5.5},
            "assumptions": {"avg_nightly_rate": 200},
        }
        new = {
            "scenario": {"interest_rate": 5.5},
            "assumptions": {"avg_nightly_rate": 250},
        }
        diff = compute_diff(old, new)
        assert diff["total_changes"] == 0
