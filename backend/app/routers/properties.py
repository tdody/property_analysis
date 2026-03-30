from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.models.scenario import MortgageScenario
from app.models.assumptions import STRAssumptions
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
        # Compute cashflow for active scenario if available
        active_scenario = db.query(MortgageScenario).filter(
            MortgageScenario.property_id == prop.id,
            MortgageScenario.is_active == True,
        ).first()
        assumptions = db.query(STRAssumptions).filter(STRAssumptions.property_id == prop.id).first()
        if active_scenario and assumptions:
            try:
                from app.routers.compute import _compute_for_scenario
                result = _compute_for_scenario(prop, active_scenario, assumptions)
                summary.monthly_cashflow = result["metrics"].monthly_cashflow
                summary.cash_on_cash_return = result["metrics"].cash_on_cash_return
            except Exception:
                pass
        summaries.append(summary)
    return summaries


@router.post("", response_model=PropertyResponse, status_code=201)
def create_property(data: PropertyCreate, db: Session = Depends(get_db)):
    prop = Property(**data.model_dump())
    db.add(prop)
    db.flush()  # Ensure prop.id is populated
    # Auto-create default STR assumptions
    assumptions = STRAssumptions(property_id=prop.id)
    db.add(assumptions)
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

    # Create default assumptions
    assumptions = STRAssumptions(property_id=prop.id)
    db.add(assumptions)

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
