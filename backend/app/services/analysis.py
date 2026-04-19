"""High-level analysis service.

This module exposes the core per-scenario computation as a public API so that
routers and other services can import from a single, stable location.
"""

from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.scenario import MortgageScenario
from app.models.assumptions import STRAssumptions
from app.schemas.results import (
    MortgageResults,
    RevenueResults,
    ExpenseResults,
    ExpenseBreakdown,
    MetricsResults,
    TaxImpactInfo,
    DepreciationInfo,
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
    compute_gross_revenue,
    compute_net_revenue,
    compute_year1_revenue,
    compute_effective_occupancy,
    compute_monthly_revenue,
    compute_annual_from_monthly,
)
from app.services.computation.expenses import compute_operating_expenses
from app.services.computation.metrics import (
    compute_all_metrics,
    compute_delay_carrying_costs,
    compute_appreciation_year1,
    compute_total_roi_year1_with_appreciation,
    compute_tax_analysis,
    compute_break_even_vacancy,
    compute_noi,
    compute_cashflow,
    compute_cash_on_cash_return,
    compute_cap_rate,
    compute_dscr,
    compute_gross_yield,
    compute_total_roi_year1,
)
from app.services.computation.depreciation import compute_depreciation
from app.models.ltr_assumptions import LTRAssumptions
from app.services.computation.ltr_revenue import (
    compute_ltr_gross_revenue,
    compute_ltr_effective_revenue,
    compute_ltr_year1_revenue,
)
from app.services.computation.ltr_expenses import compute_ltr_operating_expenses


def _parse_profile(assumptions: STRAssumptions) -> list[dict] | None:
    import json

    raw = assumptions.monthly_revenue_profile
    if raw is None:
        return None
    if isinstance(raw, str):
        return json.loads(raw)
    return raw


def get_occupancy(assumptions: STRAssumptions) -> float:
    profile = _parse_profile(assumptions)
    if profile is not None:
        total_occupied = sum(
            d["occupancy_pct"]
            / 100
            * [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][d["month"] - 1]
            for d in profile
        )
        return total_occupied / 365 * 100
    if assumptions.use_seasonal_occupancy:
        return compute_effective_occupancy(
            assumptions.peak_months,
            float(assumptions.peak_occupancy_pct),
            float(assumptions.off_peak_occupancy_pct),
        )
    return float(assumptions.occupancy_pct)


def compute_fixed_opex(assumptions: STRAssumptions) -> float:
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


