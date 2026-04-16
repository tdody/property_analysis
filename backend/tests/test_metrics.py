from app.services.computation.metrics import (
    compute_noi,
    compute_cashflow,
    compute_cash_on_cash_return,
    compute_cap_rate,
    compute_dscr,
    compute_gross_yield,
    compute_break_even_occupancy,
    compute_total_roi_year1,
    compute_all_metrics,
    compute_delay_carrying_costs,
    compute_appreciation_year1,
    compute_total_roi_year1_with_appreciation,
    compute_tax_analysis,
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
        assert round(result["monthly_cashflow"], 2) == round(
            result["annual_cashflow"] / 12, 2
        )

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
        result = compute_break_even_occupancy(
            avg_nightly_rate=200,
            cleaning_fee_per_stay=150,
            avg_stay_length_nights=3.0,
            platform_fee_pct=3.0,
            cleaning_cost_per_turn=120,
            property_mgmt_pct=0,
            maintenance_reserve_pct=5.0,
            capex_reserve_pct=5.0,
            fixed_opex_annual=4200,
            total_monthly_housing=2838.20,
        )
        assert 0 < result < 100

    def test_impossible_if_costs_exceed_max_revenue(self):
        result = compute_break_even_occupancy(
            avg_nightly_rate=50,
            cleaning_fee_per_stay=10,
            avg_stay_length_nights=3.0,
            platform_fee_pct=3.0,
            cleaning_cost_per_turn=120,
            property_mgmt_pct=25.0,
            maintenance_reserve_pct=5.0,
            capex_reserve_pct=5.0,
            fixed_opex_annual=30_000,
            total_monthly_housing=5000,
        )
        assert result > 100


class TestTotalROI:
    def test_with_equity(self):
        result = compute_total_roi_year1(
            annual_cashflow=9_877,
            year1_equity_buildup=5_000,
            total_cash_invested=125_400,
        )
        assert round(result, 2) == round((9_877 + 5_000) / 125_400 * 100, 2)

    def test_zero_invested(self):
        assert compute_total_roi_year1(9_877, 5_000, 0) == 0


class TestRentalDelayMetrics:
    def test_delay_carrying_costs(self):
        result = compute_delay_carrying_costs(
            total_monthly_housing=2500,
            rental_delay_months=2,
        )
        assert result == 5000  # 2 months * $2500/mo

    def test_zero_delay_no_carrying_costs(self):
        result = compute_delay_carrying_costs(
            total_monthly_housing=2500,
            rental_delay_months=0,
        )
        assert result == 0


class TestAppreciation:
    def test_standard_appreciation(self):
        result = compute_appreciation_year1(425_000, 2.5)
        assert result == 10_625

    def test_zero_appreciation(self):
        result = compute_appreciation_year1(425_000, 0)
        assert result == 0

    def test_high_appreciation(self):
        result = compute_appreciation_year1(400_000, 5.0)
        assert result == 20_000


class TestROIWithAppreciation:
    def test_with_appreciation(self):
        result = compute_total_roi_year1_with_appreciation(
            annual_cashflow=9_877,
            year1_equity=5_000,
            year1_appreciation=10_625,
            total_cash=125_400,
        )
        expected = (9_877 + 5_000 + 10_625) / 125_400 * 100
        assert round(result, 2) == round(expected, 2)

    def test_zero_cash_invested(self):
        result = compute_total_roi_year1_with_appreciation(9_877, 5_000, 10_625, 0)
        assert result == 0

    def test_zero_appreciation(self):
        result = compute_total_roi_year1_with_appreciation(
            annual_cashflow=9_877,
            year1_equity=5_000,
            year1_appreciation=0,
            total_cash=125_400,
        )
        # Should match regular ROI when appreciation is 0
        expected = (9_877 + 5_000) / 125_400 * 100
        assert round(result, 2) == round(expected, 2)


class TestTaxAnalysis:
    def test_positive_taxable_income(self):
        result = compute_tax_analysis(
            noi=30_000,
            annual_mortgage_interest=20_000,
            total_depreciation_annual=5_000,
            marginal_tax_rate_pct=32.0,
            pre_tax_annual_cashflow=10_000,
        )
        assert result["taxable_income"] == 5_000
        assert abs(result["tax_liability"] - 1_600) < 0.01
        assert abs(result["after_tax_annual_cashflow"] - 8_400) < 0.01

    def test_paper_loss_tax_savings(self):
        result = compute_tax_analysis(
            noi=20_000,
            annual_mortgage_interest=20_000,
            total_depreciation_annual=15_000,
            marginal_tax_rate_pct=32.0,
            pre_tax_annual_cashflow=5_000,
        )
        assert result["taxable_income"] == -15_000
        assert result["tax_liability"] < 0  # tax savings
        assert abs(result["tax_liability"] - (-4_800)) < 0.01
        # After-tax exceeds pre-tax due to paper loss
        assert result["after_tax_annual_cashflow"] > 5_000
        assert abs(result["after_tax_annual_cashflow"] - 9_800) < 0.01

    def test_zero_tax_rate(self):
        result = compute_tax_analysis(
            noi=30_000,
            annual_mortgage_interest=20_000,
            total_depreciation_annual=5_000,
            marginal_tax_rate_pct=0,
            pre_tax_annual_cashflow=10_000,
        )
        assert result["tax_liability"] == 0
        assert result["after_tax_annual_cashflow"] == 10_000

    def test_cash_purchase_no_interest(self):
        result = compute_tax_analysis(
            noi=30_000,
            annual_mortgage_interest=0,
            total_depreciation_annual=12_000,
            marginal_tax_rate_pct=25.0,
            pre_tax_annual_cashflow=30_000,
        )
        assert result["taxable_income"] == 18_000
        assert abs(result["tax_liability"] - 4_500) < 0.01

    def test_after_tax_monthly_is_annual_div_12(self):
        result = compute_tax_analysis(
            noi=30_000,
            annual_mortgage_interest=20_000,
            total_depreciation_annual=5_000,
            marginal_tax_rate_pct=32.0,
            pre_tax_annual_cashflow=10_000,
        )
        assert (
            abs(
                result["after_tax_monthly_cashflow"]
                - result["after_tax_annual_cashflow"] / 12
            )
            < 0.01
        )


class TestComputeAllMetrics:
    def test_integration(self):
        result = compute_all_metrics(
            net_annual_revenue=56_648,
            total_annual_operating_exp=27_748,
            monthly_pi=2046.53,
            total_cash_invested=125_400,
            purchase_price=425_000,
            gross_annual_revenue=58_400,
            year1_equity_buildup=5_000,
            avg_nightly_rate=200,
            cleaning_fee_per_stay=150,
            avg_stay_length_nights=3.0,
            platform_fee_pct=3.0,
            cleaning_cost_per_turn=120,
            property_mgmt_pct=0,
            maintenance_reserve_pct=5.0,
            capex_reserve_pct=5.0,
            fixed_opex_annual=4200,
            total_monthly_housing=2838.20,
        )
        for key in [
            "monthly_cashflow",
            "annual_cashflow",
            "cash_on_cash_return",
            "cap_rate",
            "noi",
            "break_even_occupancy",
            "dscr",
            "gross_yield",
            "total_roi_year1",
        ]:
            assert key in result
