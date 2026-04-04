from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.models.scenario import MortgageScenario
from app.models.assumptions import STRAssumptions
from app.schemas.results import (
    ComputedResultsResponse,
    AmortizationEntry,
    SensitivityResponse,
    ComparisonProperty,
    ProjectionResponse,
    ProjectionYear,
    MonthlyBreakdownResponse,
    MonthlyDetail,
)
from app.services.computation.mortgage import (
    compute_loan_amount,
    compute_monthly_pi,
    compute_pmi,
    compute_total_monthly_housing,
    compute_amortization_schedule,
)
from app.services.computation.revenue import (
    compute_gross_revenue, compute_net_revenue,
)
from app.services.computation.expenses import compute_operating_expenses
from app.services.computation.projections import compute_five_year_projection
from app.services.computation.irr import compute_irr, compute_equity_multiple
from app.services.computation.monthly import compute_monthly_breakdown
from app.services.computation.sensitivity import compute_sensitivity
from app.services.analysis import compute_for_scenario, get_occupancy, compute_fixed_opex

router = APIRouter(tags=["compute"])


def _get_prop_scenario_assumptions(property_id: str, scenario_id: str | None, db: Session):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    if scenario_id:
        scenario = db.query(MortgageScenario).filter(
            MortgageScenario.id == scenario_id,
            MortgageScenario.property_id == property_id,
        ).first()
    else:
        scenario = db.query(MortgageScenario).filter(
            MortgageScenario.property_id == property_id,
            MortgageScenario.is_active == True,
        ).first()

    if not scenario:
        raise HTTPException(status_code=404, detail="No scenario found")

    assumptions = db.query(STRAssumptions).filter(STRAssumptions.property_id == property_id).first()
    if not assumptions:
        raise HTTPException(status_code=404, detail="Assumptions not found")

    return prop, scenario, assumptions


@router.get("/api/properties/{property_id}/results", response_model=ComputedResultsResponse)
def get_results(property_id: str, db: Session = Depends(get_db)):
    prop, scenario, assumptions = _get_prop_scenario_assumptions(property_id, None, db)
    result = compute_for_scenario(prop, scenario, assumptions)
    prop.cached_monthly_cashflow = result["metrics"].monthly_cashflow
    prop.cached_cash_on_cash_return = result["metrics"].cash_on_cash_return
    db.commit()
    return result