def compute_for_scenario(
    prop: Property, scenario: MortgageScenario, assumptions: STRAssumptions
) -> dict:
    # Mortgage
    loan_amount = compute_loan_amount(
        float(scenario.purchase_price), float(scenario.down_payment_amt)
    )
    io_years = scenario.io_period_years or 0
    # During IO period, monthly payment is interest-only
    if io_years > 0:
        monthly_pi = compute_io_monthly_payment(
            loan_amount, float(scenario.interest_rate)
        )
    else:
        monthly_pi = compute_monthly_pi(
            loan_amount, float(scenario.interest_rate), scenario.loan_term_years
        )
    monthly_pmi = compute_pmi(
        loan_amount,
        scenario.loan_type,
        float(scenario.down_payment_pct),
        pmi_override=float(scenario.pmi_monthly) if scenario.pmi_monthly else None,
    )
    total_monthly_housing = compute_total_monthly_housing(
        monthly_pi,
        monthly_pmi,
        float(prop.annual_taxes),
        float(assumptions.insurance_annual),
        float(prop.hoa_monthly),
        float(prop.nonhomestead_annual_taxes)
        if prop.nonhomestead_annual_taxes
        else None,
    )
    origination_fee = compute_origination_fee(
        loan_amount, float(scenario.origination_points_pct)
    )
    total_cash = compute_total_cash_invested(
        float(scenario.down_payment_amt),
        float(scenario.closing_cost_amt),
        float(scenario.renovation_cost),
        float(scenario.furniture_cost),
        float(scenario.other_upfront_costs),
        origination_fee=origination_fee,
    )

    # Revenue (uses monthly profile, seasonal, or flat occupancy)
    profile = _parse_profile(assumptions)
    if profile is not None:
        monthly_rev = compute_monthly_revenue(
            profile,
            float(assumptions.cleaning_fee_per_stay),
            float(assumptions.avg_stay_length_nights),
        )
        gross = compute_annual_from_monthly(monthly_rev)
    else:
        monthly_rev = None
        occupancy = get_occupancy(assumptions)
        gross = compute_gross_revenue(
            float(assumptions.avg_nightly_rate),
            occupancy,
            float(assumptions.cleaning_fee_per_stay),
            float(assumptions.avg_stay_length_nights),
        )
    occupancy = get_occupancy(assumptions)
    net = compute_net_revenue(
        gross["total_gross_revenue"], float(assumptions.platform_fee_pct)
    )

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
    fixed_opex = compute_fixed_opex(assumptions)

    # Year-1 equity
    schedule = compute_amortization_schedule(
        loan_amount,
        float(scenario.interest_rate),
        scenario.loan_term_years,
        io_period_years=io_years,
    )
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
    rental_delay = (
        int(assumptions.rental_delay_months) if assumptions.rental_delay_months else 0
    )
    if rental_delay > 0:
        year1_net = compute_year1_revenue(net["net_revenue"], rental_delay)
        # Variable expenses scale with revenue; fixed expenses stay the same
        year1_opex_variable = total_opex - fixed_opex
        year1_opex = fixed_opex + year1_opex_variable * (12 - rental_delay) / 12
        year1_noi = year1_net - year1_opex
        year1_fixed_costs = total_monthly_housing * 12
        year1_annual_cashflow = year1_noi - year1_fixed_costs
        year1_monthly_cashflow = year1_annual_cashflow / 12
        carrying_costs = compute_delay_carrying_costs(
            total_monthly_housing, rental_delay
        )
        year1_total_cash = total_cash + carrying_costs
        year1_coc = (
            (year1_annual_cashflow / year1_total_cash * 100)
            if year1_total_cash > 0
            else 0
        )
        year1_roi = (
            ((year1_annual_cashflow + year1_equity) / year1_total_cash * 100)
            if year1_total_cash > 0
            else 0
        )
        # Override metrics with Year-1 adjusted values
        metrics["monthly_cashflow"] = year1_monthly_cashflow
        metrics["annual_cashflow"] = year1_annual_cashflow
        metrics["cash_on_cash_return"] = year1_coc
        metrics["noi"] = year1_noi
        metrics["total_roi_year1"] = year1_roi
        total_cash = year1_total_cash

    # Appreciation
    appreciation_pct = float(assumptions.property_appreciation_pct_annual)
    appreciation_year1 = compute_appreciation_year1(
        float(scenario.purchase_price), appreciation_pct
    )
    roi_with_appreciation = compute_total_roi_year1_with_appreciation(
        metrics["annual_cashflow"],
        year1_equity,
        appreciation_year1,
        total_cash,
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
    cleaning_per_night = (
        float(assumptions.cleaning_fee_per_stay) / stay_len if stay_len > 0 else 0
    )
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
            effective_nightly_rate_with_tax=round(
                float(assumptions.avg_nightly_rate) * (1 + total_tax_pct / 100), 2
            ),
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
            building_depreciation_annual=round(
                depreciation["building_depreciation_annual"], 2
            ),
            furniture_depreciation_annual=round(
                depreciation["furniture_depreciation_annual"], 2
            ),
            total_depreciation_annual=round(
                depreciation["total_depreciation_annual"], 2
            ),
        ),
    }


def compute_and_cache_summary(
    prop: Property, scenario: MortgageScenario, assumptions: STRAssumptions, db: Session
) -> dict:
    """Compute full results and update cached metrics on the property."""
    result = compute_for_scenario(prop, scenario, assumptions)
    prop.cached_monthly_cashflow = result["metrics"].monthly_cashflow
    prop.cached_cash_on_cash_return = result["metrics"].cash_on_cash_return
    db.flush()
    return result


# ---------------------------------------------------------------------------
# LTR analysis
# ---------------------------------------------------------------------------


def compute_ltr_fixed_opex(ltr: LTRAssumptions) -> float:
    """Fixed operating expenses that don't scale with revenue."""
    return (
        float(ltr.utilities_monthly) * 12
        + float(ltr.lawn_snow_monthly) * 12
        + float(ltr.other_monthly_expense) * 12
        + float(ltr.insurance_annual)
        + float(ltr.landlord_repairs_annual)
        + float(ltr.accounting_annual)
        + float(ltr.legal_annual)
    )


