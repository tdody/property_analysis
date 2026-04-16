from typing import Any

from app.services.computation.monthly import compute_monthly_breakdown
from app.services.computation.revenue import compute_effective_occupancy


class TestEffectiveOccupancy:
    def test_standard_split(self):
        result = compute_effective_occupancy(6, 80.0, 45.0)
        assert result == 62.5

    def test_all_peak(self):
        result = compute_effective_occupancy(11, 80.0, 45.0)
        expected = (11 * 80 + 1 * 45) / 12
        assert abs(result - expected) < 0.01

    def test_one_peak_month(self):
        result = compute_effective_occupancy(1, 80.0, 45.0)
        expected = (1 * 80 + 11 * 45) / 12
        assert abs(result - expected) < 0.01

    def test_equal_rates(self):
        result = compute_effective_occupancy(6, 65.0, 65.0)
        assert result == 65.0


def _base_monthly(**overrides: Any) -> list[dict[str, Any]]:
    defaults: dict[str, Any] = dict(
        gross_annual_revenue=58_400,
        total_annual_opex=27_748,
        fixed_opex_annual=4_200,
        total_monthly_housing=2_838.20,
        peak_months=6,
        peak_occupancy_pct=80.0,
        off_peak_occupancy_pct=45.0,
        platform_fee_pct=3.0,
    )
    defaults.update(overrides)
    return compute_monthly_breakdown(**defaults)


class TestMonthlyRevenueSums:
    def test_sums_to_annual(self):
        months = _base_monthly()
        total = sum(m["gross_revenue"] for m in months)
        assert abs(total - 58_400) < 0.01

    def test_sums_to_annual_with_different_split(self):
        months = _base_monthly(
            peak_months=3, peak_occupancy_pct=90.0, off_peak_occupancy_pct=50.0
        )
        total = sum(m["gross_revenue"] for m in months)
        assert abs(total - 58_400) < 0.01


class TestMonthlyCashflowSums:
    def test_sums_to_annual(self):
        months = _base_monthly()
        gross = 58_400
        platform_fee = gross * 0.03
        net = gross - platform_fee
        noi = net - 27_748
        annual_cashflow = noi - 2_838.20 * 12
        total_cashflow = sum(m["cashflow"] for m in months)
        assert abs(total_cashflow - annual_cashflow) < 0.01


class TestPeakHigherRevenue:
    def test_peak_gt_off_peak(self):
        months = _base_monthly()
        peak_rev = months[0]["gross_revenue"]  # month 1 is peak
        off_peak_rev = months[6]["gross_revenue"]  # month 7 is off-peak
        assert peak_rev > off_peak_rev

    def test_peak_months_flagged(self):
        months = _base_monthly(peak_months=4)
        for m in months[:4]:
            assert m["is_peak"] is True
        for m in months[4:]:
            assert m["is_peak"] is False


class TestEqualOccupancyEvenSplit:
    def test_all_months_identical(self):
        months = _base_monthly(peak_occupancy_pct=65.0, off_peak_occupancy_pct=65.0)
        revenues = [m["gross_revenue"] for m in months]
        assert all(abs(r - revenues[0]) < 0.01 for r in revenues)
        cashflows = [m["cashflow"] for m in months]
        assert all(abs(c - cashflows[0]) < 0.01 for c in cashflows)


class TestEdgeCases:
    def test_one_peak_month(self):
        months = _base_monthly(peak_months=1)
        assert len(months) == 12
        assert months[0]["is_peak"] is True
        assert all(not m["is_peak"] for m in months[1:])
        total = sum(m["gross_revenue"] for m in months)
        assert abs(total - 58_400) < 0.01

    def test_eleven_peak_months(self):
        months = _base_monthly(peak_months=11)
        assert sum(1 for m in months if m["is_peak"]) == 11
        total = sum(m["gross_revenue"] for m in months)
        assert abs(total - 58_400) < 0.01

    def test_zero_occupancy_both_seasons(self):
        months = _base_monthly(peak_occupancy_pct=0, off_peak_occupancy_pct=0)
        for m in months:
            assert m["gross_revenue"] == 0
            assert m["cashflow"] < 0  # still paying housing costs


class TestOutputStructure:
    def test_twelve_months(self):
        months = _base_monthly()
        assert len(months) == 12
        assert [m["month"] for m in months] == list(range(1, 13))

    def test_fields_present(self):
        months = _base_monthly()
        for m in months:
            assert "month" in m
            assert "is_peak" in m
            assert "gross_revenue" in m
            assert "total_expenses" in m
            assert "noi" in m
            assert "cashflow" in m
