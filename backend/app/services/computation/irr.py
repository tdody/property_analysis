from collections.abc import Sequence


def compute_irr(
    cashflows: Sequence[float], max_iterations: int = 100, tolerance: float = 1e-7
) -> float | None:
    """Compute IRR using Newton-Raphson method. Returns None if it doesn't converge."""
    if not cashflows or len(cashflows) < 2:
        return None

    # Initial guess
    rate = 0.1

    for _ in range(max_iterations):
        npv = sum(cf / (1 + rate) ** t for t, cf in enumerate(cashflows))
        dnpv = sum(-t * cf / (1 + rate) ** (t + 1) for t, cf in enumerate(cashflows))

        if abs(dnpv) < 1e-12:
            return None

        new_rate = rate - npv / dnpv

        if abs(new_rate - rate) < tolerance:
            return new_rate * 100  # Return as percentage

        rate = new_rate

        # Guard against divergence
        if rate < -0.99 or rate > 10:
            return None

    return None


def compute_equity_multiple(
    cumulative_cashflow: float, total_cash_invested: float
) -> float:
    if total_cash_invested <= 0:
        return 0
    return cumulative_cashflow / total_cash_invested


def compute_exit_proceeds(
    purchase_price: float,
    appreciation_pct: float,
    hold_years: int,
    selling_cost_pct: float,
    remaining_mortgage: float,
    total_depreciation: float,
    capital_gains_rate_pct: float,
    depreciation_recapture_rate_pct: float,
) -> dict:
    sale_price = purchase_price * (1 + appreciation_pct / 100) ** hold_years
    selling_costs = sale_price * selling_cost_pct / 100
    cost_basis = purchase_price - total_depreciation
    capital_gain = sale_price - selling_costs - cost_basis
    depreciation_recapture_tax = total_depreciation * depreciation_recapture_rate_pct / 100
    capital_gains_on_appreciation = max(0, capital_gain - total_depreciation) * capital_gains_rate_pct / 100
    net_proceeds = (
        sale_price
        - selling_costs
        - remaining_mortgage
        - depreciation_recapture_tax
        - capital_gains_on_appreciation
    )
    return {
        "sale_price": sale_price,
        "selling_costs": selling_costs,
        "remaining_mortgage": remaining_mortgage,
        "total_depreciation": total_depreciation,
        "depreciation_recapture_tax": depreciation_recapture_tax,
        "capital_gain": capital_gain,
        "capital_gains_tax": capital_gains_on_appreciation,
        "net_exit_proceeds": net_proceeds,
    }


def compute_irr_with_exit(
    annual_cashflows: list[float],
    total_cash_invested: float,
    net_exit_proceeds: float,
) -> float | None:
    if not annual_cashflows:
        return None
    cashflows = [-total_cash_invested] + list(annual_cashflows)
    cashflows[-1] += net_exit_proceeds
    return compute_irr(cashflows)


def compute_hold_period_sweep(
    purchase_price: float,
    appreciation_pct: float,
    selling_cost_pct: float,
    total_cash_invested: float,
    depreciation_annual: float,
    capital_gains_rate_pct: float,
    depreciation_recapture_rate_pct: float,
    loan_amount: float,
    interest_rate: float,
    loan_term_years: int,
    annual_cashflows_15: list[float],
    get_remaining_mortgage: callable,
) -> list[dict]:
    results = []
    for hold in range(3, 16):
        cfs = annual_cashflows_15[:hold]
        if len(cfs) < hold:
            break
        remaining = get_remaining_mortgage(hold)
        total_dep = depreciation_annual * hold
        exit_info = compute_exit_proceeds(
            purchase_price, appreciation_pct, hold, selling_cost_pct,
            remaining, total_dep, capital_gains_rate_pct, depreciation_recapture_rate_pct,
        )
        irr = compute_irr_with_exit(cfs, total_cash_invested, exit_info["net_exit_proceeds"])
        results.append({"hold_period": hold, "irr": round(irr, 2) if irr is not None else None})
    return results
