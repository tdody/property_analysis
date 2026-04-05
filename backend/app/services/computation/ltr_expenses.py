def compute_ltr_operating_expenses(
    effective_annual_revenue: float,
    gross_annual_revenue: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    tenant_turnover_cost: float,
    lease_duration_months: int,
    insurance_annual: float,
    landlord_repairs_annual: float,
    utilities_monthly: float,
    lawn_snow_monthly: float,
    other_monthly_expense: float,
    accounting_annual: float,
    legal_annual: float,
) -> dict:
    """Compute LTR annual operating expenses.

    Returns a dict with individual components and total.
    """
    property_mgmt_cost = effective_annual_revenue * (property_mgmt_pct / 100)
    maintenance_reserve = gross_annual_revenue * (maintenance_reserve_pct / 100)
    capex_reserve = gross_annual_revenue * (capex_reserve_pct / 100)

    # Turnover amortized: cost spread over lease term
    if lease_duration_months > 0:
        turnover_amortized = tenant_turnover_cost * (12 / lease_duration_months)
    else:
        turnover_amortized = 0

    fixed_expenses = (
        (utilities_monthly + lawn_snow_monthly + other_monthly_expense) * 12
        + insurance_annual
        + landlord_repairs_annual
        + accounting_annual
        + legal_annual
    )

    total = (
        property_mgmt_cost
        + maintenance_reserve
        + capex_reserve
        + turnover_amortized
        + fixed_expenses
    )

    return {
        "property_mgmt_cost": property_mgmt_cost,
        "maintenance_reserve": maintenance_reserve,
        "capex_reserve": capex_reserve,
        "turnover_amortized": turnover_amortized,
        "insurance_annual": insurance_annual,
        "landlord_repairs_annual": landlord_repairs_annual,
        "utilities_annual": utilities_monthly * 12,
        "lawn_snow_annual": lawn_snow_monthly * 12,
        "other_annual": other_monthly_expense * 12,
        "accounting_annual": accounting_annual,
        "legal_annual": legal_annual,
        "fixed_expenses": fixed_expenses,
        "total_annual_operating_exp": total,
    }
