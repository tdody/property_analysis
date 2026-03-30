import pytest
from pydantic import ValidationError
from app.schemas.assumptions import AssumptionsUpdate
from app.schemas.scenario import ScenarioCreate, ScenarioUpdate


class TestAssumptionsValidation:
    def test_occupancy_over_100_rejected(self):
        with pytest.raises(ValidationError, match="occupancy"):
            AssumptionsUpdate(occupancy_pct=101)

    def test_occupancy_negative_rejected(self):
        with pytest.raises(ValidationError, match="occupancy"):
            AssumptionsUpdate(occupancy_pct=-5)

    def test_occupancy_valid(self):
        a = AssumptionsUpdate(occupancy_pct=65)
        assert a.occupancy_pct == 65

    def test_negative_nightly_rate_rejected(self):
        with pytest.raises(ValidationError, match="nightly_rate"):
            AssumptionsUpdate(avg_nightly_rate=-100)

    def test_negative_cleaning_fee_rejected(self):
        with pytest.raises(ValidationError, match="cleaning_fee"):
            AssumptionsUpdate(cleaning_fee_per_stay=-50)

    def test_platform_fee_over_100_rejected(self):
        with pytest.raises(ValidationError, match="platform_fee"):
            AssumptionsUpdate(platform_fee_pct=101)

    def test_rental_delay_negative_rejected(self):
        with pytest.raises(ValidationError, match="rental_delay"):
            AssumptionsUpdate(rental_delay_months=-1)

    def test_rental_delay_over_12_rejected(self):
        with pytest.raises(ValidationError, match="rental_delay"):
            AssumptionsUpdate(rental_delay_months=13)

    def test_damage_reserve_over_100_rejected(self):
        with pytest.raises(ValidationError, match="damage_reserve"):
            AssumptionsUpdate(damage_reserve_pct=101)

    def test_damage_reserve_negative_rejected(self):
        with pytest.raises(ValidationError, match="damage_reserve"):
            AssumptionsUpdate(damage_reserve_pct=-1)

    def test_damage_reserve_valid(self):
        a = AssumptionsUpdate(damage_reserve_pct=2.0)
        assert a.damage_reserve_pct == 2.0

    def test_land_value_over_100_rejected(self):
        with pytest.raises(ValidationError, match="land_value"):
            AssumptionsUpdate(land_value_pct=101)

    def test_land_value_negative_rejected(self):
        with pytest.raises(ValidationError, match="land_value"):
            AssumptionsUpdate(land_value_pct=-5)

    def test_land_value_valid(self):
        a = AssumptionsUpdate(land_value_pct=20.0)
        assert a.land_value_pct == 20.0

    def test_revenue_growth_over_50_rejected(self):
        with pytest.raises(ValidationError, match="revenue_growth"):
            AssumptionsUpdate(revenue_growth_pct=51)

    def test_revenue_growth_negative_rejected(self):
        with pytest.raises(ValidationError, match="revenue_growth"):
            AssumptionsUpdate(revenue_growth_pct=-1)

    def test_expense_growth_over_50_rejected(self):
        with pytest.raises(ValidationError, match="expense_growth"):
            AssumptionsUpdate(expense_growth_pct=51)

    def test_expense_growth_negative_rejected(self):
        with pytest.raises(ValidationError, match="expense_growth"):
            AssumptionsUpdate(expense_growth_pct=-1)

    def test_growth_rates_valid(self):
        a = AssumptionsUpdate(revenue_growth_pct=3.0, expense_growth_pct=5.0)
        assert a.revenue_growth_pct == 3.0
        assert a.expense_growth_pct == 5.0

    def test_peak_months_zero_rejected(self):
        with pytest.raises(ValidationError, match="peak_months"):
            AssumptionsUpdate(peak_months=0)

    def test_peak_months_twelve_rejected(self):
        with pytest.raises(ValidationError, match="peak_months"):
            AssumptionsUpdate(peak_months=12)

    def test_peak_months_valid(self):
        a = AssumptionsUpdate(peak_months=6)
        assert a.peak_months == 6

    def test_peak_occupancy_over_100_rejected(self):
        with pytest.raises(ValidationError, match="peak_occupancy"):
            AssumptionsUpdate(peak_occupancy_pct=101)

    def test_off_peak_occupancy_negative_rejected(self):
        with pytest.raises(ValidationError, match="off_peak_occupancy"):
            AssumptionsUpdate(off_peak_occupancy_pct=-1)

    def test_seasonal_occupancy_valid(self):
        a = AssumptionsUpdate(peak_occupancy_pct=80.0, off_peak_occupancy_pct=45.0)
        assert a.peak_occupancy_pct == 80.0
        assert a.off_peak_occupancy_pct == 45.0

    def test_marginal_tax_rate_over_55_rejected(self):
        with pytest.raises(ValidationError, match="marginal_tax_rate"):
            AssumptionsUpdate(marginal_tax_rate_pct=56)

    def test_marginal_tax_rate_negative_rejected(self):
        with pytest.raises(ValidationError, match="marginal_tax_rate"):
            AssumptionsUpdate(marginal_tax_rate_pct=-1)

    def test_marginal_tax_rate_valid(self):
        a = AssumptionsUpdate(marginal_tax_rate_pct=32.0)
        assert a.marginal_tax_rate_pct == 32.0


