def compute_irr(cashflows: list[float], max_iterations: int = 100, tolerance: float = 1e-7) -> float | None:
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


def compute_equity_multiple(cumulative_cashflow: float, total_cash_invested: float) -> float:
    if total_cash_invested <= 0:
        return 0
    return cumulative_cashflow / total_cash_invested
