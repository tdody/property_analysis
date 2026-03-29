import pytest
from app.services.computation.mortgage import (
    compute_monthly_pi,
    compute_loan_amount,
    compute_pmi,
    compute_total_monthly_housing,
    compute_total_cash_invested,
    compute_amortization_schedule,
)


class TestLoanAmount:
    def test_standard_down_payment(self):
        assert compute_loan_amount(400_000, 100_000) == 300_000

    def test_zero_down(self):
        assert compute_loan_amount(400_000, 0) == 400_000

    def test_cash_purchase(self):
        assert compute_loan_amount(400_000, 400_000) == 0


class TestMonthlyPI:
    def test_30yr_conventional(self):
        result = compute_monthly_pi(300_000, 7.25, 30)
        assert round(result, 2) == 2046.53

    def test_15yr_conventional(self):
        result = compute_monthly_pi(300_000, 7.25, 15)
        assert round(result, 2) == 2738.59

    def test_cash_purchase_no_loan(self):
        result = compute_monthly_pi(0, 7.25, 30)
        assert result == 0

    def test_zero_interest(self):
        result = compute_monthly_pi(300_000, 0, 30)
        assert round(result, 2) == round(300_000 / 360, 2)


class TestPMI:
    def test_pmi_under_20_pct(self):
        result = compute_pmi(360_000, "conventional", 10.0, pmi_override=None)
        assert round(result, 2) == 150.00

    def test_no_pmi_20_pct_down(self):
        result = compute_pmi(300_000, "conventional", 20.0, pmi_override=None)
        assert result == 0

    def test_no_pmi_25_pct_down(self):
        result = compute_pmi(300_000, "conventional", 25.0, pmi_override=None)
        assert result == 0

    def test_no_pmi_for_dscr(self):
        result = compute_pmi(360_000, "dscr", 10.0, pmi_override=None)
        assert result == 0

    def test_no_pmi_for_cash(self):
        result = compute_pmi(0, "cash", 100.0, pmi_override=None)
        assert result == 0

    def test_pmi_override(self):
        result = compute_pmi(360_000, "conventional", 10.0, pmi_override=200.0)
        assert result == 200.0


class TestTotalMonthlyHousing:
    def test_all_components(self):
        result = compute_total_monthly_housing(
            monthly_pi=2046.53, monthly_pmi=150.0,
            annual_taxes=6000, insurance_annual=2500,
            hoa_monthly=100, nonhomestead_annual_taxes=None,
        )
        expected = 2046.53 + 150.0 + 500.0 + 208.33 + 100.0
        assert round(result, 2) == round(expected, 2)

    def test_nonhomestead_taxes_override(self):
        result = compute_total_monthly_housing(
            monthly_pi=2046.53, monthly_pmi=0,
            annual_taxes=5000, insurance_annual=2500,
            hoa_monthly=0, nonhomestead_annual_taxes=7000,
        )
        expected = 2046.53 + 0 + 7000 / 12 + 2500 / 12 + 0
        assert round(result, 2) == round(expected, 2)


class TestTotalCashInvested:
    def test_all_costs(self):
        result = compute_total_cash_invested(
            down_payment_amt=100_000, closing_cost_amt=12_000,
            renovation_cost=20_000, furniture_cost=15_000, other_upfront_costs=3_000,
        )
        assert result == 150_000


class TestAmortizationSchedule:
    def test_schedule_length(self):
        schedule = compute_amortization_schedule(300_000, 7.25, 30)
        assert len(schedule) == 360

    def test_first_payment_split(self):
        schedule = compute_amortization_schedule(300_000, 7.25, 30)
        first = schedule[0]
        monthly_rate = 7.25 / 100 / 12
        expected_interest = 300_000 * monthly_rate
        assert round(first["interest"], 2) == round(expected_interest, 2)
        assert round(first["principal"] + first["interest"], 2) == round(2046.53, 2)

    def test_final_balance_zero(self):
        schedule = compute_amortization_schedule(300_000, 7.25, 30)
        assert round(schedule[-1]["remaining_balance"], 2) == 0

    def test_year1_equity_buildup(self):
        schedule = compute_amortization_schedule(300_000, 7.25, 30)
        year1_principal = sum(m["principal"] for m in schedule[:12])
        assert year1_principal > 0
        assert year1_principal < 300_000

    def test_cash_purchase_empty_schedule(self):
        schedule = compute_amortization_schedule(0, 0, 0)
        assert schedule == []