class TestScenarioValidation:
    def test_negative_interest_rate_rejected(self):
        with pytest.raises(ValidationError, match="interest_rate"):
            ScenarioCreate(name="Bad", interest_rate=-1)

    def test_negative_purchase_price_rejected(self):
        with pytest.raises(ValidationError, match="purchase_price"):
            ScenarioCreate(name="Bad", purchase_price=-100)

    def test_down_payment_over_100_rejected(self):
        with pytest.raises(ValidationError, match="down_payment"):
            ScenarioCreate(name="Bad", down_payment_pct=101)

    def test_loan_type_invalid_rejected(self):
        with pytest.raises(ValidationError, match="loan_type"):
            ScenarioCreate(name="Bad", loan_type="magical")

    def test_valid_scenario(self):
        s = ScenarioCreate(name="Good", purchase_price=400_000, interest_rate=7.25)
        assert s.purchase_price == 400_000

    def test_update_negative_interest_rate_rejected(self):
        with pytest.raises(ValidationError, match="interest_rate"):
            ScenarioUpdate(interest_rate=-1)

    def test_update_invalid_loan_type_rejected(self):
        with pytest.raises(ValidationError, match="loan_type"):
            ScenarioUpdate(loan_type="magical")

    def test_origination_points_over_10_rejected(self):
        with pytest.raises(ValidationError, match="origination_points"):
            ScenarioCreate(name="Bad", origination_points_pct=11)

    def test_origination_points_negative_rejected(self):
        with pytest.raises(ValidationError, match="origination_points"):
            ScenarioCreate(name="Bad", origination_points_pct=-1)

    def test_origination_points_valid(self):
        s = ScenarioCreate(name="Good", origination_points_pct=2.0)
        assert s.origination_points_pct == 2.0

    def test_update_origination_points_over_10_rejected(self):
        with pytest.raises(ValidationError, match="origination_points"):
            ScenarioUpdate(origination_points_pct=11)

    def test_io_period_negative_rejected(self):
        with pytest.raises(ValidationError, match="io_period"):
            ScenarioCreate(name="Bad", io_period_years=-1)

    def test_io_period_over_10_rejected(self):
        with pytest.raises(ValidationError, match="io_period"):
            ScenarioCreate(name="Bad", io_period_years=11)

    def test_io_period_valid(self):
        s = ScenarioCreate(name="Good", io_period_years=3)
        assert s.io_period_years == 3