@router.get("/api/properties/{property_id}/results/{scenario_id}", response_model=ComputedResultsResponse)
def get_results_for_scenario(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    prop, scenario, assumptions = _get_prop_scenario_assumptions(property_id, scenario_id, db)
    result = compute_for_scenario(prop, scenario, assumptions)
    prop.cached_monthly_cashflow = result["metrics"].monthly_cashflow
    prop.cached_cash_on_cash_return = result["metrics"].cash_on_cash_return
    db.commit()
    return result


@router.get("/api/properties/{property_id}/projections/{scenario_id}", response_model=ProjectionResponse)
def get_projections(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    prop, scenario, assumptions = _get_prop_scenario_assumptions(property_id, scenario_id, db)
    computed = compute_for_scenario(prop, scenario, assumptions)

    # Steady-state values (full 12 months, no delay) — uses effective occupancy
    occupancy = get_occupancy(assumptions)
    gross = compute_gross_revenue(
        float(assumptions.avg_nightly_rate), occupancy,
        float(assumptions.cleaning_fee_per_stay), float(assumptions.avg_stay_length_nights),
    )
    net = compute_net_revenue(gross["total_gross_revenue"], float(assumptions.platform_fee_pct))
    expenses = compute_operating_expenses(
        annual_turnovers=gross["annual_turnovers"],
        cleaning_cost_per_turn=float(assumptions.cleaning_cost_per_turn),
        net_annual_revenue=net["net_revenue"],
        gross_annual_revenue=gross["total_gross_revenue"],
        property_mgmt_pct=float(assumptions.property_mgmt_pct),
        maintenance_reserve_pct=float(assumptions.maintenance_reserve_pct),
        capex_reserve_pct=float(assumptions.capex_reserve_pct),
        utilities_monthly=float(assumptions.utilities_monthly),
        supplies_monthly=float(assumptions.supplies_monthly),
        lawn_snow_monthly=float(assumptions.lawn_snow_monthly),
        other_monthly_expense=float(assumptions.other_monthly_expense),
        local_str_registration_fee=float(assumptions.local_str_registration_fee),
        local_gross_receipts_tax_pct=float(assumptions.local_gross_receipts_tax_pct),
        damage_reserve_pct=float(assumptions.damage_reserve_pct),
        marketing_monthly=float(assumptions.marketing_monthly),
        software_monthly=float(assumptions.software_monthly),
        accounting_annual=float(assumptions.accounting_annual),
        legal_annual=float(assumptions.legal_annual),
    )

    loan_amount = compute_loan_amount(float(scenario.purchase_price), float(scenario.down_payment_amt))
    monthly_pi = compute_monthly_pi(loan_amount, float(scenario.interest_rate), scenario.loan_term_years)

    years = compute_five_year_projection(
        year1_gross_revenue=computed["revenue"].gross_annual,
        year1_net_revenue=computed["revenue"].net_annual,
        year1_opex=computed["expenses"].total_annual_operating,
        year1_cashflow=computed["metrics"].annual_cashflow,
        steady_state_gross_revenue=gross["total_gross_revenue"],
        steady_state_net_revenue=net["net_revenue"],
        steady_state_opex=expenses["total_annual_operating_exp"],
        revenue_growth_pct=float(assumptions.revenue_growth_pct),
        expense_growth_pct=float(assumptions.expense_growth_pct),
        total_monthly_housing=computed["mortgage"].total_monthly_housing,
        monthly_pi=monthly_pi,
        purchase_price=float(scenario.purchase_price),
        appreciation_pct=float(assumptions.property_appreciation_pct_annual),
        loan_amount=loan_amount,
        interest_rate=float(scenario.interest_rate),
        loan_term_years=scenario.loan_term_years,
        total_cash_invested=computed["mortgage"].total_cash_invested,
        platform_fee_pct=float(assumptions.platform_fee_pct),
        marginal_tax_rate_pct=float(assumptions.marginal_tax_rate_pct),
        total_depreciation_annual=computed["depreciation"].total_depreciation_annual,
        io_period_years=scenario.io_period_years or 0,
    )

    # IRR and equity multiple
    total_cash_invested = computed["mortgage"].total_cash_invested
    cashflows_for_irr = [-total_cash_invested] + [y["annual_cashflow"] for y in years]
    irr_result = compute_irr(cashflows_for_irr)
    cumulative_cf = years[-1]["cumulative_cashflow"] if years else 0
    eq_multiple = compute_equity_multiple(cumulative_cf, total_cash_invested)

    return ProjectionResponse(
        property_id=prop.id,
        scenario_id=scenario.id,
        years=[ProjectionYear(**{k: round(v, 2) if isinstance(v, float) else v for k, v in y.items()}) for y in years],
        irr=round(irr_result, 2) if irr_result is not None else None,
        equity_multiple=round(eq_multiple, 2),
    )


@router.get("/api/properties/{property_id}/monthly/{scenario_id}", response_model=MonthlyBreakdownResponse)
def get_monthly_breakdown(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    prop, scenario, assumptions = _get_prop_scenario_assumptions(property_id, scenario_id, db)
    computed = compute_for_scenario(prop, scenario, assumptions)

    use_seasonal = bool(assumptions.use_seasonal_occupancy)
    peak_months = assumptions.peak_months if use_seasonal else 6
    peak_occ = float(assumptions.peak_occupancy_pct) if use_seasonal else float(assumptions.occupancy_pct)
    off_peak_occ = float(assumptions.off_peak_occupancy_pct) if use_seasonal else float(assumptions.occupancy_pct)

    fixed_opex = compute_fixed_opex(assumptions)

    months = compute_monthly_breakdown(
        gross_annual_revenue=computed["revenue"].gross_annual,
        total_annual_opex=computed["expenses"].total_annual_operating,
        fixed_opex_annual=fixed_opex,
        total_monthly_housing=computed["mortgage"].total_monthly_housing,
        peak_months=peak_months,
        peak_occupancy_pct=peak_occ,
        off_peak_occupancy_pct=off_peak_occ,
        platform_fee_pct=float(assumptions.platform_fee_pct),
    )

    return MonthlyBreakdownResponse(
        property_id=prop.id,
        scenario_id=scenario.id,
        use_seasonal=use_seasonal,
        months=[MonthlyDetail(**{k: round(v, 2) if isinstance(v, float) else v for k, v in m.items()}) for m in months],
    )


@router.get("/api/properties/{property_id}/amortization/{scenario_id}", response_model=list[AmortizationEntry])
def get_amortization(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    scenario = db.query(MortgageScenario).filter(
        MortgageScenario.id == scenario_id,
        MortgageScenario.property_id == property_id,
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    loan_amount = compute_loan_amount(float(scenario.purchase_price), float(scenario.down_payment_amt))
    return compute_amortization_schedule(loan_amount, float(scenario.interest_rate), scenario.loan_term_years, io_period_years=scenario.io_period_years or 0)


@router.get("/api/properties/{property_id}/sensitivity", response_model=SensitivityResponse)
def get_sensitivity(property_id: str, db: Session = Depends(get_db)):
    prop, scenario, assumptions = _get_prop_scenario_assumptions(property_id, None, db)
    loan_amount = compute_loan_amount(float(scenario.purchase_price), float(scenario.down_payment_amt))
    monthly_pi = compute_monthly_pi(loan_amount, float(scenario.interest_rate), scenario.loan_term_years)
    monthly_pmi = compute_pmi(loan_amount, scenario.loan_type, float(scenario.down_payment_pct), None)
    total_monthly_housing = compute_total_monthly_housing(
        monthly_pi, monthly_pmi, float(prop.annual_taxes),
        float(assumptions.insurance_annual), float(prop.hoa_monthly),
        float(prop.nonhomestead_annual_taxes) if prop.nonhomestead_annual_taxes else None,
    )
    fixed_opex = compute_fixed_opex(assumptions)
    occupancy = get_occupancy(assumptions)

    return compute_sensitivity(
        avg_nightly_rate=float(assumptions.avg_nightly_rate),
        base_occupancy_pct=occupancy,
        cleaning_fee_per_stay=float(assumptions.cleaning_fee_per_stay),
        avg_stay_length_nights=float(assumptions.avg_stay_length_nights),
        platform_fee_pct=float(assumptions.platform_fee_pct),
        cleaning_cost_per_turn=float(assumptions.cleaning_cost_per_turn),
        property_mgmt_pct=float(assumptions.property_mgmt_pct),
        maintenance_reserve_pct=float(assumptions.maintenance_reserve_pct),
        capex_reserve_pct=float(assumptions.capex_reserve_pct),
        fixed_opex_annual=fixed_opex,
        total_monthly_housing=total_monthly_housing,
    )


@router.get("/api/compare", response_model=list[ComparisonProperty])
def compare_properties(ids: str = Query(...), db: Session = Depends(get_db)):
    property_ids = [i.strip() for i in ids.split(",")]
    results = []
    for pid in property_ids:
        try:
            prop, scenario, assumptions = _get_prop_scenario_assumptions(pid, None, db)
            computed = compute_for_scenario(prop, scenario, assumptions)
            results.append(ComparisonProperty(
                property_id=prop.id,
                property_name=prop.name,
                address=prop.address,
                city=prop.city,
                listing_price=float(prop.listing_price),
                beds=prop.beds,
                baths=float(prop.baths),
                sqft=prop.sqft,
                scenario_name=scenario.name,
                total_cash_invested=computed["mortgage"].total_cash_invested,
                monthly_cashflow=computed["metrics"].monthly_cashflow,
                annual_cashflow=computed["metrics"].annual_cashflow,
                cash_on_cash_return=computed["metrics"].cash_on_cash_return,
                cap_rate=computed["metrics"].cap_rate,
                noi=computed["metrics"].noi,
                break_even_occupancy=computed["metrics"].break_even_occupancy,
                dscr=computed["metrics"].dscr,
                gross_yield=computed["metrics"].gross_yield,
            ))
        except HTTPException:
            continue
    return results
