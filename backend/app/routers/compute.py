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
    TaxImpactInfo,
    DepreciationInfo,
    ProjectionResponse,
    ProjectionYear,
    MonthlyBreakdownResponse,
    MonthlyDetail,
)
from app.services.computation.mortgage import (
    compute_loan_amount,
    compute_monthly_pi,
    compute_io_monthly_payment,
    compute_pmi,
    compute_total_monthly_housing,
    compute_total_cash_invested,
    compute_amortization_schedule,
    compute_origination_fee,
)
from app.services.computation.revenue import (
    compute_gross_revenue, compute_net_revenue, compute_year1_revenue,
    compute_effective_occupancy,
)
from app.services.computation.expenses import compute_operating_expenses
from app.services.computation.metrics import (
    compute_all_metrics, compute_delay_carrying_costs,
    compute_appreciation_year1, compute_total_roi_year1_with_appreciation,
    compute_tax_analysis,
)
from app.services.computation.depreciation import compute_depreciation
from app.services.computation.projections import compute_five_year_projection
from app.services.computation.irr import compute_irr, compute_equity_multiple
from app.services.computation.monthly import compute_monthly_breakdown
from app.services.computation.sensitivity import compute_sensitivity

router = APIRouter(tags=["compute"])


def _get_occupancy(assumptions: STRAssumptions) -> float:
    if assumptions.use_seasonal_occupancy:
        return compute_effective_occupancy(
            assumptions.peak_months,
            float(assumptions.peak_occupancy_pct),
            float(assumptions.off_peak_occupancy_pct),
        )
    return float(assumptions.occupancy_pct)


def _compute_fixed_opex(assumptions: STRAssumptions) -> float:
    return (
        float(assumptions.utilities_monthly) * 12
        + float(assumptions.supplies_monthly) * 12
        + float(assumptions.lawn_snow_monthly) * 12
        + float(assumptions.other_monthly_expense) * 12
        + float(assumptions.marketing_monthly) * 12
        + float(assumptions.software_monthly) * 12
        + float(assumptions.accounting_annual)
        + float(assumptions.legal_annual)
        + float(assumptions.local_str_registration_fee)
    )


