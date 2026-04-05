def compute_monthly_breakdown(
    gross_annual_revenue: float,
    total_annual_opex: float,
    fixed_opex_annual: float,
    total_monthly_housing: float,
    peak_months: int,
    peak_occupancy_pct: float,
    off_peak_occupancy_pct: float,
    platform_fee_pct: float,
) -> list[dict]:
    off_peak_months = 12 - peak_months
    effective_occ = (peak_months * peak_occupancy_pct + off_peak_months * off_peak_occupancy_pct) / 12

    variable_opex_annual = total_annual_opex - fixed_opex_annual
    fixed_monthly = fixed_opex_annual / 12

    months = []
    cumulative_cashflow = 0

    for m in range(1, 13):
        is_peak = m <= peak_months

        if effective_occ <= 0 or gross_annual_revenue <= 0:
            gross = 0
        else:
            occ = peak_occupancy_pct if is_peak else off_peak_occupancy_pct
            gross = gross_annual_revenue / 12 * (occ / effective_occ)

        net = gross * (1 - platform_fee_pct / 100)

        if gross_annual_revenue > 0:
            revenue_share = gross / gross_annual_revenue
        else:
            revenue_share = 0

        variable_monthly = variable_opex_annual * revenue_share
        total_expenses = variable_monthly + fixed_monthly
        noi = net - total_expenses
        cashflow = noi - total_monthly_housing

        months.append({
            "month": m,
            "is_peak": is_peak,
            "gross_revenue": gross,
            "total_expenses": total_expenses,
            "noi": noi,
            "cashflow": cashflow,
        })

    return months


def compute_ltr_monthly_breakdown(
    monthly_rent: float,
    pet_rent_monthly: float,
    late_fee_monthly: float,
    vacancy_rate_pct: float,
    total_annual_opex: float,
    total_monthly_housing: float,
    lease_up_period_months: int = 0,
) -> list[dict]:
    """Compute month-by-month LTR cashflow.

    For Year 1: months 1..lease_up_period show zero revenue.
    Fixed expenses apply every month.
    """
    monthly_opex = total_annual_opex / 12
    monthly_total_rent = (monthly_rent + pet_rent_monthly + late_fee_monthly)

    months = []
    for m in range(1, 13):
        if m <= lease_up_period_months:
            monthly_revenue = 0
        else:
            monthly_revenue = monthly_total_rent * (1 - vacancy_rate_pct / 100)

        noi = monthly_revenue - monthly_opex
        cashflow = noi - total_monthly_housing

        months.append({
            "month": m,
            "is_peak": m > lease_up_period_months,  # "is_peak" means actively rented
            "gross_revenue": monthly_revenue,
            "total_expenses": monthly_opex,
            "noi": noi,
            "cashflow": cashflow,
        })

    return months
