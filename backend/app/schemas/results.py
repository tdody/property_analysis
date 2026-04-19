from pydantic import BaseModel


class MortgageResults(BaseModel):
    loan_amount: float
    monthly_pi: float
    monthly_pmi: float
    total_monthly_housing: float
    total_cash_invested: float
    origination_fee: float = 0


class RevenueResults(BaseModel):
    gross_annual: float
    net_annual: float
    annual_turnovers: float


class ExpenseBreakdown(BaseModel):
    annual_cleaning_cost: float
    property_mgmt_cost: float
    maintenance_reserve: float
    capex_reserve: float
    damage_reserve: float
    utilities_annual: float
    supplies_annual: float
    lawn_snow_annual: float
    other_annual: float
    marketing_annual: float
    software_annual: float
    accounting_annual: float
    legal_annual: float
    registration_annual: float
    insurance_annual: float
    gross_receipts_tax: float


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
    dscr_warning: str | None = None
    occupancy_rate_warning: str | None = None
    guest_cost_per_night: float = 0
    appreciation_year1: float = 0
    total_roi_year1_with_appreciation: float = 0
    taxable_income: float = 0
    tax_liability: float = 0
    after_tax_annual_cashflow: float = 0
    after_tax_monthly_cashflow: float = 0


class DepreciationInfo(BaseModel):
    building_value: float
    building_depreciation_annual: float
    furniture_depreciation_annual: float
    total_depreciation_annual: float


class TaxImpactInfo(BaseModel):
    guest_facing_tax_pct: float
    platform_remits: bool
    effective_nightly_rate_with_tax: float


class ComputedResultsResponse(BaseModel):
    property_id: str
    scenario_id: str
    scenario_name: str
    mortgage: MortgageResults
    revenue: RevenueResults
    expenses: ExpenseResults
    metrics: MetricsResults
    rental_delay_months: int = 0
    tax_impact: TaxImpactInfo | None = None
    depreciation: DepreciationInfo | None = None


class ProjectionYear(BaseModel):
    year: int
    gross_revenue: float
    net_revenue: float
    total_opex: float
    noi: float
    annual_housing_cost: float
    annual_cashflow: float
    cumulative_cashflow: float
    property_value: float
    loan_balance: float
    equity: float
    cash_on_cash_return: float
    after_tax_cashflow: float = 0


class ExitAnalysis(BaseModel):
    sale_price: float
    selling_costs: float
    remaining_mortgage: float
    total_depreciation: float
    depreciation_recapture_tax: float
    capital_gain: float
    capital_gains_tax: float
    net_exit_proceeds: float


class IRRResult(BaseModel):
    irr_with_exit: float | None = None
    equity_multiple_with_exit: float = 0
    total_profit: float = 0
    hold_period_years: int = 5
    exit_analysis: ExitAnalysis
    cashflow_series: list[float] = []


class HoldPeriodSweepEntry(BaseModel):
    hold_period: int
    irr: float | None = None


class ProjectionResponse(BaseModel):
    property_id: str
    scenario_id: str
    years: list[ProjectionYear]
    irr: float | None = None
    equity_multiple: float = 0
    irr_with_exit: IRRResult | None = None
    hold_period_sweep: list[HoldPeriodSweepEntry] = []


class MonthlyDetail(BaseModel):
    month: int
    is_peak: bool
    gross_revenue: float
    total_expenses: float
    noi: float
    cashflow: float


class MonthlyBreakdownResponse(BaseModel):
    property_id: str
    scenario_id: str
    use_seasonal: bool
    months: list[MonthlyDetail]


class OccupancySweepEntry(BaseModel):
    occupancy_pct: int
    monthly_cashflow: float


class RateSweepEntry(BaseModel):
    nightly_rate: float
    monthly_cashflow: float


class SensitivityResponse(BaseModel):
    occupancy_sweep: list[OccupancySweepEntry]
    rate_sweep: list[RateSweepEntry]


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


class TornadoSweepPoint(BaseModel):
    input_value: float
    output_value: float


class TornadoBar(BaseModel):
    variable_name: str
    variable_label: str
    baseline_input: float
    low_input: float
    high_input: float
    low_output: float
    high_output: float
    spread: float
    sweep: list[TornadoSweepPoint]


class TornadoResponse(BaseModel):
    metric_key: str
    metric_label: str
    baseline_value: float
    bars: list[TornadoBar]