def _compute_for_scenario(prop: Property, scenario: MortgageScenario, assumptions: STRAssumptions) -> dict:
    # Mortgage
    loan_amount = compute_loan_amount(float(scenario.purchase_price), float(scenario.down_payment_amt))
    io_years = scenario.io_period_years or 0
    # During IO period, monthly payment is interest-only
    if io_years > 0:
        monthly_pi = compute_io_monthly_payment(loan_amount, float(scenario.interest_rate))
    else:
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
    origination_fee = compute_origination_fee(loan_amount, float(scenario.origination_points_pct))
    total_cash = compute_total_cash_invested(
        float(scenario.down_payment_amt), float(scenario.closing_cost_amt),
        float(scenario.renovation_cost), float(scenario.furniture_cost),
        float(scenario.other_upfront_costs),
        origination_fee=origination_fee,
    )

    # Revenue (uses effective occupancy when seasonal mode is on)
    occupancy = _get_occupancy(assumptions)
    gross = compute_gross_revenue(
        float(assumptions.avg_nightly_rate), occupancy,
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
        local_gross_receipts_tax_pct=float(assumptions.local_gross_receipts_tax_pct),
        damage_reserve_pct=float(assumptions.damage_reserve_pct),
        marketing_monthly=float(assumptions.marketing_monthly),
        software_monthly=float(assumptions.software_monthly),
        accounting_annual=float(assumptions.accounting_annual),
        legal_annual=float(assumptions.legal_annual),
    )

    total_opex = expenses["total_annual_operating_exp"]
    fixed_opex = _compute_fixed_opex(assumptions)

    # Year-1 equity
    schedule = compute_amortization_schedule(loan_amount, float(scenario.interest_rate), scenario.loan_term_years, io_period_years=io_years)
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

    # Rental delay adjustments for Year-1
    rental_delay = int(assumptions.rental_delay_months) if assumptions.rental_delay_months else 0
    if rental_delay > 0:
        year1_gross = compute_year1_revenue(gross["total_gross_revenue"], rental_delay)
        year1_net = compute_year1_revenue(net["net_revenue"], rental_delay)
        # Variable expenses scale with revenue; fixed expenses stay the same
        year1_opex_variable = total_opex - fixed_opex
        year1_opex = fixed_opex + year1_opex_variable * (12 - rental_delay) / 12
        year1_noi = year1_net - year1_opex
        year1_fixed_costs = total_monthly_housing * 12
        year1_annual_cashflow = year1_noi - year1_fixed_costs
        year1_monthly_cashflow = year1_annual_cashflow / 12
        carrying_costs = compute_delay_carrying_costs(total_monthly_housing, rental_delay)
        year1_total_cash = total_cash + carrying_costs
        year1_coc = (year1_annual_cashflow / year1_total_cash * 100) if year1_total_cash > 0 else 0
        year1_roi = ((year1_annual_cashflow + year1_equity) / year1_total_cash * 100) if year1_total_cash > 0 else 0
        # Override metrics with Year-1 adjusted values
        metrics["monthly_cashflow"] = year1_monthly_cashflow
        metrics["annual_cashflow"] = year1_annual_cashflow
        metrics["cash_on_cash_return"] = year1_coc
        metrics["noi"] = year1_noi
        metrics["total_roi_year1"] = year1_roi
        total_cash = year1_total_cash

    # Appreciation
    appreciation_pct = float(assumptions.property_appreciation_pct_annual)
    appreciation_year1 = compute_appreciation_year1(float(scenario.purchase_price), appreciation_pct)
    roi_with_appreciation = compute_total_roi_year1_with_appreciation(
        metrics["annual_cashflow"], year1_equity, appreciation_year1, total_cash,
    )

    dscr_warning = None
    if scenario.loan_type == "dscr" and metrics["dscr"] < 1.25:
        dscr_warning = f"DSCR of {metrics['dscr']:.2f} is below the typical lender threshold of 1.25x"

    # Occupancy/rate elasticity warning
    occupancy_rate_warning = None
    if occupancy >= 65 and float(assumptions.avg_nightly_rate) >= 300:
        occupancy_rate_warning = (
            f"Both occupancy ({occupancy:.0f}%) and nightly rate (${float(assumptions.avg_nightly_rate):.0f}) "
            "are high. Revenue projections may be optimistic — verify with local market data."
        )

    # Guest cost per night (cleaning fee amortized over stay length)
    stay_len = float(assumptions.avg_stay_length_nights)
    cleaning_per_night = float(assumptions.cleaning_fee_per_stay) / stay_len if stay_len > 0 else 0
    guest_cost_per_night = float(assumptions.avg_nightly_rate) + cleaning_per_night

    total_tax_pct = (
        float(assumptions.state_rooms_tax_pct)
        + float(assumptions.str_surcharge_pct)
        + float(assumptions.local_option_tax_pct)
    )
    tax_impact = None
    if total_tax_pct > 0:
        tax_impact = TaxImpactInfo(
            guest_facing_tax_pct=total_tax_pct,
            platform_remits=bool(assumptions.platform_remits_tax),
            effective_nightly_rate_with_tax=round(float(assumptions.avg_nightly_rate) * (1 + total_tax_pct / 100), 2),
        )

    # Depreciation
    depreciation = compute_depreciation(
        float(scenario.purchase_price),
        float(assumptions.land_value_pct),
        float(scenario.furniture_cost),
    )

    # Tax analysis
    annual_mortgage_interest = sum(m["interest"] for m in schedule[:12])
    tax_rate = float(assumptions.marginal_tax_rate_pct)
    tax_info = compute_tax_analysis(
        noi=metrics["noi"],
        annual_mortgage_interest=annual_mortgage_interest,
        total_depreciation_annual=depreciation["total_depreciation_annual"],
        marginal_tax_rate_pct=tax_rate,
        pre_tax_annual_cashflow=metrics["annual_cashflow"],
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
            origination_fee=round(origination_fee, 2),
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
                damage_reserve=round(expenses["damage_reserve"], 2),
                utilities_annual=round(expenses["utilities_annual"], 2),
                supplies_annual=round(expenses["supplies_annual"], 2),
                lawn_snow_annual=round(expenses["lawn_snow_annual"], 2),
                other_annual=round(expenses["other_annual"], 2),
                marketing_annual=round(expenses["marketing_annual"], 2),
                software_annual=round(expenses["software_annual"], 2),
                accounting_annual=round(expenses["accounting_annual"], 2),
                legal_annual=round(expenses["legal_annual"], 2),
                registration_annual=round(expenses["registration_annual"], 2),
                insurance_annual=float(assumptions.insurance_annual),
                gross_receipts_tax=round(expenses["gross_receipts_tax"], 2),
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
            dscr_warning=dscr_warning,
            occupancy_rate_warning=occupancy_rate_warning,
            guest_cost_per_night=round(guest_cost_per_night, 2),
            appreciation_year1=round(appreciation_year1, 2),
            total_roi_year1_with_appreciation=round(roi_with_appreciation, 2),
            taxable_income=round(tax_info["taxable_income"], 2),
            tax_liability=round(tax_info["tax_liability"], 2),
            after_tax_annual_cashflow=round(tax_info["after_tax_annual_cashflow"], 2),
            after_tax_monthly_cashflow=round(tax_info["after_tax_monthly_cashflow"], 2),
        ),
        "rental_delay_months": rental_delay,
        "tax_impact": tax_impact,
        "depreciation": DepreciationInfo(
            building_value=round(depreciation["building_value"], 2),
            building_depreciation_annual=round(depreciation["building_depreciation_annual"], 2),
            furniture_depreciation_annual=round(depreciation["furniture_depreciation_annual"], 2),
            total_depreciation_annual=round(depreciation["total_depreciation_annual"], 2),
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


@router.get("/api/properties/{property_id}/projections/{scenario_id}", response_model=ProjectionResponse)
def get_projections(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    prop, scenario, assumptions = _get_prop_scenario_assumptions(property_id, scenario_id, db)
    computed = _compute_for_scenario(prop, scenario, assumptions)

    # Steady-state values (full 12 months, no delay) — uses effective occupancy
    occupancy = _get_occupancy(assumptions)
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
    computed = _compute_for_scenario(prop, scenario, assumptions)

    use_seasonal = bool(assumptions.use_seasonal_occupancy)
    peak_months = assumptions.peak_months if use_seasonal else 6
    peak_occ = float(assumptions.peak_occupancy_pct) if use_seasonal else float(assumptions.occupancy_pct)
    off_peak_occ = float(assumptions.off_peak_occupancy_pct) if use_seasonal else float(assumptions.occupancy_pct)

    fixed_opex = _compute_fixed_opex(assumptions)

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
    fixed_opex = _compute_fixed_opex(assumptions)
    occupancy = _get_occupancy(assumptions)

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
