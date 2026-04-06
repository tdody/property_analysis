"""PDF generation orchestrator for lender packets."""

from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.scenario import MortgageScenario
from app.models.assumptions import STRAssumptions
from app.models.ltr_assumptions import LTRAssumptions
from app.models.settings import UserSettings
from app.services.analysis import (
    compute_for_scenario,
    compute_for_scenario_ltr,
    get_occupancy,
    compute_fixed_opex,
    compute_ltr_fixed_opex,
)
from app.services.computation.mortgage import (
    compute_loan_amount,
    compute_monthly_pi,
    compute_pmi,
    compute_total_monthly_housing,
    compute_amortization_schedule,
)
from app.services.computation.revenue import compute_gross_revenue, compute_net_revenue
from app.services.computation.expenses import compute_operating_expenses
from app.services.computation.projections import compute_five_year_projection
from app.services.computation.sensitivity import compute_sensitivity, compute_ltr_sensitivity
from app.services.computation.ltr_revenue import compute_ltr_gross_revenue, compute_ltr_effective_revenue
from app.services.pdf.charts import render_projection_chart, render_sensitivity_chart, render_ltr_sensitivity_chart
from app.services.pdf.builder import LenderPacketPDF


def generate_lender_packet(property_id: str, db: Session) -> bytes:
    """Generate a complete lender packet PDF for a property."""
    # Load property
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise ValueError(f"Property {property_id} not found")

    # Load active scenario
    scenario = db.query(MortgageScenario).filter(
        MortgageScenario.property_id == property_id,
        MortgageScenario.is_active == True,
    ).first()
    if not scenario:
        raise ValueError("No active scenario found")

    is_ltr = prop.active_rental_type == "ltr"

    # Load settings for branding
    settings = db.query(UserSettings).first()
    company_name = settings.company_name if settings else None
    logo_filename = settings.logo_filename if settings else None

    # Compute results based on rental type
    if is_ltr:
        ltr = db.query(LTRAssumptions).filter(LTRAssumptions.property_id == property_id).first()
        if not ltr:
            ltr = LTRAssumptions(property_id=property_id)
            db.add(ltr)
            db.flush()
        computed = compute_for_scenario_ltr(prop, scenario, ltr)
    else:
        assumptions = db.query(STRAssumptions).filter(STRAssumptions.property_id == property_id).first()
        if not assumptions:
            raise ValueError("STR assumptions not found")
        computed = compute_for_scenario(prop, scenario, assumptions)

    # Amortization schedule
    loan_amount = compute_loan_amount(float(scenario.purchase_price), float(scenario.down_payment_amt))
    io_years = scenario.io_period_years or 0
    amortization = compute_amortization_schedule(
        loan_amount, float(scenario.interest_rate), scenario.loan_term_years,
        io_period_years=io_years,
    )

    # Projections
    if is_ltr:
        gross_annual = compute_ltr_gross_revenue(
            float(ltr.monthly_rent), float(ltr.pet_rent_monthly), float(ltr.late_fee_monthly),
        )
        effective_annual = compute_ltr_effective_revenue(gross_annual, float(ltr.vacancy_rate_pct))
        monthly_pi = compute_monthly_pi(loan_amount, float(scenario.interest_rate), scenario.loan_term_years)
        from app.services.computation.ltr_expenses import compute_ltr_operating_expenses
        ltr_expenses = compute_ltr_operating_expenses(
            effective_annual_revenue=effective_annual,
            gross_annual_revenue=gross_annual,
            property_mgmt_pct=float(ltr.property_mgmt_pct),
            maintenance_reserve_pct=float(ltr.maintenance_reserve_pct),
            capex_reserve_pct=float(ltr.capex_reserve_pct),
            tenant_turnover_cost=float(ltr.tenant_turnover_cost),
            lease_duration_months=int(ltr.lease_duration_months),
            insurance_annual=float(ltr.insurance_annual),
            landlord_repairs_annual=float(ltr.landlord_repairs_annual),
            utilities_monthly=float(ltr.utilities_monthly),
            lawn_snow_monthly=float(ltr.lawn_snow_monthly),
            other_monthly_expense=float(ltr.other_monthly_expense),
            accounting_annual=float(ltr.accounting_annual),
            legal_annual=float(ltr.legal_annual),
        )
        steady_opex = ltr_expenses["total_annual_operating_exp"]
        projections = compute_five_year_projection(
            year1_gross_revenue=computed["revenue"]["gross_annual"],
            year1_net_revenue=computed["revenue"]["effective_annual"],
            year1_opex=computed["expenses"]["total_annual_operating"],
            year1_cashflow=computed["metrics"]["annual_cashflow"],
            steady_state_gross_revenue=gross_annual,
            steady_state_net_revenue=effective_annual,
            steady_state_opex=steady_opex,
            revenue_growth_pct=float(ltr.revenue_growth_pct),
            expense_growth_pct=float(ltr.expense_growth_pct),
            total_monthly_housing=computed["mortgage"].total_monthly_housing,
            monthly_pi=monthly_pi,
            purchase_price=float(scenario.purchase_price),
            appreciation_pct=float(ltr.property_appreciation_pct_annual),
            loan_amount=loan_amount,
            interest_rate=float(scenario.interest_rate),
            loan_term_years=scenario.loan_term_years,
            total_cash_invested=computed["mortgage"].total_cash_invested,
            platform_fee_pct=0,
            marginal_tax_rate_pct=float(ltr.marginal_tax_rate_pct),
            total_depreciation_annual=computed["depreciation"].total_depreciation_annual,
            io_period_years=io_years,
        )
    else:
        occupancy = get_occupancy(assumptions)
        gross = compute_gross_revenue(
            float(assumptions.avg_nightly_rate), occupancy,
            float(assumptions.cleaning_fee_per_stay), float(assumptions.avg_stay_length_nights),
        )
        net = compute_net_revenue(gross["total_gross_revenue"], float(assumptions.platform_fee_pct))
        expenses_data = compute_operating_expenses(
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
        monthly_pi = compute_monthly_pi(loan_amount, float(scenario.interest_rate), scenario.loan_term_years)
        projections = compute_five_year_projection(
            year1_gross_revenue=computed["revenue"].gross_annual,
            year1_net_revenue=computed["revenue"].net_annual,
            year1_opex=computed["expenses"].total_annual_operating,
            year1_cashflow=computed["metrics"].annual_cashflow,
            steady_state_gross_revenue=gross["total_gross_revenue"],
            steady_state_net_revenue=net["net_revenue"],
            steady_state_opex=expenses_data["total_annual_operating_exp"],
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
            io_period_years=io_years,
        )

    # Sensitivity analysis
    if is_ltr:
        fixed_opex = compute_ltr_fixed_opex(ltr)
        sensitivity = compute_ltr_sensitivity(
            monthly_rent=float(ltr.monthly_rent),
            pet_rent_monthly=float(ltr.pet_rent_monthly),
            late_fee_monthly=float(ltr.late_fee_monthly),
            base_vacancy_rate_pct=float(ltr.vacancy_rate_pct),
            property_mgmt_pct=float(ltr.property_mgmt_pct),
            maintenance_reserve_pct=float(ltr.maintenance_reserve_pct),
            capex_reserve_pct=float(ltr.capex_reserve_pct),
            fixed_opex_annual=fixed_opex,
            tenant_turnover_cost=float(ltr.tenant_turnover_cost),
            lease_duration_months=int(ltr.lease_duration_months),
            total_monthly_housing=computed["mortgage"].total_monthly_housing,
        )
    else:
        fixed_opex = compute_fixed_opex(assumptions)
        monthly_pmi = compute_pmi(loan_amount, scenario.loan_type, float(scenario.down_payment_pct), None)
        total_monthly_housing = compute_total_monthly_housing(
            monthly_pi, monthly_pmi, float(prop.annual_taxes),
            float(assumptions.insurance_annual), float(prop.hoa_monthly),
            float(prop.nonhomestead_annual_taxes) if prop.nonhomestead_annual_taxes else None,
        )
        sensitivity = compute_sensitivity(
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

    # Generate charts
    projection_chart = render_projection_chart(projections)
    if is_ltr:
        sensitivity_chart = render_ltr_sensitivity_chart(
            sensitivity["vacancy_sweep"], sensitivity["rent_sweep"],
        )
    else:
        sensitivity_chart = render_sensitivity_chart(
            sensitivity["occupancy_sweep"], sensitivity["rate_sweep"],
        )

    # Build PDF
    pdf = LenderPacketPDF(company_name=company_name, logo_filename=logo_filename)
    pdf.add_page()
    pdf.add_cover_header(prop, scenario)
    pdf.add_property_summary(prop, scenario)
    pdf.add_financing_terms(computed["mortgage"], scenario)

    if is_ltr:
        pdf.add_revenue_assumptions_ltr(computed["revenue"], ltr)
        pdf.add_expense_breakdown_ltr(computed["expenses"])
        pdf.add_key_metrics(computed["metrics"], is_ltr=True)
    else:
        pdf.add_revenue_assumptions_str(computed["revenue"], assumptions)
        pdf.add_expense_breakdown_str(computed["expenses"])
        pdf.add_key_metrics(computed["metrics"], is_ltr=False)

    pdf.add_page()
    pdf.add_amortization_summary(amortization)
    pdf.add_projection_chart(projection_chart)

    pdf.add_page()
    pdf.add_sensitivity_chart(sensitivity_chart)
    pdf.add_disclaimer()

    return pdf.generate()
