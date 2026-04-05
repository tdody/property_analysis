def compute_ltr_gross_revenue(
    monthly_rent: float,
    pet_rent_monthly: float,
    late_fee_monthly: float,
) -> float:
    """Gross annual revenue = (monthly_rent + pet_rent + late_fees) x 12."""
    return (monthly_rent + pet_rent_monthly + late_fee_monthly) * 12


def compute_ltr_effective_revenue(
    gross_annual_revenue: float,
    vacancy_rate_pct: float,
) -> float:
    """Effective revenue after vacancy factor."""
    return gross_annual_revenue * (1 - vacancy_rate_pct / 100)


def compute_ltr_year1_revenue(
    monthly_rent: float,
    pet_rent_monthly: float,
    late_fee_monthly: float,
    vacancy_rate_pct: float,
    lease_up_period_months: int,
) -> dict:
    """Year 1 revenue accounting for lease-up period (separate from vacancy).

    Returns dict with year1_gross and year1_effective.
    """
    occupied_months = 12 - lease_up_period_months
    if occupied_months <= 0:
        return {"year1_gross": 0, "year1_effective": 0}
    year1_gross = (monthly_rent + pet_rent_monthly + late_fee_monthly) * occupied_months
    year1_effective = year1_gross * (1 - vacancy_rate_pct / 100)
    return {"year1_gross": year1_gross, "year1_effective": year1_effective}
