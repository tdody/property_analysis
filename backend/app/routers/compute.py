from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.models.scenario import MortgageScenario
from app.models.assumptions import STRAssumptions
from app.schemas.results import (
    ComputedResultsResponse,
    MortgageResults,
    RevenueResults,
    ExpenseResults,
    ExpenseBreakdown,
    MetricsResults,
    AmortizationEntry,
    SensitivityResponse,
    ComparisonProperty,
)
from app.services.computation.mortgage import (
    compute_loan_amount,
    compute_monthly_pi,
    compute_pmi,
    compute_total_monthly_housing,
    compute_total_cash_invested,
    compute_amortization_schedule,
)
from app.services.computation.revenue import compute_gross_revenue, compute_net_revenue
from app.services.computation.expenses import compute_operating_expenses
from app.services.computation.metrics import compute_all_metrics
from app.services.computation.sensitivity import compute_sensitivity

router = APIRouter(tags=["compute"])


def _compute_for_scenario(prop: Property, scenario: MortgageScenario, assumptions: STRAssumptions) -> dict:
    # Mortgage
    loan_amount = compute_loan_amount(float(scenario.purchase_price), float(scenario.down_payment_amt))
    monthly_pi = compute_monthly_pi(loan_amount, float(scenario.interest_rate), scenario.loan_term_years)
    monthly_pmi = compute_pmi(
        loan_amount, scenario.loan_type, float(scenario.down_payment_pct),
        pmi_override=float(scenario.pmi_monthly) if scenario.pmi_monthly else None,
    )
    total_monthly_housing = compute_total_monthly_housing(
        monthly_pi, monthly_pmi, float(prop.annual_taxes),
        float(assumptions.insurance_annual), float(prop.hoa_monthly),
        float(prop.nonhomestead_annual_taxes) if prop.nonhomestead_annual_taxes else None,
    )
    total_cash = compute_total_cash_invested(
        float(scenario.down_payment_amt), float(scenario.closing_cost_amt),
        float(scenario.renovation_cost), float(scenario.furniture_cost),
        float(scenario.other_upfront_costs),
    )

    # Revenue
    gross = compute_gross_revenue(
        float(assumptions.avg_nightly_rate), float(assumptions.occupancy_pct),
        float(assumptions.cleaning_fee_per_stay), float(assumptions.avg_stay_length_nights),
    )
    net = compute_net_revenue(gross["total_gross_revenue"], float(assumptions.platform_fee_pct))

    # Expenses
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
    )

    total_opex = expenses["total_annual_operating_exp"]

    # Fixed opex for break-even calc (does NOT include insurance — that's in total_monthly_housing)
    fixed_opex = (
        float(assumptions.utilities_monthly) * 12
        + float(assumptions.supplies_monthly) * 12
        + float(assumptions.lawn_snow_monthly) * 12
        + float(assumptions.other_monthly_expense) * 12
        + float(assumptions.local_str_registration_fee)
    )

    # Year-1 equity
    schedule = compute_amortization_schedule(loan_amount, float(scenario.interest_rate), scenario.loan_term_years)
    year1_equity = sum(m["principal"] for m in schedule[:12]) if schedule else 0

    # Metrics
    metrics = compute_all_metrics(
        net_annual_revenue=net["net_revenue"],
        total_annual_operating_exp=total_opex,
        monthly_pi=monthly_pi,
        total_cash_invested=total_cash,
        purchase_price=float(scenario.purchase_price),
        gross_annual_revenue=gross["total_gross_revenue"],
        year1_equity_buildup=year1_equity,
        avg_nightly_rate=float(assumptions.avg_nightly_rate),
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

    return {
        "property_id": prop.id,
        "scenario_id": scenario.id,
        "scenario_name": scenario.name,
        "mortgage": MortgageResults(
            loan_amount=round(loan_amount, 2),
            monthly_pi=round(monthly_pi, 2),
            monthly_pmi=round(monthly_pmi, 2),
            total_monthly_housing=round(total_monthly_housing, 2),
            total_cash_invested=round(total_cash, 2),
        ),
        "revenue": RevenueResults(
            gross_annual=round(gross["total_gross_revenue"], 2),
            net_annual=round(net["net_revenue"], 2),
            annual_turnovers=round(gross["annual_turnovers"], 2),
        ),
        "expenses": ExpenseResults(
            total_annual_operating=round(total_opex, 2),
            breakdown=ExpenseBreakdown(
                annual_cleaning_cost=round(expenses["annual_cleaning_cost"], 2),
                property_mgmt_cost=round(expenses["property_mgmt_cost"], 2),
                maintenance_reserve=round(expenses["maintenance_reserve"], 2),
                capex_reserve=round(expenses["capex_reserve"], 2),
                utilities_annual=round(expenses["utilities_annual"], 2),
                supplies_annual=round(expenses["supplies_annual"], 2),
                lawn_snow_annual=round(expenses["lawn_snow_annual"], 2),
                other_annual=round(expenses["other_annual"], 2),
                registration_annual=round(expenses["registration_annual"], 2),
                insurance_annual=float(assumptions.insurance_annual),
            ),
        ),
        "metrics": MetricsResults(
            monthly_cashflow=round(metrics["monthly_cashflow"], 2),
            annual_cashflow=round(metrics["annual_cashflow"], 2),
            cash_on_cash_return=round(metrics["cash_on_cash_return"], 2),
            cap_rate=round(metrics["cap_rate"], 2),
            noi=round(metrics["noi"], 2),
            break_even_occupancy=round(metrics["break_even_occupancy"], 2),
            dscr=round(metrics["dscr"], 2),
            gross_yield=round(metrics["gross_yield"], 2),
            total_roi_year1=round(metrics["total_roi_year1"], 2),
        ),
    }


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
    return _compute_for_scenario(prop, scenario, assumptions)


@router.get("/api/properties/{property_id}/results/{scenario_id}", response_model=ComputedResultsResponse)
def get_results_for_scenario(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    prop, scenario, assumptions = _get_prop_scenario_assumptions(property_id, scenario_id, db)
    return _compute_for_scenario(prop, scenario, assumptions)


@router.get("/api/properties/{property_id}/amortization/{scenario_id}", response_model=list[AmortizationEntry])
def get_amortization(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    scenario = db.query(MortgageScenario).filter(
        MortgageScenario.id == scenario_id,
        MortgageScenario.property_id == property_id,
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    loan_amount = compute_loan_amount(float(scenario.purchase_price), float(scenario.down_payment_amt))
    return compute_amortization_schedule(loan_amount, float(scenario.interest_rate), scenario.loan_term_years)


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
    fixed_opex = (
        float(assumptions.utilities_monthly) * 12
        + float(assumptions.supplies_monthly) * 12
        + float(assumptions.lawn_snow_monthly) * 12
        + float(assumptions.other_monthly_expense) * 12
        + float(assumptions.local_str_registration_fee)
    )

    return compute_sensitivity(
        avg_nightly_rate=float(assumptions.avg_nightly_rate),
        base_occupancy_pct=float(assumptions.occupancy_pct),
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
            computed = _compute_for_scenario(prop, scenario, assumptions)
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
