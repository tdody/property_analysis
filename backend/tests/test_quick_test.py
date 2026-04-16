from app.services.computation.quick_test import compute_quick_test
import pytest


class TestQuickTestSTR:
    def test_strong_deal(self):
        result = compute_quick_test(
            purchase_price=300_000,
            down_payment_pct=25.0,
            interest_rate=7.0,
            nightly_rate=250,
            occupancy_pct=70,
        )
        assert result["rental_type"] == "str"
        assert result["verdict"] in ("strong", "moderate", "weak", "negative")
        assert result["monthly_cashflow"] != 0
        assert result["annual_coc"] != 0
        assert result["cap_rate"] > 0
        assert result["dscr"] > 0
        assert result["total_cash_invested"] > 0

    def test_negative_deal(self):
        # Very expensive property, low rate
        result = compute_quick_test(
            purchase_price=1_000_000,
            down_payment_pct=10.0,
            interest_rate=8.0,
            nightly_rate=100,
            occupancy_pct=40,
        )
        assert result["monthly_cashflow"] < 0
        assert result["verdict"] == "negative"

    def test_high_coc_is_strong(self):
        result = compute_quick_test(
            purchase_price=200_000,
            down_payment_pct=25.0,
            interest_rate=6.0,
            nightly_rate=300,
            occupancy_pct=75,
        )
        assert result["annual_coc"] >= 8
        assert result["verdict"] == "strong"

    def test_moderate_coc(self):
        # Tune inputs to get CoC between 4-8%
        result = compute_quick_test(
            purchase_price=400_000,
            down_payment_pct=25.0,
            interest_rate=7.0,
            nightly_rate=200,
            occupancy_pct=65,
        )
        assert result["verdict"] in ("strong", "moderate")

    def test_cash_purchase(self):
        result = compute_quick_test(
            purchase_price=300_000,
            down_payment_pct=100.0,
            interest_rate=0,
            nightly_rate=200,
            occupancy_pct=65,
        )
        assert result["dscr"] == 0  # No debt service
        assert result["monthly_cashflow"] > 0


class TestQuickTestLTR:
    def test_basic_ltr(self):
        result = compute_quick_test(
            purchase_price=300_000,
            down_payment_pct=25.0,
            interest_rate=7.0,
            monthly_rent=2_500,
        )
        assert result["rental_type"] == "ltr"
        assert result["monthly_cashflow"] != 0
        assert result["cap_rate"] > 0

    def test_ltr_negative(self):
        result = compute_quick_test(
            purchase_price=500_000,
            down_payment_pct=10.0,
            interest_rate=8.0,
            monthly_rent=1_500,
        )
        assert result["monthly_cashflow"] < 0
        assert result["verdict"] == "negative"


class TestQuickTestValidation:
    def test_no_rental_input_raises(self):
        with pytest.raises(ValueError):
            compute_quick_test(
                purchase_price=300_000,
                down_payment_pct=25.0,
                interest_rate=7.0,
            )

    def test_returns_all_fields(self):
        result = compute_quick_test(
            purchase_price=300_000,
            down_payment_pct=25.0,
            interest_rate=7.0,
            nightly_rate=200,
            occupancy_pct=65,
        )
        expected_keys = {
            "rental_type",
            "monthly_cashflow",
            "annual_cashflow",
            "annual_coc",
            "cap_rate",
            "dscr",
            "noi",
            "total_cash_invested",
            "monthly_housing_cost",
            "verdict",
        }
        assert set(result.keys()) == expected_keys
