from app.services.computation.sensitivity import compute_sensitivity

class TestSensitivity:
    def test_occupancy_range(self):
        result = compute_sensitivity(avg_nightly_rate=200, base_occupancy_pct=65.0, cleaning_fee_per_stay=150, avg_stay_length_nights=3.0, platform_fee_pct=3.0, cleaning_cost_per_turn=120, property_mgmt_pct=0, maintenance_reserve_pct=5.0, capex_reserve_pct=5.0, fixed_opex_annual=4200, total_monthly_housing=2838.20)
        assert "occupancy_sweep" in result
        assert len(result["occupancy_sweep"]) > 0
        entry = result["occupancy_sweep"][0]
        assert "occupancy_pct" in entry
        assert "monthly_cashflow" in entry

    def test_rate_range(self):
        result = compute_sensitivity(avg_nightly_rate=200, base_occupancy_pct=65.0, cleaning_fee_per_stay=150, avg_stay_length_nights=3.0, platform_fee_pct=3.0, cleaning_cost_per_turn=120, property_mgmt_pct=0, maintenance_reserve_pct=5.0, capex_reserve_pct=5.0, fixed_opex_annual=4200, total_monthly_housing=2838.20)
        assert "rate_sweep" in result
        assert len(result["rate_sweep"]) > 0
        entry = result["rate_sweep"][0]
        assert "nightly_rate" in entry
        assert "monthly_cashflow" in entry
