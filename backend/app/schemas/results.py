from pydantic import BaseModel


class MortgageResults(BaseModel):
    loan_amount: float
    monthly_pi: float
    monthly_pmi: float
    total_monthly_housing: float
    total_cash_invested: float


class RevenueResults(BaseModel):
    gross_annual: float
    net_annual: float
    annual_turnovers: float


class ExpenseBreakdown(BaseModel):
    annual_cleaning_cost: float
    property_mgmt_cost: float
    maintenance_reserve: float
    capex_reserve: float
    utilities_annual: float
    supplies_annual: float
    lawn_snow_annual: float
    other_annual: float
    registration_annual: float
    insurance_annual: float


class ExpenseResults(BaseModel):
    total_annual_operating: float
    breakdown: ExpenseBreakdown


class MetricsResults(BaseModel):
    monthly_cashflow: float
    annual_cashflow: float
    cash_on_cash_return: float
    cap_rate: float
    noi: float
    break_even_occupancy: float
    dscr: float
    gross_yield: float
    total_roi_year1: float


class ComputedResultsResponse(BaseModel):
    property_id: str
    scenario_id: str
    scenario_name: str
    mortgage: MortgageResults
    revenue: RevenueResults
    expenses: ExpenseResults
    metrics: MetricsResults


class SensitivityResponse(BaseModel):
    occupancy_sweep: list[dict]
    rate_sweep: list[dict]


class AmortizationEntry(BaseModel):
    month: int
    principal: float
    interest: float
    remaining_balance: float


class ComparisonProperty(BaseModel):
    property_id: str
    property_name: str
    address: str
    city: str
    listing_price: float
    beds: int
    baths: float
    sqft: int
    scenario_name: str
    total_cash_invested: float
    monthly_cashflow: float
    annual_cashflow: float
    cash_on_cash_return: float
    cap_rate: float
    noi: float
    break_even_occupancy: float
    dscr: float
    gross_yield: float
