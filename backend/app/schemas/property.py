from datetime import datetime
from pydantic import BaseModel, Field


class PropertyCreate(BaseModel):
    name: str
    source_url: str | None = None
    address: str = ""
    city: str = ""
    state: str = ""
    zip_code: str = ""
    listing_price: float = 0
    estimated_value: float | None = None
    beds: int = 0
    baths: float = 0
    sqft: int = 0
    lot_sqft: int | None = None
    year_built: int | None = None
    property_type: str = "single_family"
    hoa_monthly: float = 0
    annual_taxes: float = 0
    tax_rate: float | None = None
    is_homestead_tax: bool = True
    nonhomestead_annual_taxes: float | None = None
    notes: str = ""


class PropertyUpdate(BaseModel):
    name: str | None = None
    source_url: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    listing_price: float | None = None
    estimated_value: float | None = None
    beds: int | None = None
    baths: float | None = None
    sqft: int | None = None
    lot_sqft: int | None = None
    year_built: int | None = None
    property_type: str | None = None
    hoa_monthly: float | None = None
    annual_taxes: float | None = None
    tax_rate: float | None = None
    is_homestead_tax: bool | None = None
    nonhomestead_annual_taxes: float | None = None
    notes: str | None = None


class PropertySummary(BaseModel):
    id: str
    name: str
    address: str
    city: str
    state: str
    listing_price: float
    beds: int
    baths: float
    sqft: int
    property_type: str
    is_archived: bool
    monthly_cashflow: float | None = None
    cash_on_cash_return: float | None = None

    model_config = {"from_attributes": True}


class PropertyResponse(BaseModel):
    id: str
    created_at: datetime
    updated_at: datetime
    name: str
    source_url: str | None
    address: str
    city: str
    state: str
    zip_code: str
    listing_price: float
    estimated_value: float | None
    beds: int
    baths: float
    sqft: int
    lot_sqft: int | None
    year_built: int | None
    property_type: str
    hoa_monthly: float
    annual_taxes: float
    tax_rate: float | None
    is_homestead_tax: bool
    nonhomestead_annual_taxes: float | None
    notes: str
    is_archived: bool

    model_config = {"from_attributes": True}
