from app.services.computation.mortgage import (
    compute_loan_amount,
    compute_monthly_pi,
    compute_pmi,
    compute_total_monthly_housing,
    compute_total_cash_invested,
)
from app.services.computation.revenue import (
    compute_gross_revenue,
    compute_net_revenue,
)
from app.services.computation.expenses import compute_operating_expenses
from app.services.computation.metrics import (
    compute_noi,
    compute_cashflow,
    compute_cash_on_cash_return,
    compute_cap_rate,
    compute_dscr,
)

# Hardcoded defaults for quick test
DEFAULTS: dict[str, float] = {
    "closing_cost_pct": 3.0,
    "annual_taxes_pct": 1.5,  # % of purchase price
    "insurance_annual": 2500,
    "hoa_monthly": 0,
    # STR defaults
    "cleaning_fee_per_stay": 150,
    "avg_stay_length_nights": 3.0,
    "platform_fee_pct": 3.0,
    "cleaning_cost_per_turn": 120,
    "property_mgmt_pct": 0,
    "maintenance_reserve_pct": 5.0,
    "capex_reserve_pct": 5.0,
    "utilities_monthly": 250,
    "supplies_monthly": 100,
    # LTR defaults
    "ltr_vacancy_pct": 5.0,
    "ltr_property_mgmt_pct": 8.0,
    "ltr_maintenance_pct": 5.0,
    "ltr_capex_pct": 5.0,
}
DEFAULT_LOAN_TYPE: str = "conventional"


def compute_quick_test(
    purchase_price: float,
    down_payment_pct: float,
    interest_rate: float,
    nightly_rate: float | None = None,
    occupancy_pct: float | None = None,
    monthly_rent: float | None = None,
    loan_term_years: int = 30,
) -> dict:
    is_str = nightly_rate is not None and occupancy_pct is not None
    is_ltr = monthly_rent is not None

    if not is_str and not is_ltr:
        raise ValueError(
            "Provide nightly_rate + occupancy_pct (STR) or monthly_rent (LTR)"
        )

    # Financing
    down_payment_amt = purchase_price * down_payment_pct / 100
    loan_amount = compute_loan_amount(purchase_price, down_payment_amt)
    monthly_pi = compute_monthly_pi(loan_amount, interest_rate, loan_term_years)
    monthly_pmi = compute_pmi(loan_amount, DEFAULT_LOAN_TYPE, down_payment_pct, None)
    annual_taxes = purchase_price * DEFAULTS["annual_taxes_pct"] / 100
    total_monthly_housing = compute_total_monthly_housing(
        monthly_pi,
        monthly_pmi,
        annual_taxes,
        DEFAULTS["insurance_annual"],
        DEFAULTS["hoa_monthly"],
        None,
    )
    closing_cost_amt = purchase_price * DEFAULTS["closing_cost_pct"] / 100
    total_cash_invested = compute_total_cash_invested(
        down_payment_amt,
        closing_cost_amt,
        0,
        0,
        0,
    )

    if is_str:
        assert nightly_rate is not None
        assert occupancy_pct is not None
        gross = compute_gross_revenue(
            nightly_rate,
            occupancy_pct,
            DEFAULTS["cleaning_fee_per_stay"],
            DEFAULTS["avg_stay_length_nights"],
        )
        net = compute_net_revenue(
            gross["total_gross_revenue"], DEFAULTS["platform_fee_pct"]
        )
        opex = compute_operating_expenses(
            annual_turnovers=gross["annual_turnovers"],
            cleaning_cost_per_turn=DEFAULTS["cleaning_cost_per_turn"],
            net_annual_revenue=net["net_revenue"],
            gross_annual_revenue=gross["total_gross_revenue"],
            property_mgmt_pct=DEFAULTS["property_mgmt_pct"],
            maintenance_reserve_pct=DEFAULTS["maintenance_reserve_pct"],
            capex_reserve_pct=DEFAULTS["capex_reserve_pct"],
            utilities_monthly=DEFAULTS["utilities_monthly"],
            supplies_monthly=DEFAULTS["supplies_monthly"],
            lawn_snow_monthly=0,
            other_monthly_expense=0,
            local_str_registration_fee=0,
        )
        gross_annual = gross["total_gross_revenue"]
        net_annual = net["net_revenue"]
        total_opex = opex["total_annual_operating_exp"]
        rental_type = "str"
    else:
        assert monthly_rent is not None
        gross_annual = monthly_rent * 12
        vacancy_loss = gross_annual * DEFAULTS["ltr_vacancy_pct"] / 100
        net_annual = gross_annual - vacancy_loss
        mgmt = net_annual * DEFAULTS["ltr_property_mgmt_pct"] / 100
        maintenance = gross_annual * DEFAULTS["ltr_maintenance_pct"] / 100
        capex = gross_annual * DEFAULTS["ltr_capex_pct"] / 100
        total_opex = mgmt + maintenance + capex + DEFAULTS["insurance_annual"]
        rental_type = "ltr"

    noi = compute_noi(net_annual, total_opex)
    cf = compute_cashflow(noi, total_monthly_housing)
    annual_debt_service = monthly_pi * 12
    coc = compute_cash_on_cash_return(cf["annual_cashflow"], total_cash_invested)
    cap = compute_cap_rate(noi, purchase_price)
    dscr = compute_dscr(noi, annual_debt_service)

    # Verdict
    if coc >= 8:
        verdict = "strong"
    elif coc >= 4:
        verdict = "moderate"
    elif cf["monthly_cashflow"] >= 0:
        verdict = "weak"
    else:
        verdict = "negative"

    return {
        "rental_type": rental_type,
        "monthly_cashflow": round(cf["monthly_cashflow"], 2),
        "annual_cashflow": round(cf["annual_cashflow"], 2),
        "annual_coc": round(coc, 2),
        "cap_rate": round(cap, 2),
        "dscr": round(dscr, 2),
        "noi": round(noi, 2),
        "total_cash_invested": round(total_cash_invested, 2),
        "monthly_housing_cost": round(total_monthly_housing, 2),
        "verdict": verdict,
    }
