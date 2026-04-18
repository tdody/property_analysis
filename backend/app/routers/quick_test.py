from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from app.services.computation.quick_test import compute_quick_test

router = APIRouter(tags=["quick-test"])


class QuickTestRequest(BaseModel):
    purchase_price: float
    down_payment_pct: float = 25.0
    interest_rate: float = 7.0
    loan_term_years: int = 30
    nightly_rate: float | None = None
    occupancy_pct: float | None = None
    monthly_rent: float | None = None

    @field_validator("purchase_price")
    @classmethod
    def price_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("purchase_price must be positive")
        return v

    @field_validator("down_payment_pct")
    @classmethod
    def down_payment_in_range(cls, v: float) -> float:
        if v < 0 or v > 100:
            raise ValueError("down_payment_pct must be between 0 and 100")
        return v

    @field_validator("interest_rate")
    @classmethod
    def interest_rate_in_range(cls, v: float) -> float:
        if v < 0 or v > 20:
            raise ValueError("interest_rate must be between 0 and 20")
        return v

    @field_validator("loan_term_years")
    @classmethod
    def loan_term_allowed(cls, v: int) -> int:
        if v not in (15, 30):
            raise ValueError("loan_term_years must be 15 or 30")
        return v


class QuickTestResponse(BaseModel):
    rental_type: str
    monthly_cashflow: float
    annual_cashflow: float
    annual_coc: float
    cap_rate: float
    dscr: float
    noi: float
    total_cash_invested: float
    monthly_housing_cost: float
    verdict: str


@router.post("/api/quick-test", response_model=QuickTestResponse)
def quick_test(req: QuickTestRequest):
    has_str = req.nightly_rate is not None and req.occupancy_pct is not None
    has_ltr = req.monthly_rent is not None
    if not has_str and not has_ltr:
        raise HTTPException(
            status_code=422,
            detail="Provide nightly_rate + occupancy_pct (STR) or monthly_rent (LTR)",
        )
    result = compute_quick_test(
        purchase_price=req.purchase_price,
        down_payment_pct=req.down_payment_pct,
        interest_rate=req.interest_rate,
        loan_term_years=req.loan_term_years,
        nightly_rate=req.nightly_rate,
        occupancy_pct=req.occupancy_pct,
        monthly_rent=req.monthly_rent,
    )
    return QuickTestResponse(**result)
