from app.services.computation.revenue import compute_gross_revenue, compute_net_revenue
from app.services.computation.expenses import compute_operating_expenses
from app.services.computation.metrics import compute_noi, compute_cashflow

def _compute_cashflow_for_params(avg_nightly_rate, occupancy_pct, cleaning_fee_per_stay, avg_stay_length_nights, platform_fee_pct, cleaning_cost_per_turn, property_mgmt_pct, maintenance_reserve_pct, capex_reserve_pct, fixed_opex_annual, total_monthly_housing):
    gross = compute_gross_revenue(avg_nightly_rate, occupancy_pct, cleaning_fee_per_stay, avg_stay_length_nights)
    net = compute_net_revenue(gross["total_gross_revenue"], platform_fee_pct)
    expenses = compute_operating_expenses(annual_turnovers=gross["annual_turnovers"], cleaning_cost_per_turn=cleaning_cost_per_turn, net_annual_revenue=net["net_revenue"], gross_annual_revenue=gross["total_gross_revenue"], property_mgmt_pct=property_mgmt_pct, maintenance_reserve_pct=maintenance_reserve_pct, capex_reserve_pct=capex_reserve_pct, utilities_monthly=0, supplies_monthly=0, lawn_snow_monthly=0, other_monthly_expense=0, local_str_registration_fee=0)
    total_opex = expenses["total_annual_operating_exp"] + fixed_opex_annual
    noi = compute_noi(net["net_revenue"], total_opex)
    cf = compute_cashflow(noi, total_monthly_housing)
    return cf["monthly_cashflow"]

def compute_sensitivity(avg_nightly_rate, base_occupancy_pct, cleaning_fee_per_stay, avg_stay_length_nights, platform_fee_pct, cleaning_cost_per_turn, property_mgmt_pct, maintenance_reserve_pct, capex_reserve_pct, fixed_opex_annual, total_monthly_housing):
    common = dict(cleaning_fee_per_stay=cleaning_fee_per_stay, avg_stay_length_nights=avg_stay_length_nights, platform_fee_pct=platform_fee_pct, cleaning_cost_per_turn=cleaning_cost_per_turn, property_mgmt_pct=property_mgmt_pct, maintenance_reserve_pct=maintenance_reserve_pct, capex_reserve_pct=capex_reserve_pct, fixed_opex_annual=fixed_opex_annual, total_monthly_housing=total_monthly_housing)
    occupancy_sweep = []
    for occ in range(30, 101, 5):
        cf = _compute_cashflow_for_params(avg_nightly_rate=avg_nightly_rate, occupancy_pct=float(occ), **common)
        occupancy_sweep.append({"occupancy_pct": occ, "monthly_cashflow": round(cf, 2)})
    rate_sweep = []
    for pct_delta in range(-30, 31, 5):
        adjusted_rate = avg_nightly_rate * (1 + pct_delta / 100)
        cf = _compute_cashflow_for_params(avg_nightly_rate=adjusted_rate, occupancy_pct=base_occupancy_pct, **common)
        rate_sweep.append({"nightly_rate": round(adjusted_rate, 2), "monthly_cashflow": round(cf, 2)})
    return {"occupancy_sweep": occupancy_sweep, "rate_sweep": rate_sweep}
