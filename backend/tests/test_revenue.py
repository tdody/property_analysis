from app.services.computation.revenue import (
    compute_occupied_nights,
    compute_annual_turnovers,
    compute_gross_revenue,
    compute_net_revenue,
    compute_year1_revenue,
)


class TestOccupiedNights:
    def test_65_percent(self):
        assert compute_occupied_nights(65.0) == 365 * 0.65

    def test_100_percent(self):
        assert compute_occupied_nights(100.0) == 365

    def test_0_percent(self):
        assert compute_occupied_nights(0.0) == 0


class TestAnnualTurnovers:
    def test_3_night_avg_stay(self):
        occupied = 365 * 0.65
        result = compute_annual_turnovers(occupied, 3.0)
        assert round(result, 2) == round(237.25 / 3.0, 2)

    def test_7_night_avg_stay(self):
        occupied = 365 * 0.65
        result = compute_annual_turnovers(occupied, 7.0)
        assert round(result, 2) == round(237.25 / 7.0, 2)


class TestGrossRevenue:
    def test_basic_revenue(self):
        result = compute_gross_revenue(
            avg_nightly_rate=200,
            occupancy_pct=65.0,
            cleaning_fee_per_stay=150,
            avg_stay_length_nights=3.0,
        )
        occupied = 365 * 0.65
        turnovers = occupied / 3.0
        expected_nightly = occupied * 200
        expected_cleaning = turnovers * 150
        assert round(result["gross_nightly_revenue"], 2) == round(expected_nightly, 2)
        assert round(result["cleaning_fee_revenue"], 2) == round(expected_cleaning, 2)
        assert round(result["total_gross_revenue"], 2) == round(
            expected_nightly + expected_cleaning, 2
        )
        assert round(result["annual_turnovers"], 2) == round(turnovers, 2)


class TestYear1Revenue:
    def test_no_delay(self):
        result = compute_year1_revenue(annual_revenue=60_000, rental_delay_months=0)
        assert result == 60_000

    def test_one_month_delay(self):
        result = compute_year1_revenue(annual_revenue=60_000, rental_delay_months=1)
        assert result == 55_000  # 11/12 * 60000

    def test_three_month_delay(self):
        result = compute_year1_revenue(annual_revenue=60_000, rental_delay_months=3)
        assert result == 45_000  # 9/12 * 60000

    def test_twelve_month_delay(self):
        result = compute_year1_revenue(annual_revenue=60_000, rental_delay_months=12)
        assert result == 0


class TestNetRevenue:
    def test_3_percent_platform_fee(self):
        result = compute_net_revenue(60_000, 3.0)
        assert round(result["platform_fees"], 2) == 1800.0
        assert round(result["net_revenue"], 2) == 58_200.0

    def test_zero_platform_fee(self):
        result = compute_net_revenue(50_000, 0.0)
        assert result["platform_fees"] == 0
        assert result["net_revenue"] == 50_000
