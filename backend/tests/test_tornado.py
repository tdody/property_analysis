from app.services.computation.tornado import compute_tornado, compute_ltr_tornado

BASE_STR_PARAMS = dict(
    avg_nightly_rate=200.0,
    occupancy_pct=65.0,
    cleaning_fee_per_stay=150.0,
    avg_stay_length_nights=3.0,
    platform_fee_pct=3.0,
    cleaning_cost_per_turn=120.0,
    property_mgmt_pct=0.0,
    maintenance_reserve_pct=5.0,
    capex_reserve_pct=5.0,
    fixed_opex_annual=4200.0,
    total_monthly_housing=2838.20,
    total_cash_invested=80000.0,
    purchase_price=400000.0,
    monthly_pi=1900.0,
)

VALID_METRICS = ["monthly_cashflow", "cash_on_cash_return", "cap_rate"]

BASE_LTR_PARAMS = dict(
    monthly_rent=2000.0,
    pet_rent_monthly=50.0,
    late_fee_monthly=0.0,
    vacancy_rate_pct=5.0,
    property_mgmt_pct=8.0,
    maintenance_reserve_pct=5.0,
    capex_reserve_pct=5.0,
    fixed_opex_annual=6000.0,
    tenant_turnover_cost=2000.0,
    lease_duration_months=12,
    total_monthly_housing=1800.0,
    total_cash_invested=60000.0,
    purchase_price=300000.0,
)


class TestSTRTornado:
    def test_returns_required_keys(self):
        result = compute_tornado(metric_key="monthly_cashflow", **BASE_STR_PARAMS)
        assert "metric_key" in result
        assert "metric_label" in result
        assert "baseline_value" in result
        assert "bars" in result
        assert result["metric_key"] == "monthly_cashflow"

    def test_bars_sorted_by_spread_descending(self):
        result = compute_tornado(metric_key="monthly_cashflow", **BASE_STR_PARAMS)
        bars = result["bars"]
        assert len(bars) > 0
        spreads = [b["spread"] for b in bars]
        assert spreads == sorted(spreads, reverse=True)

    def test_each_bar_has_required_fields(self):
        result = compute_tornado(metric_key="monthly_cashflow", **BASE_STR_PARAMS)
        for bar in result["bars"]:
            assert "variable_name" in bar
            assert "variable_label" in bar
            assert "baseline_input" in bar
            assert "low_input" in bar
            assert "high_input" in bar
            assert "low_output" in bar
            assert "high_output" in bar
            assert "spread" in bar
            assert "sweep" in bar
            assert len(bar["sweep"]) >= 2

    def test_sweep_points_cover_range(self):
        result = compute_tornado(metric_key="monthly_cashflow", **BASE_STR_PARAMS)
        bar = result["bars"][0]
        inputs = [p["input_value"] for p in bar["sweep"]]
        assert min(inputs) <= bar["low_input"] + 0.01
        assert max(inputs) >= bar["high_input"] - 0.01

    def test_spread_is_absolute_difference(self):
        result = compute_tornado(metric_key="monthly_cashflow", **BASE_STR_PARAMS)
        for bar in result["bars"]:
            expected_spread = abs(bar["high_output"] - bar["low_output"])
            assert abs(bar["spread"] - expected_spread) < 0.01

    def test_all_three_metrics_work(self):
        for metric in VALID_METRICS:
            result = compute_tornado(metric_key=metric, **BASE_STR_PARAMS)
            assert result["metric_key"] == metric
            assert len(result["bars"]) > 0

    def test_baseline_value_is_finite(self):
        result = compute_tornado(metric_key="monthly_cashflow", **BASE_STR_PARAMS)
        assert isinstance(result["baseline_value"], float)

    def test_invalid_metric_raises(self):
        import pytest

        with pytest.raises(ValueError):
            compute_tornado(metric_key="invalid_metric", **BASE_STR_PARAMS)

    def test_occupancy_capped_at_100(self):
        """If baseline occupancy is 90%, high should not exceed 100."""
        params = {**BASE_STR_PARAMS, "occupancy_pct": 90.0}
        result = compute_tornado(metric_key="monthly_cashflow", **params)
        occ_bar = next(
            b for b in result["bars"] if b["variable_name"] == "occupancy_pct"
        )
        assert occ_bar["high_input"] <= 100.0

    def test_str_variable_count(self):
        result = compute_tornado(metric_key="monthly_cashflow", **BASE_STR_PARAMS)
        assert len(result["bars"]) == 8


class TestLTRTornado:
    def test_returns_required_keys(self):
        result = compute_ltr_tornado(metric_key="monthly_cashflow", **BASE_LTR_PARAMS)
        assert result["metric_key"] == "monthly_cashflow"
        assert "baseline_value" in result
        assert "bars" in result

    def test_bars_sorted_by_spread_descending(self):
        result = compute_ltr_tornado(metric_key="monthly_cashflow", **BASE_LTR_PARAMS)
        spreads = [b["spread"] for b in result["bars"]]
        assert spreads == sorted(spreads, reverse=True)

    def test_all_three_metrics_work(self):
        for metric in VALID_METRICS:
            result = compute_ltr_tornado(metric_key=metric, **BASE_LTR_PARAMS)
            assert result["metric_key"] == metric
            assert len(result["bars"]) > 0

    def test_ltr_variable_count(self):
        result = compute_ltr_tornado(metric_key="monthly_cashflow", **BASE_LTR_PARAMS)
        assert len(result["bars"]) == 6
