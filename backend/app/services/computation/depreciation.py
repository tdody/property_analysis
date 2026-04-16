def compute_depreciation(
    purchase_price: float, land_value_pct: float, furniture_cost: float
) -> dict:
    building_value = purchase_price * (1 - land_value_pct / 100)
    building_depreciation_annual = building_value / 27.5
    furniture_depreciation_annual = furniture_cost / 7 if furniture_cost > 0 else 0
    return {
        "building_value": building_value,
        "building_depreciation_annual": building_depreciation_annual,
        "furniture_depreciation_annual": furniture_depreciation_annual,
        "total_depreciation_annual": building_depreciation_annual
        + furniture_depreciation_annual,
    }
