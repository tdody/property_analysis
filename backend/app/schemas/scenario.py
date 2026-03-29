from pydantic import BaseModel


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
    is_active: bool = True


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
    is_active: bool | None = None


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
    is_active: bool

    model_config = {"from_attributes": True}
