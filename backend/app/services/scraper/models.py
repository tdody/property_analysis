from pydantic import BaseModel


class ScrapedPropertyData(BaseModel):
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


class ScraperResult(BaseModel):
    data: ScrapedPropertyData
    source: str
    source_url: str
    fields_found: list[str]
    fields_missing: list[str]
    scrape_succeeded: bool
    error_message: str | None = None
