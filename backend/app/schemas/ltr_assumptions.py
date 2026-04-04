from pydantic import BaseModel, field_validator


class LTRAssumptionsUpdate(BaseModel):
    monthly_rent: float | None = None
    lease_duration_months: int | None = None
    pet_rent_monthly: float | None = None
    late_fee_monthly: float | None = None
    vacancy_rate_pct: float | None = None
    lease_up_period_months: int | None = None
    property_mgmt_pct: float | None = None
    insurance_annual: float | None = None
    maintenance_reserve_pct: float | None = None
    capex_reserve_pct: float | None = None
    landlord_repairs_annual: float | None = None
    tenant_turnover_cost: float | None = None
    utilities_monthly: float | None = None
    lawn_snow_monthly: float | None = None
    other_monthly_expense: float | None = None
    accounting_annual: float | None = None
    legal_annual: float | None = None
    land_value_pct: float | None = None
    property_appreciation_pct_annual: float | None = None
    revenue_growth_pct: float | None = None
    expense_growth_pct: float | None = None
    marginal_tax_rate_pct: float | None = None

    @field_validator("monthly_rent")
    @classmethod
    def monthly_rent_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("monthly_rent must be non-negative")
        return v

    @field_validator("lease_duration_months")
    @classmethod
    def lease_duration_in_range(cls, v: int | None) -> int | None:
        if v is not None and (v < 1 or v > 36):
            raise ValueError("lease_duration_months must be between 1 and 36")
        return v

    @field_validator("pet_rent_monthly")
    @classmethod
    def pet_rent_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("pet_rent_monthly must be non-negative")
        return v

    @field_validator("late_fee_monthly")
    @classmethod
    def late_fee_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("late_fee_monthly must be non-negative")
        return v

    @field_validator("vacancy_rate_pct")
    @classmethod
    def vacancy_rate_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 50):
            raise ValueError("vacancy_rate_pct must be between 0 and 50")
        return v

    @field_validator("lease_up_period_months")
    @classmethod
    def lease_up_in_range(cls, v: int | None) -> int | None:
        if v is not None and (v < 0 or v > 12):
            raise ValueError("lease_up_period_months must be between 0 and 12")
        return v

    @field_validator("property_mgmt_pct")
    @classmethod
    def property_mgmt_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("property_mgmt_pct must be between 0 and 100")
        return v

    @field_validator("maintenance_reserve_pct")
    @classmethod
    def maintenance_reserve_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("maintenance_reserve_pct must be between 0 and 100")
        return v

    @field_validator("capex_reserve_pct")
    @classmethod
    def capex_reserve_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("capex_reserve_pct must be between 0 and 100")
        return v

    @field_validator("land_value_pct")
    @classmethod
    def land_value_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("land_value_pct must be between 0 and 100")
        return v

    @field_validator("revenue_growth_pct")
    @classmethod
    def revenue_growth_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 50):
            raise ValueError("revenue_growth_pct must be between 0 and 50")
        return v

    @field_validator("expense_growth_pct")
    @classmethod
    def expense_growth_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 50):
            raise ValueError("expense_growth_pct must be between 0 and 50")
        return v

    @field_validator("marginal_tax_rate_pct")
    @classmethod
    def marginal_tax_rate_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 55):
            raise ValueError("marginal_tax_rate_pct must be between 0 and 55")
        return v


class LTRAssumptionsResponse(BaseModel):
    id: str
    property_id: str
    monthly_rent: float
    lease_duration_months: int
    pet_rent_monthly: float
    late_fee_monthly: float
    vacancy_rate_pct: float
    lease_up_period_months: int
    property_mgmt_pct: float
    insurance_annual: float
    maintenance_reserve_pct: float
    capex_reserve_pct: float
    landlord_repairs_annual: float
    tenant_turnover_cost: float
    utilities_monthly: float
    lawn_snow_monthly: float
    other_monthly_expense: float
    accounting_annual: float
    legal_annual: float
    land_value_pct: float
    property_appreciation_pct_annual: float
    revenue_growth_pct: float
    expense_growth_pct: float
    marginal_tax_rate_pct: float

    model_config = {"from_attributes": True}
