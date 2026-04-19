"""Tornado sensitivity analysis for STR and LTR properties."""

from app.services.computation.revenue import compute_gross_revenue, compute_net_revenue
from app.services.computation.expenses import compute_operating_expenses
from app.services.computation.metrics import (
    compute_noi,
    compute_cashflow,
    compute_cash_on_cash_return,
    compute_cap_rate,
)
from app.services.computation.ltr_revenue import (
    compute_ltr_gross_revenue,
    compute_ltr_effective_revenue,
)
from app.services.computation.ltr_expenses import compute_ltr_operating_expenses


METRIC_LABELS = {
    "monthly_cashflow": "Monthly Cashflow",
    "cash_on_cash_return": "Cash-on-Cash Return",
    "cap_rate": "Cap Rate",
}

VALID_METRICS = set(METRIC_LABELS.keys())

STR_VARIABLES = [
    ("occupancy_pct", "Occupancy Rate", "abs", 15),
    ("avg_nightly_rate", "Nightly Rate", "pct", 25),
    ("platform_fee_pct", "Platform Fee", "abs", 3),
    ("property_mgmt_pct", "Property Mgmt %", "abs", 5),
    ("cleaning_cost_per_turn", "Cleaning Cost / Turn", "pct", 30),
    ("maintenance_reserve_pct", "Maintenance Reserve", "abs", 3),
    ("capex_reserve_pct", "CapEx Reserve", "abs", 3),
    ("avg_stay_length_nights", "Avg Stay Length", "abs", 1.5),
]

LTR_VARIABLES = [
    ("monthly_rent", "Monthly Rent", "pct", 20),
    ("vacancy_rate_pct", "Vacancy Rate", "abs", 5),
    ("property_mgmt_pct", "Property Mgmt %", "abs", 5),
    ("maintenance_reserve_pct", "Maintenance Reserve", "abs", 3),
    ("capex_reserve_pct", "CapEx Reserve", "abs", 3),
    ("tenant_turnover_cost", "Tenant Turnover Cost", "pct", 50),
]


def _compute_low_high(baseline, range_type, delta, floor=0.0, ceiling=None):
    """Compute low/high values from a baseline, range type, and delta."""
    if range_type == "abs":
        low = max(baseline - delta, floor)
        high = baseline + delta
        if ceiling is not None:
            high = min(high, ceiling)
    elif range_type == "pct":
        low = max(baseline * (1 - delta / 100), floor)
        high = baseline * (1 + delta / 100)
        if ceiling is not None:
            high = min(high, ceiling)
    else:
        raise ValueError(f"Unknown range_type: {range_type}")
    return low, high


def _str_metric(
    metric_key,
    avg_nightly_rate,
    occupancy_pct,
    cleaning_fee_per_stay,
    avg_stay_length_nights,
    platform_fee_pct,
    cleaning_cost_per_turn,
    property_mgmt_pct,
    maintenance_reserve_pct,
    capex_reserve_pct,
    fixed_opex_annual,
    total_monthly_housing,
    total_cash_invested,
    purchase_price,
    monthly_pi,
):
    """Run full STR pipeline and extract one metric."""
    gross = compute_gross_revenue(
        avg_nightly_rate, occupancy_pct, cleaning_fee_per_stay, avg_stay_length_nights
    )
    net = compute_net_revenue(gross["total_gross_revenue"], platform_fee_pct)
    expenses = compute_operating_expenses(
        annual_turnovers=gross["annual_turnovers"],
        cleaning_cost_per_turn=cleaning_cost_per_turn,
        net_annual_revenue=net["net_revenue"],
        gross_annual_revenue=gross["total_gross_revenue"],
        property_mgmt_pct=property_mgmt_pct,
        maintenance_reserve_pct=maintenance_reserve_pct,
        capex_reserve_pct=capex_reserve_pct,
        utilities_monthly=0,
        supplies_monthly=0,
        lawn_snow_monthly=0,
        other_monthly_expense=0,
        local_str_registration_fee=0,
    )
    total_opex = expenses["total_annual_operating_exp"] + fixed_opex_annual
    noi = compute_noi(net["net_revenue"], total_opex)

    if metric_key == "monthly_cashflow":
        cf = compute_cashflow(noi, total_monthly_housing)
        return cf["monthly_cashflow"]
    elif metric_key == "cash_on_cash_return":
        cf = compute_cashflow(noi, total_monthly_housing)
        return compute_cash_on_cash_return(cf["annual_cashflow"], total_cash_invested)
    elif metric_key == "cap_rate":
        return compute_cap_rate(noi, purchase_price)
    else:
        raise ValueError(f"Unknown metric_key: {metric_key}")


def _ltr_metric(
    metric_key,
    monthly_rent,
    pet_rent_monthly,
    late_fee_monthly,
    vacancy_rate_pct,
    property_mgmt_pct,
    maintenance_reserve_pct,
    capex_reserve_pct,
    fixed_opex_annual,
    tenant_turnover_cost,
    lease_duration_months,
    total_monthly_housing,
    total_cash_invested,
    purchase_price,
):
    """Run full LTR pipeline and extract one metric."""
    gross = compute_ltr_gross_revenue(monthly_rent, pet_rent_monthly, late_fee_monthly)
    effective = compute_ltr_effective_revenue(gross, vacancy_rate_pct)
    expenses = compute_ltr_operating_expenses(
        effective_annual_revenue=effective,
        gross_annual_revenue=gross,
        property_mgmt_pct=property_mgmt_pct,
        maintenance_reserve_pct=maintenance_reserve_pct,
        capex_reserve_pct=capex_reserve_pct,
        tenant_turnover_cost=tenant_turnover_cost,
        lease_duration_months=lease_duration_months,
        insurance_annual=0,
        landlord_repairs_annual=0,
        utilities_monthly=0,
        lawn_snow_monthly=0,
        other_monthly_expense=0,
        accounting_annual=0,
        legal_annual=0,
    )
    total_opex = expenses["total_annual_operating_exp"] + fixed_opex_annual
    noi = compute_noi(effective, total_opex)

    if metric_key == "monthly_cashflow":
        cf = compute_cashflow(noi, total_monthly_housing)
        return cf["monthly_cashflow"]
    elif metric_key == "cash_on_cash_return":
        cf = compute_cashflow(noi, total_monthly_housing)
        return compute_cash_on_cash_return(cf["annual_cashflow"], total_cash_invested)
    elif metric_key == "cap_rate":
        return compute_cap_rate(noi, purchase_price)
    else:
        raise ValueError(f"Unknown metric_key: {metric_key}")


