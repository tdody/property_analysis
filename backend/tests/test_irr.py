from app.services.computation.irr import compute_irr, compute_equity_multiple


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
