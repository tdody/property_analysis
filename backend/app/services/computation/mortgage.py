from decimal import Decimal, ROUND_HALF_UP


def compute_loan_amount(purchase_price: float, down_payment_amt: float) -> float:
    return purchase_price - down_payment_amt


def compute_monthly_pi(loan_amount: float, annual_rate: float, term_years: int) -> float:
    if loan_amount <= 0 or term_years <= 0:
        return 0
    if annual_rate == 0:
        return loan_amount / (term_years * 12)
    monthly_rate = annual_rate / 100 / 12
    n_payments = term_years * 12
    numerator = loan_amount * (monthly_rate * (1 + monthly_rate) ** n_payments)
    denominator = (1 + monthly_rate) ** n_payments - 1
    return numerator / denominator


def compute_io_monthly_payment(loan_amount: float, annual_rate: float) -> float:
    if loan_amount <= 0 or annual_rate <= 0:
        return 0
    return loan_amount * (annual_rate / 100 / 12)


def compute_pmi(loan_amount: float, loan_type: str, down_payment_pct: float, pmi_override: float | None) -> float:
    if pmi_override is not None:
        return pmi_override
    if loan_type != "conventional":
        return 0
    if down_payment_pct >= 20.0:
        return 0
    return loan_amount * 0.005 / 12


def compute_total_monthly_housing(
    monthly_pi: float,
    monthly_pmi: float,
    annual_taxes: float,
    insurance_annual: float,
    hoa_monthly: float,
    nonhomestead_annual_taxes: float | None,
) -> float:
    taxes = nonhomestead_annual_taxes if nonhomestead_annual_taxes is not None else annual_taxes
    monthly_tax = taxes / 12
    monthly_insurance = insurance_annual / 12
    return monthly_pi + monthly_pmi + monthly_tax + monthly_insurance + hoa_monthly


def compute_origination_fee(loan_amount: float, origination_points_pct: float) -> float:
    return loan_amount * (origination_points_pct / 100)


def compute_total_cash_invested(
    down_payment_amt: float,
    closing_cost_amt: float,
    renovation_cost: float,
    furniture_cost: float,
    other_upfront_costs: float,
    origination_fee: float = 0,
) -> float:
    return down_payment_amt + closing_cost_amt + renovation_cost + furniture_cost + other_upfront_costs + origination_fee


def compute_amortization_schedule(
    loan_amount: float, annual_rate: float, term_years: int, io_period_years: int = 0,
) -> list[dict]:
    if loan_amount <= 0 or term_years <= 0:
        return []
    monthly_rate = annual_rate / 100 / 12 if annual_rate > 0 else 0
    n_payments = term_years * 12
    io_months = io_period_years * 12
    balance = loan_amount

    # Compute amortizing payment for after IO period
    remaining_term = term_years - io_period_years
    if remaining_term > 0:
        amort_pi = compute_monthly_pi(loan_amount, annual_rate, remaining_term)
    else:
        amort_pi = 0

    schedule = []
    for month in range(1, n_payments + 1):
        interest = balance * monthly_rate
        if month <= io_months:
            # Interest-only period: no principal reduction
            principal = 0
        else:
            principal = amort_pi - interest

        balance -= principal
        if month == n_payments:
            balance = 0
        schedule.append({
            "month": month,
            "principal": principal,
            "interest": interest,
            "remaining_balance": balance,
        })
    return schedule
