export interface PropertySummary {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  listing_price: number;
  beds: number;
  baths: number;
  sqft: number;
  property_type: string;
  is_archived: boolean;
  image_url: string | null;
  monthly_cashflow: number | null;
  cash_on_cash_return: number | null;
  in_portfolio: boolean;
  active_rental_type: 'str' | 'ltr';
}

export interface Property {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  source_url: string | null;
  image_url: string | null;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  listing_price: number;
  estimated_value: number | null;
  beds: number;
  baths: number;
  sqft: number;
  lot_sqft: number | null;
  year_built: number | null;
  property_type: string;
  hoa_monthly: number;
  annual_taxes: number;
  tax_rate: number | null;
  is_homestead_tax: boolean;
  nonhomestead_annual_taxes: number | null;
  notes: string;
  is_archived: boolean;
  active_rental_type: 'str' | 'ltr';
  scraped_snapshot: Record<string, string | number | null> | null;
}

export interface MortgageScenario {
  id: string;
  property_id: string;
  name: string;
  loan_type: string;
  purchase_price: number;
  down_payment_pct: number;
  down_payment_amt: number;
  interest_rate: number;
  loan_term_years: number;
  closing_cost_pct: number;
  closing_cost_amt: number;
  renovation_cost: number;
  furniture_cost: number;
  other_upfront_costs: number;
  pmi_monthly: number;
  origination_points_pct: number;
  io_period_years: number;
  is_active: boolean;
}

export interface STRAssumptions {
  id: string;
  property_id: string;
  avg_nightly_rate: number;
  occupancy_pct: number;
  cleaning_fee_per_stay: number;
  avg_stay_length_nights: number;
  platform_fee_pct: number;
  cleaning_cost_per_turn: number;
  property_mgmt_pct: number;
  utilities_monthly: number;
  insurance_annual: number;
  maintenance_reserve_pct: number;
  capex_reserve_pct: number;
  damage_reserve_pct: number;
  supplies_monthly: number;
  lawn_snow_monthly: number;
  other_monthly_expense: number;
  vacancy_reserve_pct: number;
  marketing_monthly: number;
  software_monthly: number;
  accounting_annual: number;
  legal_annual: number;
  rental_delay_months: number;
  state_rooms_tax_pct: number;
  str_surcharge_pct: number;
  local_option_tax_pct: number;
  local_str_registration_fee: number;
  local_gross_receipts_tax_pct: number;
  platform_remits_tax: boolean;
  land_value_pct: number;
  property_appreciation_pct_annual: number;
  revenue_growth_pct: number;
  expense_growth_pct: number;
  marginal_tax_rate_pct: number;
  use_seasonal_occupancy: boolean;
  peak_months: number;
  peak_occupancy_pct: number;
  off_peak_occupancy_pct: number;
}

export interface ComputedResults {
  property_id: string;
  scenario_id: string;
  scenario_name: string;
  mortgage: {
    loan_amount: number;
    monthly_pi: number;
    monthly_pmi: number;
    total_monthly_housing: number;
    total_cash_invested: number;
    origination_fee: number;
  };
  revenue: {
    gross_annual: number;
    net_annual: number;
    annual_turnovers: number;
  };
  expenses: {
    total_annual_operating: number;
    breakdown: Record<string, number>;
  };
  metrics: {
    monthly_cashflow: number;
    annual_cashflow: number;
    cash_on_cash_return: number;
    cap_rate: number;
    noi: number;
    break_even_occupancy: number;
    dscr: number;
    gross_yield: number;
    total_roi_year1: number;
    dscr_warning: string | null;
    occupancy_rate_warning: string | null;
    guest_cost_per_night: number;
    appreciation_year1: number;
    total_roi_year1_with_appreciation: number;
    taxable_income: number;
    tax_liability: number;
    after_tax_annual_cashflow: number;
    after_tax_monthly_cashflow: number;
  };
  rental_delay_months: number;
  tax_impact: {
    guest_facing_tax_pct: number;
    platform_remits: boolean;
    effective_nightly_rate_with_tax: number;
  } | null;
  depreciation: {
    building_value: number;
    building_depreciation_annual: number;
    furniture_depreciation_annual: number;
    total_depreciation_annual: number;
  } | null;
}

