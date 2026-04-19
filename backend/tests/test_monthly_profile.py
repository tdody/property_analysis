from app.services.computation.revenue import (
    compute_monthly_revenue,
    compute_annual_from_monthly,
)
from app.services.computation.monthly import compute_monthly_breakdown_from_profile
from app.services.computation.profile_templates import PROFILE_TEMPLATES, DAYS_IN_MONTH


def _flat_profile(rate=200, occ=65):
    return [
        {"month": m, "nightly_rate": rate, "occupancy_pct": occ} for m in range(1, 13)
    ]


class TestMonthlyRevenueFromProfile:
    def test_flat_profile_matches_old_calc(self):
        profile = _flat_profile(200, 65)
        results = compute_monthly_revenue(
            profile, cleaning_fee_per_stay=150, avg_stay_length_nights=3.0
        )
        annual = compute_annual_from_monthly(results)
        # Compare with manual calculation
        total_days = sum(DAYS_IN_MONTH)
        expected_occupied = total_days * 0.65
        expected_turnovers = expected_occupied / 3.0
        expected_nightly = expected_occupied * 200
        expected_cleaning = expected_turnovers * 150
        assert (
            abs(annual["total_gross_revenue"] - (expected_nightly + expected_cleaning))
            < 0.01
        )

    def test_monthly_sums_equal_annual(self):
        profile = PROFILE_TEMPLATES["vt_ski_town"]
        assert profile is not None
        results = compute_monthly_revenue(
            profile, cleaning_fee_per_stay=150, avg_stay_length_nights=3.0
        )
        annual = compute_annual_from_monthly(results)
        assert (
            abs(
                sum(m["total_gross_revenue"] for m in results)
                - annual["total_gross_revenue"]
            )
            < 0.01
        )
        assert (
            abs(sum(m["occupied_nights"] for m in results) - annual["occupied_nights"])
            < 0.01
        )
        assert (
            abs(sum(m["turnovers"] for m in results) - annual["annual_turnovers"])
            < 0.01
        )

    def test_days_in_month_respected(self):
        profile = _flat_profile(200, 100)  # 100% occupancy
        results = compute_monthly_revenue(
            profile, cleaning_fee_per_stay=0, avg_stay_length_nights=3.0
        )
        for m_result in results:
            month_idx = m_result["month"] - 1
            assert m_result["occupied_nights"] == DAYS_IN_MONTH[month_idx]

    def test_high_season_months_produce_more(self):
        profile = PROFILE_TEMPLATES["vt_ski_town"]
        assert profile is not None
        results = compute_monthly_revenue(
            profile, cleaning_fee_per_stay=150, avg_stay_length_nights=3.0
        )
        # February (peak ski) should produce more than April (mud season)
        feb = next(m for m in results if m["month"] == 2)
        apr = next(m for m in results if m["month"] == 4)
        assert feb["total_gross_revenue"] > apr["total_gross_revenue"]


class TestMonthlyBreakdownFromProfile:
    def _make_breakdown(self):
        profile = PROFILE_TEMPLATES["vt_general"]
        assert profile is not None
        monthly_rev = compute_monthly_revenue(
            profile, cleaning_fee_per_stay=150, avg_stay_length_nights=3.0
        )
        return compute_monthly_breakdown_from_profile(
            monthly_revenue=monthly_rev,
            total_annual_opex=25000,
            fixed_opex_annual=5000,
            total_monthly_housing=2500,
            platform_fee_pct=3.0,
        ), monthly_rev

    def test_twelve_months_returned(self):
        months, _ = self._make_breakdown()
        assert len(months) == 12
        assert [m["month"] for m in months] == list(range(1, 13))

    def test_cashflow_sums_match_annual(self):
        months, monthly_rev = self._make_breakdown()
        annual_gross = sum(m["total_gross_revenue"] for m in monthly_rev)
        annual_net = annual_gross * (1 - 0.03)
        annual_noi = annual_net - 25000
        annual_cashflow = annual_noi - 2500 * 12
        total_cashflow = sum(m["cashflow"] for m in months)
        assert abs(total_cashflow - annual_cashflow) < 0.01

    def test_variable_expenses_scale_with_revenue(self):
        months, _ = self._make_breakdown()
        # Higher revenue months should have higher expenses
        revenues = [m["gross_revenue"] for m in months]
        expenses = [m["total_expenses"] for m in months]
        max_rev_idx = revenues.index(max(revenues))
        min_rev_idx = revenues.index(min(revenues))
        assert expenses[max_rev_idx] > expenses[min_rev_idx]

    def test_has_rate_and_occupancy_fields(self):
        months, _ = self._make_breakdown()
        for m in months:
            assert "nightly_rate" in m
            assert "occupancy_pct" in m
            assert "occupied_nights" in m


class TestProfileTemplates:
    def test_all_templates_have_12_entries(self):
        for name, template in PROFILE_TEMPLATES.items():
            if template is None:
                continue
            assert len(template) == 12, f"Template {name} has {len(template)} entries"

    def test_months_1_through_12(self):
        for name, template in PROFILE_TEMPLATES.items():
            if template is None:
                continue
            months = sorted(e["month"] for e in template)
            assert months == list(range(1, 13)), f"Template {name} has wrong months"

    def test_rates_in_valid_range(self):
        for name, template in PROFILE_TEMPLATES.items():
            if template is None:
                continue
            for entry in template:
                assert entry["nightly_rate"] > 0, (
                    f"Template {name} month {entry['month']} has non-positive rate"
                )
                assert entry["nightly_rate"] <= 1000, (
                    f"Template {name} month {entry['month']} has unrealistic rate"
                )

    def test_occupancy_in_valid_range(self):
        for name, template in PROFILE_TEMPLATES.items():
            if template is None:
                continue
            for entry in template:
                assert 0 <= entry["occupancy_pct"] <= 100, (
                    f"Template {name} month {entry['month']} has invalid occupancy"
                )

    def test_flat_is_none(self):
        assert PROFILE_TEMPLATES["flat"] is None

    def test_four_templates_exist(self):
        assert len(PROFILE_TEMPLATES) == 4
