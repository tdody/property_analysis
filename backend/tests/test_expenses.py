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


class TestGrossReceiptsTax:
    def test_zero_tax(self):
        result = compute_operating_expenses(
            annual_turnovers=79, cleaning_cost_per_turn=120,
            net_annual_revenue=56_648, gross_annual_revenue=58_400,
            property_mgmt_pct=0, maintenance_reserve_pct=5,
            capex_reserve_pct=5, utilities_monthly=250,
            supplies_monthly=100, lawn_snow_monthly=0,
            other_monthly_expense=0, local_str_registration_fee=0,
            local_gross_receipts_tax_pct=0,
        )
        assert result.get("gross_receipts_tax", 0) == 0

    def test_burlington_nine_pct(self):
        result = compute_operating_expenses(
            annual_turnovers=79, cleaning_cost_per_turn=120,
            net_annual_revenue=56_648, gross_annual_revenue=58_400,
            property_mgmt_pct=0, maintenance_reserve_pct=5,
            capex_reserve_pct=5, utilities_monthly=250,
            supplies_monthly=100, lawn_snow_monthly=0,
            other_monthly_expense=0, local_str_registration_fee=0,
            local_gross_receipts_tax_pct=9.0,
        )
        expected_tax = 58_400 * 0.09
        assert abs(result["gross_receipts_tax"] - expected_tax) < 0.01
        # Verify the total includes the tax
        assert result["total_annual_operating_exp"] >= expected_tax


class TestDamageReserve:
    def test_default_two_pct(self):
        result = compute_operating_expenses(
            annual_turnovers=79, cleaning_cost_per_turn=120,
            net_annual_revenue=56_648, gross_annual_revenue=58_400,
            property_mgmt_pct=0, maintenance_reserve_pct=5,
            capex_reserve_pct=5, utilities_monthly=250,
            supplies_monthly=100, lawn_snow_monthly=0,
            other_monthly_expense=0, local_str_registration_fee=0,
            damage_reserve_pct=2.0,
        )
        expected = 58_400 * 0.02
        assert abs(result["damage_reserve"] - expected) < 0.01
        assert result["total_annual_operating_exp"] >= expected

    def test_zero_damage_reserve(self):
        result = compute_operating_expenses(
            annual_turnovers=79, cleaning_cost_per_turn=120,
            net_annual_revenue=56_648, gross_annual_revenue=58_400,
            property_mgmt_pct=0, maintenance_reserve_pct=5,
            capex_reserve_pct=5, utilities_monthly=250,
            supplies_monthly=100, lawn_snow_monthly=0,
            other_monthly_expense=0, local_str_registration_fee=0,
            damage_reserve_pct=0,
        )
        assert result["damage_reserve"] == 0

    def test_damage_reserve_included_in_total(self):
        without = compute_operating_expenses(
            annual_turnovers=50, cleaning_cost_per_turn=100,
            net_annual_revenue=50_000, gross_annual_revenue=52_000,
            property_mgmt_pct=0, maintenance_reserve_pct=0,
            capex_reserve_pct=0, utilities_monthly=0,
            supplies_monthly=0, lawn_snow_monthly=0,
            other_monthly_expense=0, local_str_registration_fee=0,
            damage_reserve_pct=0,
        )
        with_damage = compute_operating_expenses(
            annual_turnovers=50, cleaning_cost_per_turn=100,
            net_annual_revenue=50_000, gross_annual_revenue=52_000,
            property_mgmt_pct=0, maintenance_reserve_pct=0,
            capex_reserve_pct=0, utilities_monthly=0,
            supplies_monthly=0, lawn_snow_monthly=0,
            other_monthly_expense=0, local_str_registration_fee=0,
            damage_reserve_pct=5.0,
        )
        expected_diff = 52_000 * 0.05
        actual_diff = with_damage["total_annual_operating_exp"] - without["total_annual_operating_exp"]
        assert abs(actual_diff - expected_diff) < 0.01
