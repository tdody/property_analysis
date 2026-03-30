from pydantic import BaseModel, field_validator


class AssumptionsUpdate(BaseModel):
    avg_nightly_rate: float | None = None
    occupancy_pct: float | None = None
    cleaning_fee_per_stay: float | None = None
    avg_stay_length_nights: float | None = None
    platform_fee_pct: float | None = None
    cleaning_cost_per_turn: float | None = None
    property_mgmt_pct: float | None = None
    utilities_monthly: float | None = None
    insurance_annual: float | None = None
    maintenance_reserve_pct: float | None = None
    capex_reserve_pct: float | None = None
    supplies_monthly: float | None = None
    lawn_snow_monthly: float | None = None
    other_monthly_expense: float | None = None
    vacancy_reserve_pct: float | None = None
    rental_delay_months: int | None = None
    state_rooms_tax_pct: float | None = None
    str_surcharge_pct: float | None = None
    local_option_tax_pct: float | None = None
    local_str_registration_fee: float | None = None
    local_gross_receipts_tax_pct: float | None = None
    platform_remits_tax: bool | None = None

    @field_validator("occupancy_pct")
    @classmethod
    def occupancy_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("occupancy_pct must be between 0 and 100")
        return v

    @field_validator("avg_nightly_rate")
    @classmethod
    def nightly_rate_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("avg_nightly_rate must be non-negative")
        return v

    @field_validator("cleaning_fee_per_stay")
    @classmethod
    def cleaning_fee_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("cleaning_fee_per_stay must be non-negative")
        return v

    @field_validator("platform_fee_pct")
    @classmethod
    def platform_fee_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("platform_fee_pct must be between 0 and 100")
        return v

    @field_validator("rental_delay_months")
    @classmethod
    def rental_delay_in_range(cls, v: int | None) -> int | None:
        if v is not None and (v < 0 or v > 12):
            raise ValueError("rental_delay_months must be between 0 and 12")
        return v


class AssumptionsResponse(BaseModel):
    id: str
    property_id: str
    avg_nightly_rate: float
    occupancy_pct: float
    cleaning_fee_per_stay: float
    avg_stay_length_nights: float
    platform_fee_pct: float
    cleaning_cost_per_turn: float
    property_mgmt_pct: float
    utilities_monthly: float
    insurance_annual: float
    maintenance_reserve_pct: float
    capex_reserve_pct: float
    supplies_monthly: float
    lawn_snow_monthly: float
    other_monthly_expense: float
    vacancy_reserve_pct: float
    rental_delay_months: int
    state_rooms_tax_pct: float
    str_surcharge_pct: float
    local_option_tax_pct: float
    local_str_registration_fee: float
    local_gross_receipts_tax_pct: float
    platform_remits_tax: bool

    model_config = {"from_attributes": True}