def compute_for_scenario_ltr(
    prop: Property, scenario: MortgageScenario, ltr: LTRAssumptions
) -> dict:
    """Compute full analysis for an LTR scenario, parallel to compute_for_scenario()."""
    # Mortgage (identical to STR)
    loan_amount = compute_loan_amount(
        float(scenario.purchase_price), float(scenario.down_payment_amt)
    )
    io_years = scenario.io_period_years or 0
    if io_years > 0:
        monthly_pi = compute_io_monthly_payment(
            loan_amount, float(scenario.interest_rate)
        )
    else:
        monthly_pi = compute_monthly_pi(
            loan_amount, float(scenario.interest_rate), scenario.loan_term_years
        )
    monthly_pmi = compute_pmi(
        loan_amount,
        scenario.loan_type,
        float(scenario.down_payment_pct),
        pmi_override=float(scenario.pmi_monthly) if scenario.pmi_monthly else None,
    )
    total_monthly_housing = compute_total_monthly_housing(
        monthly_pi,
        monthly_pmi,
        float(prop.annual_taxes),
        float(ltr.insurance_annual),
        float(prop.hoa_monthly),
        float(prop.nonhomestead_annual_taxes)
        if prop.nonhomestead_annual_taxes
        else None,
    )
    origination_fee = compute_origination_fee(
        loan_amount, float(scenario.origination_points_pct)
    )
    total_cash = compute_total_cash_invested(
        float(scenario.down_payment_amt),
        float(scenario.closing_cost_amt),
        float(scenario.renovation_cost),
        float(scenario.furniture_cost),
        float(scenario.other_upfront_costs),
        origination_fee=origination_fee,
    )

    # Revenue
    gross_annual = compute_ltr_gross_revenue(
        float(ltr.monthly_rent),
        float(ltr.pet_rent_monthly),
        float(ltr.late_fee_monthly),
    )
    effective_annual = compute_ltr_effective_revenue(
        gross_annual, float(ltr.vacancy_rate_pct)
    )
    vacancy_loss = gross_annual - effective_annual

    # Expenses
    expenses = compute_ltr_operating_expenses(
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
    total_opex = expenses["total_annual_operating_exp"]
    fixed_opex = compute_ltr_fixed_opex(ltr)

    # Year-1 equity
    schedule = compute_amortization_schedule(
        loan_amount,
        float(scenario.interest_rate),
        scenario.loan_term_years,
        io_period_years=io_years,
    )
    year1_equity = sum(m["principal"] for m in schedule[:12]) if schedule else 0

    # Core metrics
    noi = compute_noi(effective_annual, total_opex)
    cashflow = compute_cashflow(noi, total_monthly_housing)
    annual_debt_service = monthly_pi * 12

    break_even_vac = compute_break_even_vacancy(
        gross_annual_revenue=gross_annual,
        fixed_opex_annual=fixed_opex,
        annual_housing_cost=total_monthly_housing * 12,
    )

    metrics = {
        "noi": noi,
        "monthly_cashflow": cashflow["monthly_cashflow"],
        "annual_cashflow": cashflow["annual_cashflow"],
        "cash_on_cash_return": compute_cash_on_cash_return(
            cashflow["annual_cashflow"], total_cash
        ),
        "cap_rate": compute_cap_rate(noi, float(scenario.purchase_price)),
        "dscr": compute_dscr(noi, annual_debt_service),
        "gross_yield": compute_gross_yield(
            gross_annual, float(scenario.purchase_price)
        ),
        "break_even_vacancy_pct": break_even_vac,
        "total_roi_year1": compute_total_roi_year1(
            cashflow["annual_cashflow"], year1_equity, total_cash
        ),
    }

    # Lease-up adjustments for Year-1
    lease_up = int(ltr.lease_up_period_months) if ltr.lease_up_period_months else 0
    if lease_up > 0:
        year1_rev = compute_ltr_year1_revenue(
            float(ltr.monthly_rent),
            float(ltr.pet_rent_monthly),
            float(ltr.late_fee_monthly),
            float(ltr.vacancy_rate_pct),
            lease_up,
        )
        year1_effective = year1_rev["year1_effective"]
        year1_opex_variable = total_opex - fixed_opex
        year1_opex = fixed_opex + year1_opex_variable * (12 - lease_up) / 12
        year1_noi = year1_effective - year1_opex
        year1_fixed_costs = total_monthly_housing * 12
        year1_annual_cf = year1_noi - year1_fixed_costs
        year1_monthly_cf = year1_annual_cf / 12
        carrying_costs = compute_delay_carrying_costs(total_monthly_housing, lease_up)
        year1_total_cash = total_cash + carrying_costs
        year1_coc = (
            (year1_annual_cf / year1_total_cash * 100) if year1_total_cash > 0 else 0
        )
        year1_roi = (
            ((year1_annual_cf + year1_equity) / year1_total_cash * 100)
            if year1_total_cash > 0
            else 0
        )
        metrics["monthly_cashflow"] = year1_monthly_cf
        metrics["annual_cashflow"] = year1_annual_cf
        metrics["cash_on_cash_return"] = year1_coc
        metrics["noi"] = year1_noi
        metrics["total_roi_year1"] = year1_roi
        total_cash = year1_total_cash

    # Appreciation
    appreciation_pct = float(ltr.property_appreciation_pct_annual)
    appreciation_year1 = compute_appreciation_year1(
        float(scenario.purchase_price), appreciation_pct
    )
    roi_with_appreciation = compute_total_roi_year1_with_appreciation(
        metrics["annual_cashflow"],
        year1_equity,
        appreciation_year1,
        total_cash,
    )

    dscr_warning = None
    if scenario.loan_type == "dscr" and metrics["dscr"] < 1.25:
        dscr_warning = f"DSCR of {metrics['dscr']:.2f} is below the typical lender threshold of 1.25x"

    # Depreciation
    depreciation = compute_depreciation(
        float(scenario.purchase_price),
        float(ltr.land_value_pct),
        float(scenario.furniture_cost),
    )

    # Tax analysis
    annual_mortgage_interest = sum(m["interest"] for m in schedule[:12])
    tax_rate = float(ltr.marginal_tax_rate_pct)
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
        "rental_type": "ltr",
        "mortgage": MortgageResults(
            loan_amount=round(loan_amount, 2),
            monthly_pi=round(monthly_pi, 2),
            monthly_pmi=round(monthly_pmi, 2),
            total_monthly_housing=round(total_monthly_housing, 2),
            total_cash_invested=round(total_cash, 2),
            origination_fee=round(origination_fee, 2),
        ),
        "revenue": {
            "monthly_rent": float(ltr.monthly_rent),
            "pet_rent_monthly": float(ltr.pet_rent_monthly),
            "late_fee_monthly": float(ltr.late_fee_monthly),
            "gross_annual": round(gross_annual, 2),
            "vacancy_loss": round(vacancy_loss, 2),
            "effective_annual": round(effective_annual, 2),
        },
        "expenses": {
            "total_annual_operating": round(total_opex, 2),
            "breakdown": {
                "property_mgmt_cost": round(expenses["property_mgmt_cost"], 2),
                "maintenance_reserve": round(expenses["maintenance_reserve"], 2),
                "capex_reserve": round(expenses["capex_reserve"], 2),
                "turnover_amortized": round(expenses["turnover_amortized"], 2),
                "insurance_annual": round(expenses["insurance_annual"], 2),
                "landlord_repairs_annual": round(
                    expenses["landlord_repairs_annual"], 2
                ),
                "utilities_annual": round(expenses["utilities_annual"], 2),
                "lawn_snow_annual": round(expenses["lawn_snow_annual"], 2),
                "other_annual": round(expenses["other_annual"], 2),
                "accounting_annual": round(expenses["accounting_annual"], 2),
                "legal_annual": round(expenses["legal_annual"], 2),
            },
        },
        "metrics": {
            "monthly_cashflow": round(metrics["monthly_cashflow"], 2),
            "annual_cashflow": round(metrics["annual_cashflow"], 2),
            "cash_on_cash_return": round(metrics["cash_on_cash_return"], 2),
            "cap_rate": round(metrics["cap_rate"], 2),
            "noi": round(metrics["noi"], 2),
            "break_even_vacancy_pct": round(metrics["break_even_vacancy_pct"], 2),
            "dscr": round(metrics["dscr"], 2),
            "gross_yield": round(metrics["gross_yield"], 2),
            "total_roi_year1": round(metrics["total_roi_year1"], 2),
            "dscr_warning": dscr_warning,
            "appreciation_year1": round(appreciation_year1, 2),
            "total_roi_year1_with_appreciation": round(roi_with_appreciation, 2),
            "taxable_income": round(tax_info["taxable_income"], 2),
            "tax_liability": round(tax_info["tax_liability"], 2),
            "after_tax_annual_cashflow": round(
                tax_info["after_tax_annual_cashflow"], 2
            ),
            "after_tax_monthly_cashflow": round(
                tax_info["after_tax_monthly_cashflow"], 2
            ),
        },
        "lease_up_period_months": lease_up,
        "depreciation": DepreciationInfo(
            building_value=round(depreciation["building_value"], 2),
            building_depreciation_annual=round(
                depreciation["building_depreciation_annual"], 2
            ),
            furniture_depreciation_annual=round(
                depreciation["furniture_depreciation_annual"], 2
            ),
            total_depreciation_annual=round(
                depreciation["total_depreciation_annual"], 2
            ),
        ),
    }


def compute_and_cache_ltr_summary(
    prop: Property, scenario: MortgageScenario, ltr: LTRAssumptions, db: Session
) -> dict:
    """Compute full LTR results and update cached metrics on the property."""
    result = compute_for_scenario_ltr(prop, scenario, ltr)
    prop.cached_monthly_cashflow = result["metrics"]["monthly_cashflow"]
    prop.cached_cash_on_cash_return = result["metrics"]["cash_on_cash_return"]
    db.flush()
    return result
