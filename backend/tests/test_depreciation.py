from app.services.computation.depreciation import compute_depreciation


class TestDepreciation:
    def test_standard_case(self):
        result = compute_depreciation(
            purchase_price=400_000, land_value_pct=20.0, furniture_cost=15_000
        )
        assert result["building_value"] == 320_000
        assert round(result["building_depreciation_annual"], 2) == round(
            320_000 / 27.5, 2
        )
        assert round(result["furniture_depreciation_annual"], 2) == round(15_000 / 7, 2)
        expected_total = 320_000 / 27.5 + 15_000 / 7
        assert round(result["total_depreciation_annual"], 2) == round(expected_total, 2)

    def test_zero_land_value(self):
        result = compute_depreciation(
            purchase_price=400_000, land_value_pct=0, furniture_cost=0
        )
        assert result["building_value"] == 400_000
        assert round(result["building_depreciation_annual"], 2) == round(
            400_000 / 27.5, 2
        )
        assert result["furniture_depreciation_annual"] == 0

    def test_100_pct_land(self):
        result = compute_depreciation(
            purchase_price=400_000, land_value_pct=100, furniture_cost=10_000
        )
        assert result["building_value"] == 0
        assert result["building_depreciation_annual"] == 0
        assert round(result["furniture_depreciation_annual"], 2) == round(10_000 / 7, 2)

    def test_no_furniture(self):
        result = compute_depreciation(
            purchase_price=425_000, land_value_pct=20.0, furniture_cost=0
        )
        assert result["furniture_depreciation_annual"] == 0
        assert (
            result["total_depreciation_annual"]
            == result["building_depreciation_annual"]
        )
