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
