from app.services.computation.irr import (
    compute_irr,
    compute_equity_multiple,
    compute_exit_proceeds,
    compute_irr_with_exit,
    compute_hold_period_sweep,
)


class TestIRR:
    def test_simple_irr(self):
        # -100K investment, 5 years of 25K = should be ~8%
        cashflows = [-100_000, 25_000, 25_000, 25_000, 25_000, 25_000]
        result = compute_irr(cashflows)
        assert result is not None
        assert 7.0 < result < 9.0

    def test_negative_irr(self):
        # -100K investment, 5 years of 15K = negative return
        cashflows = [-100_000, 15_000, 15_000, 15_000, 15_000, 15_000]
        result = compute_irr(cashflows)
        assert result is not None
        assert result < 0

    def test_zero_investment(self):
        cashflows = [0, 10_000, 10_000]
        result = compute_irr(cashflows)
        # With zero investment, IRR is undefined
        assert result is None or result is not None  # just shouldn't crash

    def test_all_negative(self):
        cashflows = [-100_000, -5_000, -5_000, -5_000, -5_000, -5_000]
        result = compute_irr(cashflows)
        # Should return None (no rate makes NPV = 0)
        assert result is None

    def test_empty_cashflows(self):
        assert compute_irr([]) is None
        assert compute_irr([-100_000]) is None

    def test_break_even(self):
        # -100K, then 20K x 5 = exactly break even
        cashflows = [-100_000, 20_000, 20_000, 20_000, 20_000, 20_000]
        result = compute_irr(cashflows)
        assert result is not None
        assert abs(result) < 1.0  # approximately 0%


class TestEquityMultiple:
    def test_positive_return(self):
        result = compute_equity_multiple(50_000, 125_000)
        assert abs(result - 0.4) < 0.01

    def test_zero_invested(self):
        assert compute_equity_multiple(50_000, 0) == 0

    def test_negative_cashflow(self):
        result = compute_equity_multiple(-10_000, 125_000)
        assert result < 0

    def test_double_return(self):
        result = compute_equity_multiple(250_000, 125_000)
        assert abs(result - 2.0) < 0.01


class TestExitProceeds:
    def test_standard_exit(self):
        result = compute_exit_proceeds(
            purchase_price=400_000,
            appreciation_pct=3.0,
            hold_years=5,
            selling_cost_pct=8.0,
            remaining_mortgage=280_000,
            total_depreciation=50_000,
            capital_gains_rate_pct=20.0,
            depreciation_recapture_rate_pct=25.0,
        )
        expected_sale = 400_000 * (1.03**5)
        assert abs(result["sale_price"] - expected_sale) < 0.01
        assert result["selling_costs"] > 0
        assert result["depreciation_recapture_tax"] == 50_000 * 0.25
        assert result["net_exit_proceeds"] > 0

    def test_zero_appreciation(self):
        result = compute_exit_proceeds(
            purchase_price=400_000,
            appreciation_pct=0.0,
            hold_years=5,
            selling_cost_pct=8.0,
            remaining_mortgage=280_000,
            total_depreciation=50_000,
            capital_gains_rate_pct=20.0,
            depreciation_recapture_rate_pct=25.0,
        )
        assert abs(result["sale_price"] - 400_000) < 0.01

    def test_zero_selling_costs(self):
        result = compute_exit_proceeds(
            purchase_price=400_000,
            appreciation_pct=3.0,
            hold_years=5,
            selling_cost_pct=0.0,
            remaining_mortgage=280_000,
            total_depreciation=50_000,
            capital_gains_rate_pct=20.0,
            depreciation_recapture_rate_pct=25.0,
        )
        assert result["selling_costs"] == 0

    def test_full_depreciation_recapture(self):
        result = compute_exit_proceeds(
            purchase_price=400_000,
            appreciation_pct=3.0,
            hold_years=5,
            selling_cost_pct=8.0,
            remaining_mortgage=280_000,
            total_depreciation=100_000,
            capital_gains_rate_pct=20.0,
            depreciation_recapture_rate_pct=25.0,
        )
        assert result["depreciation_recapture_tax"] == 100_000 * 0.25


class TestIRRWithExit:
    def test_irr_with_exit_greater_than_without(self):
        cashflows = [10_000, 10_000, 10_000, 10_000, 10_000]
        irr_no_exit = compute_irr([-100_000] + cashflows)
        irr_exit = compute_irr_with_exit(cashflows, 100_000, 120_000)
        assert irr_no_exit is not None
        assert irr_exit is not None
        assert irr_exit > irr_no_exit

    def test_cash_purchase_no_mortgage(self):
        cashflows = [20_000, 20_000, 20_000, 20_000, 20_000]
        irr_exit = compute_irr_with_exit(cashflows, 400_000, 350_000)
        assert irr_exit is not None
        assert irr_exit > 0

    def test_zero_appreciation_exit(self):
        # With zero appreciation and selling costs, exit proceeds may be low
        cashflows = [10_000, 10_000, 10_000, 10_000, 10_000]
        irr_exit = compute_irr_with_exit(cashflows, 100_000, 50_000)
        assert irr_exit is not None

    def test_empty_cashflows(self):
        assert compute_irr_with_exit([], 100_000, 50_000) is None


class TestHoldPeriodSweep:
    def test_returns_entries_for_3_to_15(self):
        cashflows_15 = [10_000 + i * 500 for i in range(15)]

        def get_mortgage(year: int) -> float:
            return max(0, 280_000 - year * 5_000)

        result = compute_hold_period_sweep(
            purchase_price=400_000,
            appreciation_pct=3.0,
            selling_cost_pct=8.0,
            total_cash_invested=120_000,
            depreciation_annual=10_000,
            capital_gains_rate_pct=20.0,
            depreciation_recapture_rate_pct=25.0,
            loan_amount=280_000,
            interest_rate=7.0,
            loan_term_years=30,
            annual_cashflows_15=cashflows_15,
            get_remaining_mortgage=get_mortgage,
        )
        assert len(result) == 13  # 3 through 15
        assert result[0]["hold_period"] == 3
        assert result[-1]["hold_period"] == 15

    def test_longer_holds_generally_increase_irr(self):
        cashflows_15 = [15_000 + i * 1_000 for i in range(15)]

        def get_mortgage(year: int) -> float:
            return max(0, 280_000 - year * 5_000)

        result = compute_hold_period_sweep(
            purchase_price=400_000,
            appreciation_pct=3.0,
            selling_cost_pct=8.0,
            total_cash_invested=120_000,
            depreciation_annual=10_000,
            capital_gains_rate_pct=20.0,
            depreciation_recapture_rate_pct=25.0,
            loan_amount=280_000,
            interest_rate=7.0,
            loan_term_years=30,
            annual_cashflows_15=cashflows_15,
            get_remaining_mortgage=get_mortgage,
        )
        # With 3% appreciation and growing cashflows, IRR should generally trend up
        irrs = [r["irr"] for r in result if r["irr"] is not None]
        assert len(irrs) > 5
        # At minimum, later periods should be >= earlier ones in this scenario
        assert irrs[-1] >= irrs[0]
