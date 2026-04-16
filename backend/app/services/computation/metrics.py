def compute_noi(net_annual_revenue: float, total_annual_operating_exp: float) -> float:
    return net_annual_revenue - total_annual_operating_exp


def compute_cashflow(noi: float, total_monthly_housing: float) -> dict:
    annual_fixed_costs = total_monthly_housing * 12
    annual_cashflow = noi - annual_fixed_costs
    return {
        "annual_cashflow": annual_cashflow,
        "monthly_cashflow": annual_cashflow / 12,
    }


def compute_cash_on_cash_return(
    annual_cashflow: float, total_cash_invested: float
) -> float:
    if total_cash_invested <= 0:
        return 0
    return (annual_cashflow / total_cash_invested) * 100


def compute_cap_rate(noi: float, purchase_price: float) -> float:
    if purchase_price <= 0:
        return 0
    return (noi / purchase_price) * 100


def compute_dscr(noi: float, annual_debt_service: float) -> float:
    if annual_debt_service <= 0:
        return 0
    return noi / annual_debt_service


def compute_gross_yield(gross_annual_revenue: float, purchase_price: float) -> float:
    if purchase_price <= 0:
        return 0
    return (gross_annual_revenue / purchase_price) * 100


def compute_break_even_occupancy(
    avg_nightly_rate: float,
    cleaning_fee_per_stay: float,
    avg_stay_length_nights: float,
    platform_fee_pct: float,
    cleaning_cost_per_turn: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    fixed_opex_annual: float,
    total_monthly_housing: float,
) -> float:
    if avg_stay_length_nights <= 0 or avg_nightly_rate <= 0:
        return 0
    nightly_net_factor = 365 * avg_nightly_rate * (1 - platform_fee_pct / 100)
    turn_net_factor = (
        (365 / avg_stay_length_nights)
        * cleaning_fee_per_stay
        * (1 - platform_fee_pct / 100)
    )
    a_revenue_per_occ = nightly_net_factor + turn_net_factor
    clean_cost_per_occ = (365 / avg_stay_length_nights) * cleaning_cost_per_turn
    mgmt_per_occ = a_revenue_per_occ * (property_mgmt_pct / 100)
    maint_per_occ = 365 * avg_nightly_rate * (maintenance_reserve_pct / 100)
    capex_per_occ = 365 * avg_nightly_rate * (capex_reserve_pct / 100)
    b_variable_cost_per_occ = (
        clean_cost_per_occ + mgmt_per_occ + maint_per_occ + capex_per_occ
    )
    fixed_total = fixed_opex_annual + total_monthly_housing * 12
    denominator = a_revenue_per_occ - b_variable_cost_per_occ
    if denominator <= 0:
        return 999.0
    return (fixed_total / denominator) * 100


def compute_total_roi_year1(
    annual_cashflow: float, year1_equity_buildup: float, total_cash_invested: float
) -> float:
    if total_cash_invested <= 0:
        return 0
    return ((annual_cashflow + year1_equity_buildup) / total_cash_invested) * 100


def compute_appreciation_year1(purchase_price: float, appreciation_pct: float) -> float:
    return purchase_price * (appreciation_pct / 100)


def compute_total_roi_year1_with_appreciation(
    annual_cashflow: float,
    year1_equity: float,
    year1_appreciation: float,
    total_cash: float,
) -> float:
    if total_cash <= 0:
        return 0
    return ((annual_cashflow + year1_equity + year1_appreciation) / total_cash) * 100


def compute_tax_analysis(
    noi: float,
    annual_mortgage_interest: float,
    total_depreciation_annual: float,
    marginal_tax_rate_pct: float,
    pre_tax_annual_cashflow: float,
) -> dict:
    taxable_income = noi - annual_mortgage_interest - total_depreciation_annual
    tax = taxable_income * (marginal_tax_rate_pct / 100)
    after_tax_annual = pre_tax_annual_cashflow - tax
    return {
        "taxable_income": taxable_income,
        "tax_liability": tax,
        "after_tax_annual_cashflow": after_tax_annual,
        "after_tax_monthly_cashflow": after_tax_annual / 12,
    }


def compute_break_even_vacancy(
    gross_annual_revenue: float,
    fixed_opex_annual: float,
    annual_housing_cost: float,
) -> float:
    """Compute the vacancy rate at which cashflow goes to zero for LTR.

    total_annual_costs = fixed_opex + housing cost
    break_even_vacancy_pct = (1 - total_annual_costs / gross_annual_revenue) * 100
    """
    if gross_annual_revenue <= 0:
        return 0
    total_annual_costs = fixed_opex_annual + annual_housing_cost
    result = (1 - total_annual_costs / gross_annual_revenue) * 100
    return max(result, 0)


def compute_delay_carrying_costs(
    total_monthly_housing: float, rental_delay_months: int
) -> float:
    return total_monthly_housing * rental_delay_months


def compute_all_metrics(
    net_annual_revenue: float,
    total_annual_operating_exp: float,
    monthly_pi: float,
    total_cash_invested: float,
    purchase_price: float,
    gross_annual_revenue: float,
    year1_equity_buildup: float,
    avg_nightly_rate: float,
    cleaning_fee_per_stay: float,
    avg_stay_length_nights: float,
    platform_fee_pct: float,
    cleaning_cost_per_turn: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    fixed_opex_annual: float,
    total_monthly_housing: float,
) -> dict:
    noi = compute_noi(net_annual_revenue, total_annual_operating_exp)
    cashflow = compute_cashflow(noi, total_monthly_housing)
    annual_debt_service = monthly_pi * 12
    return {
        "noi": noi,
        "monthly_cashflow": cashflow["monthly_cashflow"],
        "annual_cashflow": cashflow["annual_cashflow"],
        "cash_on_cash_return": compute_cash_on_cash_return(
            cashflow["annual_cashflow"], total_cash_invested
        ),
        "cap_rate": compute_cap_rate(noi, purchase_price),
        "dscr": compute_dscr(noi, annual_debt_service),
        "gross_yield": compute_gross_yield(gross_annual_revenue, purchase_price),
        "break_even_occupancy": compute_break_even_occupancy(
            avg_nightly_rate=avg_nightly_rate,
            cleaning_fee_per_stay=cleaning_fee_per_stay,
            avg_stay_length_nights=avg_stay_length_nights,
            platform_fee_pct=platform_fee_pct,
            cleaning_cost_per_turn=cleaning_cost_per_turn,
            property_mgmt_pct=property_mgmt_pct,
            maintenance_reserve_pct=maintenance_reserve_pct,
            capex_reserve_pct=capex_reserve_pct,
            fixed_opex_annual=fixed_opex_annual,
            total_monthly_housing=total_monthly_housing,
        ),
        "total_roi_year1": compute_total_roi_year1(
            cashflow["annual_cashflow"], year1_equity_buildup, total_cash_invested
        ),
    }
