def compute_operating_expenses(
    annual_turnovers: float,
    cleaning_cost_per_turn: float,
    net_annual_revenue: float,
    gross_annual_revenue: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    utilities_monthly: float,
    supplies_monthly: float,
    lawn_snow_monthly: float,
    other_monthly_expense: float,
    local_str_registration_fee: float,
    local_gross_receipts_tax_pct: float = 0,
) -> dict:
    annual_cleaning_cost = annual_turnovers * cleaning_cost_per_turn
    property_mgmt_cost = net_annual_revenue * (property_mgmt_pct / 100)
    maintenance_reserve = gross_annual_revenue * (maintenance_reserve_pct / 100)
    capex_reserve = gross_annual_revenue * (capex_reserve_pct / 100)
    utilities_annual = utilities_monthly * 12
    supplies_annual = supplies_monthly * 12
    lawn_snow_annual = lawn_snow_monthly * 12
    other_annual = other_monthly_expense * 12
    registration_annual = local_str_registration_fee
    gross_receipts_tax = gross_annual_revenue * (local_gross_receipts_tax_pct / 100)
    total = (
        annual_cleaning_cost
        + property_mgmt_cost
        + maintenance_reserve
        + capex_reserve
        + utilities_annual
        + supplies_annual
        + lawn_snow_annual
        + other_annual
        + registration_annual
        + gross_receipts_tax
    )
    return {
        "annual_cleaning_cost": annual_cleaning_cost,
        "property_mgmt_cost": property_mgmt_cost,
        "maintenance_reserve": maintenance_reserve,
        "capex_reserve": capex_reserve,
        "utilities_annual": utilities_annual,
        "supplies_annual": supplies_annual,
        "lawn_snow_annual": lawn_snow_annual,
        "other_annual": other_annual,
        "registration_annual": registration_annual,
        "gross_receipts_tax": gross_receipts_tax,
        "total_annual_operating_exp": total,
    }
