from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.models.scenario import MortgageScenario
from app.models.assumptions import STRAssumptions
from app.models.ltr_assumptions import LTRAssumptions
from app.routers.settings import get_or_create_settings
from app.schemas.property import (
    PropertyCreate,
    PropertyUpdate,
    PropertyResponse,
    PropertySummary,
    ScrapeRequest,
    ScrapeResponse,
    ScraperResultSchema,
)
from app.services.scraper.redfin import scrape_redfin_property, parse_redfin_url

router = APIRouter(prefix="/api/properties", tags=["properties"])


@router.get("", response_model=list[PropertySummary])
def list_properties(db: Session = Depends(get_db)):
    props = db.query(Property).filter(Property.is_archived == False).all()
    summaries = []
    for prop in props:
        summary = PropertySummary.model_validate(prop)
        summary.monthly_cashflow = float(prop.cached_monthly_cashflow) if prop.cached_monthly_cashflow is not None else None
        summary.cash_on_cash_return = float(prop.cached_cash_on_cash_return) if prop.cached_cash_on_cash_return is not None else None
        summaries.append(summary)
    return summaries


@router.post("", response_model=PropertyResponse, status_code=201)
def create_property(data: PropertyCreate, db: Session = Depends(get_db)):
    prop = Property(**data.model_dump())
    db.add(prop)
    db.flush()  # Ensure prop.id is populated
    # Auto-create default STR assumptions with user's seasonal defaults
    user_settings = get_or_create_settings(db)
    assumptions = STRAssumptions(
        property_id=prop.id,
        peak_months=user_settings.default_peak_months,
        peak_occupancy_pct=user_settings.default_peak_occupancy_pct,
        off_peak_occupancy_pct=user_settings.default_off_peak_occupancy_pct,
    )
    db.add(assumptions)
    # Auto-create default LTR assumptions
    ltr_assumptions = LTRAssumptions(property_id=prop.id)
    db.add(ltr_assumptions)
    db.commit()
    db.refresh(prop)
    return prop


@router.post("/scrape", response_model=ScrapeResponse, status_code=201)
def scrape_property_endpoint(data: ScrapeRequest, db: Session = Depends(get_db)):
    # Validate URL format before calling scraper
    try:
        parse_redfin_url(data.url)
    except ValueError:
        raise HTTPException(status_code=422, detail="Not a valid Redfin property URL")

    result = scrape_redfin_property(data.url)

    if not result.scrape_succeeded:
        return JSONResponse(
            status_code=200,
            content=ScrapeResponse(
                property_id=None,
                scraper_result=ScraperResultSchema(**result.model_dump(exclude={"data"})),
            ).model_dump(),
        )

    # Create property from scraped data
    scraped = result.data
    prop = Property(
        name=scraped.address or "Untitled Property",
        source_url=result.source_url,
        image_url=scraped.image_url,
        address=scraped.address or "",
        city=scraped.city or "",
        state=scraped.state or "",
        zip_code=scraped.zip_code or "",
        listing_price=scraped.listing_price or 0,
        estimated_value=scraped.estimated_value,
        beds=scraped.beds or 0,
        baths=scraped.baths or 0,
        sqft=scraped.sqft or 0,
        lot_sqft=scraped.lot_sqft,
        year_built=scraped.year_built,
        property_type=scraped.property_type or "single_family",
        hoa_monthly=scraped.hoa_monthly or 0,
        annual_taxes=scraped.annual_taxes or 0,
    )
    db.add(prop)
    db.flush()

    # Create default assumptions with user's seasonal defaults
    user_settings = get_or_create_settings(db)
    assumptions = STRAssumptions(
        property_id=prop.id,
        peak_months=user_settings.default_peak_months,
        peak_occupancy_pct=user_settings.default_peak_occupancy_pct,
        off_peak_occupancy_pct=user_settings.default_off_peak_occupancy_pct,
    )
    db.add(assumptions)

    # Create default LTR assumptions
    ltr_assumptions = LTRAssumptions(property_id=prop.id)
    db.add(ltr_assumptions)

    # Create default scenario with listing price as purchase price
    scenario = MortgageScenario(
        property_id=prop.id,
        name="Default Scenario",
        purchase_price=scraped.listing_price or 0,
        down_payment_amt=(scraped.listing_price or 0) * 0.25,
        closing_cost_amt=(scraped.listing_price or 0) * 0.03,
        is_active=True,
    )
    db.add(scenario)

    db.commit()
    db.refresh(prop)

    return ScrapeResponse(
        property_id=prop.id,
        scraper_result=ScraperResultSchema(**result.model_dump(exclude={"data"})),
    )


@router.get("/{property_id}", response_model=PropertyResponse)
def get_property(property_id: str, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


@router.put("/{property_id}", response_model=PropertyResponse)
def update_property(property_id: str, data: PropertyUpdate, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(prop, field, value)
    prop.cached_monthly_cashflow = None
    prop.cached_cash_on_cash_return = None
    db.commit()
    db.refresh(prop)
    return prop


@router.delete("/{property_id}")
def delete_property(property_id: str, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    prop.is_archived = True
    db.commit()
    return {"status": "archived"}
