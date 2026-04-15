from pydantic import BaseModel, field_validator


_ALLOWED_LOAN_TYPES = {"conventional", "fha", "va", "dscr", "portfolio", "heloc"}


class ScenarioCreate(BaseModel):
    name: str = "Default Scenario"
    loan_type: str = "conventional"
    purchase_price: float = 0
    down_payment_pct: float = 25.0
    down_payment_amt: float = 0
    interest_rate: float = 7.25
    loan_term_years: int = 30
    closing_cost_pct: float = 3.0
    closing_cost_amt: float = 0
    renovation_cost: float = 0
    furniture_cost: float = 0
    other_upfront_costs: float = 0
    pmi_monthly: float = 0
    origination_points_pct: float = 0
    io_period_years: int = 0
    is_active: bool = True

    @field_validator("interest_rate")
    @classmethod
    def interest_rate_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("interest_rate must be non-negative")
        return v

    @field_validator("purchase_price")
    @classmethod
    def purchase_price_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("purchase_price must be non-negative")
        return v

    @field_validator("down_payment_pct")
    @classmethod
    def down_payment_in_range(cls, v: float) -> float:
        if v < 0 or v > 100:
            raise ValueError("down_payment_pct must be between 0 and 100")
        return v

    @field_validator("loan_type")
    @classmethod
    def loan_type_valid(cls, v: str) -> str:
        if v not in _ALLOWED_LOAN_TYPES:
            raise ValueError(
                f"loan_type must be one of: {', '.join(sorted(_ALLOWED_LOAN_TYPES))}"
            )
        return v

    @field_validator("origination_points_pct")
    @classmethod
    def origination_points_in_range(cls, v: float) -> float:
        if v < 0 or v > 10:
            raise ValueError("origination_points_pct must be between 0 and 10")
        return v

    @field_validator("io_period_years")
    @classmethod
    def io_period_in_range(cls, v: int) -> int:
        if v < 0 or v > 10:
            raise ValueError("io_period_years must be between 0 and 10")
        return v


class ScenarioUpdate(BaseModel):
    name: str | None = None
    loan_type: str | None = None
    purchase_price: float | None = None
    down_payment_pct: float | None = None
    down_payment_amt: float | None = None
    interest_rate: float | None = None
    loan_term_years: int | None = None
    closing_cost_pct: float | None = None
    closing_cost_amt: float | None = None
    renovation_cost: float | None = None
    furniture_cost: float | None = None
    other_upfront_costs: float | None = None
    pmi_monthly: float | None = None
    origination_points_pct: float | None = None
    io_period_years: int | None = None
    is_active: bool | None = None

    @field_validator("interest_rate")
    @classmethod
    def interest_rate_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("interest_rate must be non-negative")
        return v

    @field_validator("purchase_price")
    @classmethod
    def purchase_price_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("purchase_price must be non-negative")
        return v

    @field_validator("down_payment_pct")
    @classmethod
    def down_payment_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("down_payment_pct must be between 0 and 100")
        return v

    @field_validator("loan_type")
    @classmethod
    def loan_type_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in _ALLOWED_LOAN_TYPES:
            raise ValueError(
                f"loan_type must be one of: {', '.join(sorted(_ALLOWED_LOAN_TYPES))}"
            )
        return v

    @field_validator("origination_points_pct")
    @classmethod
    def origination_points_in_range(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 10):
            raise ValueError("origination_points_pct must be between 0 and 10")
        return v

    @field_validator("io_period_years")
    @classmethod
    def io_period_in_range(cls, v: int | None) -> int | None:
        if v is not None and (v < 0 or v > 10):
            raise ValueError("io_period_years must be between 0 and 10")
        return v


class ScenarioResponse(BaseModel):
    id: str
    property_id: str
    name: str
    loan_type: str
    purchase_price: float
    down_payment_pct: float
    down_payment_amt: float
    interest_rate: float
    loan_term_years: int
    closing_cost_pct: float
    closing_cost_amt: float
    renovation_cost: float
    furniture_cost: float
    other_upfront_costs: float
    pmi_monthly: float
    origination_points_pct: float
    io_period_years: int
    is_active: bool

    model_config = {"from_attributes": True}
