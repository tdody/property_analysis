from typing import Any

from app.services.computation.projections import compute_five_year_projection


def _base_projection(**overrides: Any) -> list[dict[str, Any]]:
    defaults: dict[str, Any] = dict(
        year1_gross_revenue=58_400,
        year1_net_revenue=56_648,
        year1_opex=27_748,
        year1_cashflow=-5_158.40,
        steady_state_gross_revenue=58_400,
        steady_state_net_revenue=56_648,
        steady_state_opex=27_748,
        revenue_growth_pct=3.0,
        expense_growth_pct=3.0,
        total_monthly_housing=2838.20,
        monthly_pi=2046.53,
        purchase_price=425_000,
        appreciation_pct=2.5,
        loan_amount=300_000,
        interest_rate=7.25,
        loan_term_years=30,
        total_cash_invested=125_400,
        platform_fee_pct=3.0,
    )
    defaults.update(overrides)
    return compute_five_year_projection(**defaults)


class TestYear1MatchesInputs:
    def test_year1_values(self):
        years = _base_projection()
        y1 = years[0]
        assert y1["year"] == 1
        assert y1["gross_revenue"] == 58_400
        assert y1["net_revenue"] == 56_648
        assert y1["total_opex"] == 27_748
        assert y1["annual_cashflow"] == -5_158.40


class TestGrowthCompoundsFromSteadyState:
    def test_year2_uses_steady_state_base(self):
        years = _base_projection(
            year1_gross_revenue=48_667,  # delay-adjusted (lower)
            steady_state_gross_revenue=58_400,
            revenue_growth_pct=3.0,
        )
        y2 = years[1]
        expected_gross = 58_400 * 1.03
        assert abs(y2["gross_revenue"] - expected_gross) < 0.01

    def test_year3_compounds(self):
        years = _base_projection(revenue_growth_pct=5.0)
        y3 = years[2]
        expected = 58_400 * 1.05**2
        assert abs(y3["gross_revenue"] - expected) < 0.01

    def test_year5_compounds(self):
        years = _base_projection(revenue_growth_pct=3.0)
        y5 = years[4]
        expected = 58_400 * 1.03**4
        assert abs(y5["gross_revenue"] - expected) < 0.01

    def test_expense_growth_separate(self):
        years = _base_projection(revenue_growth_pct=3.0, expense_growth_pct=5.0)
        y2 = years[1]
        assert abs(y2["gross_revenue"] - 58_400 * 1.03) < 0.01
        assert abs(y2["total_opex"] - 27_748 * 1.05) < 0.01


class TestCumulativeCashflow:
    def test_cumulative_sums(self):
        years = _base_projection()
        running = 0
        for y in years:
            running += y["annual_cashflow"]
            assert abs(y["cumulative_cashflow"] - running) < 0.01

    def test_negative_cashflow_cumulates(self):
        years = _base_projection(
            year1_cashflow=-10_000,
            steady_state_gross_revenue=20_000,
            steady_state_net_revenue=19_400,
            steady_state_opex=30_000,
            total_monthly_housing=2838.20,
        )
        # All years should have negative cashflow
        for y in years:
            assert y["annual_cashflow"] < 0
        # Cumulative should get more negative
        assert years[4]["cumulative_cashflow"] < years[0]["cumulative_cashflow"]


class TestZeroGrowth:
    def test_flat_values(self):
        years = _base_projection(
            revenue_growth_pct=0,
            expense_growth_pct=0,
        )
        for y in years[1:]:
            assert abs(y["gross_revenue"] - 58_400) < 0.01
            assert abs(y["total_opex"] - 27_748) < 0.01


class TestEquity:
    def test_equity_equals_value_minus_balance(self):
        years = _base_projection()
        for y in years:
            assert abs(y["equity"] - (y["property_value"] - y["loan_balance"])) < 0.01

    def test_property_value_appreciates(self):
        years = _base_projection(appreciation_pct=2.5)
        for i in range(1, 5):
            assert years[i]["property_value"] > years[i - 1]["property_value"]

    def test_loan_balance_decreases(self):
        years = _base_projection()
        for i in range(1, 5):
            assert years[i]["loan_balance"] < years[i - 1]["loan_balance"]


class TestCashPurchase:
    def test_zero_debt(self):
        years = _base_projection(
            loan_amount=0,
            interest_rate=0,
            loan_term_years=0,
            monthly_pi=0,
            total_monthly_housing=500,  # just taxes/insurance
        )
        for y in years:
            assert y["loan_balance"] == 0
            assert y["annual_housing_cost"] == 6000


class TestZeroCashInvested:
    def test_coc_zero(self):
        years = _base_projection(total_cash_invested=0)
        for y in years:
            assert y["cash_on_cash_return"] == 0


class TestOutputLength:
    def test_returns_five_years(self):
        years = _base_projection()
        assert len(years) == 5
        assert [y["year"] for y in years] == [1, 2, 3, 4, 5]


class TestProjectionLength:
    def test_default_returns_five_years(self):
        years = _base_projection()
        assert len(years) == 5

    def test_seven_years(self):
        years = _base_projection(num_years=7)
        assert len(years) == 7
        assert [y["year"] for y in years] == [1, 2, 3, 4, 5, 6, 7]

    def test_three_years(self):
        years = _base_projection(num_years=3)
        assert len(years) == 3
        assert [y["year"] for y in years] == [1, 2, 3]

    def test_ten_years_growth_compounds(self):
        years = _base_projection(num_years=10, revenue_growth_pct=3.0)
        y10 = years[9]
        expected = 58_400 * 1.03**9
        assert abs(y10["gross_revenue"] - expected) < 0.01


class TestAfterTaxProjections:
    def test_zero_tax_rate_equals_pretax(self):
        years = _base_projection(
            marginal_tax_rate_pct=0, total_depreciation_annual=12_000
        )
        for y in years:
            assert abs(y["after_tax_cashflow"] - y["annual_cashflow"]) < 0.01

    def test_interest_decreases_over_time(self):
        years = _base_projection(
            marginal_tax_rate_pct=32.0, total_depreciation_annual=12_000
        )
        # With decreasing interest, taxable income rises, so after-tax cashflow
        # should decrease relative to pre-tax over time (more tax owed)
        diff_y1 = years[0]["annual_cashflow"] - years[0]["after_tax_cashflow"]
        diff_y5 = years[4]["annual_cashflow"] - years[4]["after_tax_cashflow"]
        # Year 5 should owe more tax (or save less) than Year 1
        # because interest deduction is smaller
        assert diff_y5 > diff_y1 or abs(diff_y5 - diff_y1) < 1

    def test_cash_purchase_after_tax(self):
        years = _base_projection(
            loan_amount=0,
            interest_rate=0,
            loan_term_years=0,
            monthly_pi=0,
            total_monthly_housing=500,
            marginal_tax_rate_pct=25.0,
            total_depreciation_annual=12_000,
        )
        for y in years:
            # No interest deduction, only depreciation
            assert "after_tax_cashflow" in y
            assert (
                y["after_tax_cashflow"] != y["annual_cashflow"]
            )  # depreciation affects tax
