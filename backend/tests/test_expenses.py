from app.services.computation.expenses import compute_operating_expenses

class TestOperatingExpenses:
    def test_full_expenses(self):
        result = compute_operating_expenses(
            annual_turnovers=79.0,
            cleaning_cost_per_turn=120,
            net_annual_revenue=56_648,
            gross_annual_revenue=58_400,
            property_mgmt_pct=0,
            maintenance_reserve_pct=5.0,
            capex_reserve_pct=5.0,
            utilities_monthly=250,
            supplies_monthly=100,
            lawn_snow_monthly=0,
            other_monthly_expense=0,
            local_str_registration_fee=0,
        )
        assert round(result["annual_cleaning_cost"], 2) == round(79.0 * 120, 2)
        assert round(result["maintenance_reserve"], 2) == round(58_400 * 0.05, 2)
        assert round(result["capex_reserve"], 2) == round(58_400 * 0.05, 2)
        assert result["utilities_annual"] == 3000
        assert result["supplies_annual"] == 1200
        assert result["property_mgmt_cost"] == 0
        assert result["total_annual_operating_exp"] > 0

    def test_with_management_fee(self):
        result = compute_operating_expenses(
            annual_turnovers=50,
            cleaning_cost_per_turn=100,
            net_annual_revenue=50_000,
            gross_annual_revenue=52_000,
            property_mgmt_pct=20.0,
            maintenance_reserve_pct=5.0,
            capex_reserve_pct=5.0,
            utilities_monthly=200,
            supplies_monthly=50,
            lawn_snow_monthly=100,
            other_monthly_expense=50,
            local_str_registration_fee=125,
        )
        assert round(result["property_mgmt_cost"], 2) == 10_000.0
        assert result["lawn_snow_annual"] == 1200
        assert result["other_annual"] == 600
        assert result["registration_annual"] == 125

    def test_all_zeros(self):
        result = compute_operating_expenses(
            annual_turnovers=0,
            cleaning_cost_per_turn=0,
            net_annual_revenue=0,
            gross_annual_revenue=0,
            property_mgmt_pct=0,
            maintenance_reserve_pct=0,
            capex_reserve_pct=0,
            utilities_monthly=0,
            supplies_monthly=0,
            lawn_snow_monthly=0,
            other_monthly_expense=0,
            local_str_registration_fee=0,
        )
        assert result["total_annual_operating_exp"] == 0
