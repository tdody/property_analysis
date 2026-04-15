from typing import Any

from app.services.computation.revenue import compute_gross_revenue, compute_net_revenue
from app.services.computation.expenses import compute_operating_expenses
from app.services.computation.metrics import compute_noi, compute_cashflow


def _compute_cashflow_for_params(
    avg_nightly_rate: float,
    occupancy_pct: float,
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
    cf = compute_cashflow(noi, total_monthly_housing)
    return cf["monthly_cashflow"]


def compute_sensitivity(
    avg_nightly_rate: float,
    base_occupancy_pct: float,
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
    common = dict(
        cleaning_fee_per_stay=cleaning_fee_per_stay,
        avg_stay_length_nights=avg_stay_length_nights,
        platform_fee_pct=platform_fee_pct,
        cleaning_cost_per_turn=cleaning_cost_per_turn,
        property_mgmt_pct=property_mgmt_pct,
        maintenance_reserve_pct=maintenance_reserve_pct,
        capex_reserve_pct=capex_reserve_pct,
        fixed_opex_annual=fixed_opex_annual,
        total_monthly_housing=total_monthly_housing,
    )
    occupancy_sweep = []
    for occ in range(30, 101, 5):
        cf = _compute_cashflow_for_params(
            avg_nightly_rate=avg_nightly_rate, occupancy_pct=float(occ), **common
        )
        occupancy_sweep.append({"occupancy_pct": occ, "monthly_cashflow": round(cf, 2)})
    rate_sweep = []
    for pct_delta in range(-30, 31, 5):
        adjusted_rate = avg_nightly_rate * (1 + pct_delta / 100)
        cf = _compute_cashflow_for_params(
            avg_nightly_rate=adjusted_rate, occupancy_pct=base_occupancy_pct, **common
        )
        rate_sweep.append(
            {"nightly_rate": round(adjusted_rate, 2), "monthly_cashflow": round(cf, 2)}
        )
    return {"occupancy_sweep": occupancy_sweep, "rate_sweep": rate_sweep}


def _compute_ltr_cashflow_for_params(
    monthly_rent: float,
    pet_rent_monthly: float,
    late_fee_monthly: float,
    vacancy_rate_pct: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    fixed_opex_annual: float,
    tenant_turnover_cost: float,
    lease_duration_months: int,
    total_monthly_housing: float,
) -> float:
    """Compute LTR monthly cashflow for a single parameter combination."""
    from app.services.computation.ltr_revenue import (
        compute_ltr_gross_revenue,
        compute_ltr_effective_revenue,
    )
    from app.services.computation.ltr_expenses import compute_ltr_operating_expenses

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
        insurance_annual=0,  # included in fixed_opex_annual
        landlord_repairs_annual=0,
        utilities_monthly=0,
        lawn_snow_monthly=0,
        other_monthly_expense=0,
        accounting_annual=0,
        legal_annual=0,
    )
    # Variable opex from recomputed + fixed from caller
    total_opex = expenses["total_annual_operating_exp"] + fixed_opex_annual
    noi = compute_noi(effective, total_opex)
    cf = compute_cashflow(noi, total_monthly_housing)
    return cf["monthly_cashflow"]


def compute_ltr_sensitivity(
    monthly_rent: float,
    pet_rent_monthly: float,
    late_fee_monthly: float,
    base_vacancy_rate_pct: float,
    property_mgmt_pct: float,
    maintenance_reserve_pct: float,
    capex_reserve_pct: float,
    fixed_opex_annual: float,
    tenant_turnover_cost: float,
    lease_duration_months: int,
    total_monthly_housing: float,
) -> dict:
    """LTR sensitivity analysis: rent sweep +/-30% and vacancy sweep 0-25%."""
    common: dict[str, Any] = dict(
        pet_rent_monthly=pet_rent_monthly,
        late_fee_monthly=late_fee_monthly,
        property_mgmt_pct=property_mgmt_pct,
        maintenance_reserve_pct=maintenance_reserve_pct,
        capex_reserve_pct=capex_reserve_pct,
        fixed_opex_annual=fixed_opex_annual,
        tenant_turnover_cost=tenant_turnover_cost,
        lease_duration_months=lease_duration_months,
        total_monthly_housing=total_monthly_housing,
    )

    # Vacancy sweep: 0% to 25% in 1% increments
    vacancy_sweep = []
    for vac in range(0, 26):
        cf = _compute_ltr_cashflow_for_params(
            monthly_rent=monthly_rent,
            vacancy_rate_pct=float(vac),
            **common,
        )
        vacancy_sweep.append({"vacancy_pct": vac, "monthly_cashflow": round(cf, 2)})

    # Rent sweep: +/-30% in 5% increments
    rent_sweep = []
    for pct_delta in range(-30, 31, 5):
        adjusted_rent = monthly_rent * (1 + pct_delta / 100)
        cf = _compute_ltr_cashflow_for_params(
            monthly_rent=adjusted_rent,
            vacancy_rate_pct=base_vacancy_rate_pct,
            **common,
        )
        rent_sweep.append(
            {"monthly_rent": round(adjusted_rent, 2), "monthly_cashflow": round(cf, 2)}
        )

    return {"vacancy_sweep": vacancy_sweep, "rent_sweep": rent_sweep}
