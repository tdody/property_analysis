from app.services.computation.mortgage import compute_amortization_schedule


def compute_five_year_projection(
    year1_gross_revenue: float,
    year1_net_revenue: float,
    year1_opex: float,
    year1_cashflow: float,
    steady_state_gross_revenue: float,
    steady_state_net_revenue: float,
    steady_state_opex: float,
    revenue_growth_pct: float,
    expense_growth_pct: float,
    total_monthly_housing: float,
    monthly_pi: float,
    purchase_price: float,
    appreciation_pct: float,
    loan_amount: float,
    interest_rate: float,
    loan_term_years: int,
    total_cash_invested: float,
    platform_fee_pct: float,
    marginal_tax_rate_pct: float = 0,
    total_depreciation_annual: float = 0,
    io_period_years: int = 0,
    num_years: int = 5,
) -> list[dict]:
    annual_housing_cost = total_monthly_housing * 12

    # Build amortization schedule to get loan balances and interest at year boundaries
    schedule = compute_amortization_schedule(
        loan_amount, interest_rate, loan_term_years, io_period_years=io_period_years
    )

    def loan_balance_at_year(year: int) -> float:
        month_idx = year * 12 - 1  # 0-indexed
        if not schedule or month_idx < 0:
            return 0
        if month_idx >= len(schedule):
            return 0
        return schedule[month_idx]["remaining_balance"]

    def year_interest(year: int) -> float:
        if not schedule:
            return 0
        start = (year - 1) * 12
        end = year * 12
        return sum(m["interest"] for m in schedule[start:end])

    rev_growth = 1 + revenue_growth_pct / 100
    exp_growth = 1 + expense_growth_pct / 100
    tax_rate = marginal_tax_rate_pct / 100

    years = []
    cumulative_cashflow: float = 0

    for year in range(1, num_years + 1):
        if year == 1:
            gross = year1_gross_revenue
            net = year1_net_revenue
            opex = year1_opex
            cashflow = year1_cashflow
        else:
            gross = steady_state_gross_revenue * rev_growth ** (year - 1)
            net = gross * (1 - platform_fee_pct / 100)
            opex = steady_state_opex * exp_growth ** (year - 1)
            noi = net - opex
            cashflow = noi - annual_housing_cost

        if year == 1:
            noi = year1_net_revenue - year1_opex
        else:
            noi = net - opex

        # After-tax
        interest = year_interest(year)
        taxable = noi - interest - total_depreciation_annual
        tax = taxable * tax_rate
        after_tax = cashflow - tax

        cumulative_cashflow = cumulative_cashflow + cashflow
        prop_value = purchase_price * (1 + appreciation_pct / 100) ** year
        balance = loan_balance_at_year(year)
        equity = prop_value - balance
        coc = (cashflow / total_cash_invested * 100) if total_cash_invested > 0 else 0

        years.append(
            {
                "year": year,
                "gross_revenue": gross,
                "net_revenue": net,
                "total_opex": opex,
                "noi": noi,
                "annual_housing_cost": annual_housing_cost,
                "annual_cashflow": cashflow,
                "cumulative_cashflow": cumulative_cashflow,
                "property_value": prop_value,
                "loan_balance": balance,
                "equity": equity,
                "cash_on_cash_return": coc,
                "after_tax_cashflow": after_tax,
            }
        )

    return years