export interface MonthlyDetail {
  month: number;
  is_peak: boolean;
  gross_revenue: number;
  total_expenses: number;
  noi: number;
  cashflow: number;
}

export interface ProjectionYear {
  year: number;
  gross_revenue: number;
  net_revenue: number;
  total_opex: number;
  noi: number;
  annual_housing_cost: number;
  annual_cashflow: number;
  cumulative_cashflow: number;
  property_value: number;
  loan_balance: number;
  equity: number;
  cash_on_cash_return: number;
  after_tax_cashflow: number;
}

export interface ProjectionSummary {
  property_id: string;
  scenario_id: string;
  years: ProjectionYear[];
  irr: number | null;
  equity_multiple: number;
}

export interface SensitivityData {
  occupancy_sweep: Array<{ occupancy_pct: number; monthly_cashflow: number }>;
  rate_sweep: Array<{ nightly_rate: number; monthly_cashflow: number }>;
}

export interface AmortizationEntry {
  month: number;
  principal: number;
  interest: number;
  remaining_balance: number;
}

export interface ComparisonProperty {
  property_id: string;
  property_name: string;
  address: string;
  city: string;
  listing_price: number;
  beds: number;
  baths: number;
  sqft: number;
  scenario_name: string;
  total_cash_invested: number;
  monthly_cashflow: number;
  annual_cashflow: number;
  cash_on_cash_return: number;
  cap_rate: number;
  noi: number;
  break_even_occupancy: number;
  dscr: number;
  gross_yield: number;
}

export interface LTRAssumptions {
  id: string;
  property_id: string;
  monthly_rent: number;
  lease_duration_months: number;
  pet_rent_monthly: number;
  late_fee_monthly: number;
  vacancy_rate_pct: number;
  lease_up_period_months: number;
  property_mgmt_pct: number;
  insurance_annual: number;
  maintenance_reserve_pct: number;
  capex_reserve_pct: number;
  landlord_repairs_annual: number;
  tenant_turnover_cost: number;
  utilities_monthly: number;
  lawn_snow_monthly: number;
  other_monthly_expense: number;
  accounting_annual: number;
  legal_annual: number;
  land_value_pct: number;
  property_appreciation_pct_annual: number;
  revenue_growth_pct: number;
  expense_growth_pct: number;
  marginal_tax_rate_pct: number;
}

export interface LTRComputedResults {
  property_id: string;
  scenario_id: string;
  scenario_name: string;
  rental_type: 'ltr';
  mortgage: {
    loan_amount: number;
    monthly_pi: number;
    monthly_pmi: number;
    total_monthly_housing: number;
    total_cash_invested: number;
    origination_fee: number;
  };
  revenue: {
    monthly_rent: number;
    pet_rent_monthly: number;
    late_fee_monthly: number;
    gross_annual: number;
    vacancy_loss: number;
    effective_annual: number;
  };
  expenses: {
    total_annual_operating: number;
    breakdown: Record<string, number>;
  };
  metrics: {
    monthly_cashflow: number;
    annual_cashflow: number;
    cash_on_cash_return: number;
    cap_rate: number;
    noi: number;
    break_even_vacancy_pct: number;
    dscr: number;
    gross_yield: number;
    total_roi_year1: number;
    dscr_warning: string | null;
    appreciation_year1: number;
    total_roi_year1_with_appreciation: number;
    taxable_income: number;
    tax_liability: number;
    after_tax_annual_cashflow: number;
    after_tax_monthly_cashflow: number;
  };
  lease_up_period_months: number;
  depreciation: {
    building_value: number;
    building_depreciation_annual: number;
    furniture_depreciation_annual: number;
    total_depreciation_annual: number;
  } | null;
}

export interface LTRSensitivityData {
  vacancy_sweep: Array<{ vacancy_pct: number; monthly_cashflow: number }>;
  rent_sweep: Array<{ monthly_rent: number; monthly_cashflow: number }>;
}
