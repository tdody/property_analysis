import pytest
from app.services.computation.metrics import (
    compute_noi, compute_cashflow, compute_cash_on_cash_return,
    compute_cap_rate, compute_dscr, compute_gross_yield,
    compute_break_even_occupancy, compute_total_roi_year1, compute_all_metrics,
)

class TestNOI:
    def test_positive_noi(self):
        assert compute_noi(56_648, 27_748) == 56_648 - 27_748
    def test_negative_noi(self):
        assert compute_noi(10_000, 20_000) == -10_000

class TestCashflow:
    def test_positive_cashflow(self):
        result = compute_cashflow(noi=28_900, total_monthly_housing=2838.20)
        assert round(result["annual_cashflow"], 2) == round(28_900 - 2838.20 * 12, 2)
        assert round(result["monthly_cashflow"], 2) == round(result["annual_cashflow"] / 12, 2)
    def test_cash_purchase(self):
        result = compute_cashflow(noi=28_900, total_monthly_housing=0)
        assert result["annual_cashflow"] == 28_900

class TestCashOnCash:
    def test_positive_return(self):
        result = compute_cash_on_cash_return(9_877, 125_400)
        assert round(result, 2) == round(9_877 / 125_400 * 100, 2)
    def test_zero_invested(self):
        assert compute_cash_on_cash_return(5_000, 0) == 0

class TestCapRate:
    def test_basic(self):
        result = compute_cap_rate(28_900, 425_000)
        assert round(result, 2) == round(28_900 / 425_000 * 100, 2)

class TestDSCR:
    def test_above_one(self):
        assert compute_dscr(28_900, 2046.53 * 12) > 1.0
    def test_zero_debt_service(self):
        assert compute_dscr(28_900, 0) == 0

class TestGrossYield:
    def test_basic(self):
        result = compute_gross_yield(58_400, 425_000)
        assert round(result, 2) == round(58_400 / 425_000 * 100, 2)

class TestBreakEvenOccupancy:
    def test_typical_scenario(self):
        result = compute_break_even_occupancy(avg_nightly_rate=200, cleaning_fee_per_stay=150, avg_stay_length_nights=3.0, platform_fee_pct=3.0, cleaning_cost_per_turn=120, property_mgmt_pct=0, maintenance_reserve_pct=5.0, capex_reserve_pct=5.0, fixed_opex_annual=4200, total_monthly_housing=2838.20)
        assert 0 < result < 100
    def test_impossible_if_costs_exceed_max_revenue(self):
        result = compute_break_even_occupancy(avg_nightly_rate=50, cleaning_fee_per_stay=10, avg_stay_length_nights=3.0, platform_fee_pct=3.0, cleaning_cost_per_turn=120, property_mgmt_pct=25.0, maintenance_reserve_pct=5.0, capex_reserve_pct=5.0, fixed_opex_annual=30_000, total_monthly_housing=5000)
        assert result > 100

class TestTotalROI:
    def test_with_equity(self):
        result = compute_total_roi_year1(annual_cashflow=9_877, year1_equity_buildup=5_000, total_cash_invested=125_400)
        assert round(result, 2) == round((9_877 + 5_000) / 125_400 * 100, 2)
    def test_zero_invested(self):
        assert compute_total_roi_year1(9_877, 5_000, 0) == 0

class TestComputeAllMetrics:
    def test_integration(self):
        result = compute_all_metrics(net_annual_revenue=56_648, total_annual_operating_exp=27_748, monthly_pi=2046.53, total_cash_invested=125_400, purchase_price=425_000, gross_annual_revenue=58_400, year1_equity_buildup=5_000, avg_nightly_rate=200, cleaning_fee_per_stay=150, avg_stay_length_nights=3.0, platform_fee_pct=3.0, cleaning_cost_per_turn=120, property_mgmt_pct=0, maintenance_reserve_pct=5.0, capex_reserve_pct=5.0, fixed_opex_annual=4200, total_monthly_housing=2838.20)
        for key in ["monthly_cashflow", "annual_cashflow", "cash_on_cash_return", "cap_rate", "noi", "break_even_occupancy", "dscr", "gross_yield", "total_roi_year1"]:
            assert key in result