def _build_tornado_bars(metric_key, variables, metric_fn, base_params):
    """Generic tornado bar builder for both STR and LTR."""
    if metric_key not in VALID_METRICS:
        raise ValueError(
            f"Invalid metric_key '{metric_key}'. Must be one of {VALID_METRICS}"
        )

    baseline_value = metric_fn(metric_key, **base_params)
    bars = []

    for var_name, var_label, range_type, delta in variables:
        baseline_input = base_params[var_name]

        # Determine floor/ceiling
        kwargs = {"floor": 0.0}
        if var_name == "occupancy_pct":
            kwargs["ceiling"] = 100
        elif var_name == "avg_stay_length_nights":
            kwargs["floor"] = 1.0

        low_input, high_input = _compute_low_high(
            baseline_input, range_type, delta, **kwargs
        )

        # Compute metric at low and high
        low_params = {**base_params, var_name: low_input}
        high_params = {**base_params, var_name: high_input}
        low_output = metric_fn(metric_key, **low_params)
        high_output = metric_fn(metric_key, **high_params)

        # Sweep: 11 points from low to high
        num_points = 11
        sweep = []
        if num_points > 1:
            step = (high_input - low_input) / (num_points - 1)
        else:
            step = 0
        for i in range(num_points):
            input_val = low_input + i * step
            sweep_params = {**base_params, var_name: input_val}
            output_val = metric_fn(metric_key, **sweep_params)
            sweep.append({"input_value": input_val, "output_value": output_val})

        spread = abs(high_output - low_output)

        bars.append(
            {
                "variable_name": var_name,
                "variable_label": var_label,
                "baseline_input": baseline_input,
                "low_input": low_input,
                "high_input": high_input,
                "low_output": low_output,
                "high_output": high_output,
                "spread": spread,
                "sweep": sweep,
            }
        )

    bars.sort(key=lambda b: b["spread"], reverse=True)

    return {
        "metric_key": metric_key,
        "metric_label": METRIC_LABELS[metric_key],
        "baseline_value": float(baseline_value),
        "bars": bars,
    }


def compute_tornado(
    metric_key,
    avg_nightly_rate,
    occupancy_pct,
    cleaning_fee_per_stay,
    avg_stay_length_nights,
    platform_fee_pct,
    cleaning_cost_per_turn,
    property_mgmt_pct,
    maintenance_reserve_pct,
    capex_reserve_pct,
    fixed_opex_annual,
    total_monthly_housing,
    total_cash_invested,
    purchase_price,
    monthly_pi,
):
    """Compute STR tornado sensitivity analysis."""
    base_params = dict(
        avg_nightly_rate=avg_nightly_rate,
        occupancy_pct=occupancy_pct,
        cleaning_fee_per_stay=cleaning_fee_per_stay,
        avg_stay_length_nights=avg_stay_length_nights,
        platform_fee_pct=platform_fee_pct,
        cleaning_cost_per_turn=cleaning_cost_per_turn,
        property_mgmt_pct=property_mgmt_pct,
        maintenance_reserve_pct=maintenance_reserve_pct,
        capex_reserve_pct=capex_reserve_pct,
        fixed_opex_annual=fixed_opex_annual,
        total_monthly_housing=total_monthly_housing,
        total_cash_invested=total_cash_invested,
        purchase_price=purchase_price,
        monthly_pi=monthly_pi,
    )
    return _build_tornado_bars(metric_key, STR_VARIABLES, _str_metric, base_params)


def compute_ltr_tornado(
    metric_key,
    monthly_rent,
    pet_rent_monthly,
    late_fee_monthly,
    vacancy_rate_pct,
    property_mgmt_pct,
    maintenance_reserve_pct,
    capex_reserve_pct,
    fixed_opex_annual,
    tenant_turnover_cost,
    lease_duration_months,
    total_monthly_housing,
    total_cash_invested,
    purchase_price,
):
    """Compute LTR tornado sensitivity analysis."""
    base_params = dict(
        monthly_rent=monthly_rent,
        pet_rent_monthly=pet_rent_monthly,
        late_fee_monthly=late_fee_monthly,
        vacancy_rate_pct=vacancy_rate_pct,
        property_mgmt_pct=property_mgmt_pct,
        maintenance_reserve_pct=maintenance_reserve_pct,
        capex_reserve_pct=capex_reserve_pct,
        fixed_opex_annual=fixed_opex_annual,
        tenant_turnover_cost=tenant_turnover_cost,
        lease_duration_months=lease_duration_months,
        total_monthly_housing=total_monthly_housing,
        total_cash_invested=total_cash_invested,
        purchase_price=purchase_price,
    )
    return _build_tornado_bars(metric_key, LTR_VARIABLES, _ltr_metric, base_params)
