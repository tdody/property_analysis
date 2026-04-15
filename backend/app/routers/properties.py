import json

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
from app.services.analysis import (
    compute_and_cache_summary,
    compute_and_cache_ltr_summary,
)

router = APIRouter(prefix="/api/properties", tags=["properties"])


@router.get("", response_model=list[PropertySummary])
def list_properties(db: Session = Depends(get_db)):
    props = db.query(Property).filter(Property.is_archived == False).all()
    summaries = []
    for prop in props:
        summary = PropertySummary.model_validate(prop)
        summary.monthly_cashflow = (
            float(prop.cached_monthly_cashflow)
            if prop.cached_monthly_cashflow is not None
            else None
        )
        summary.cash_on_cash_return = (
            float(prop.cached_cash_on_cash_return)
            if prop.cached_cash_on_cash_return is not None
            else None
        )
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
                scraper_result=ScraperResultSchema(
                    **result.model_dump(exclude={"data"})
                ),
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

    # Build scraped snapshot from fields_found
    snapshot = {}
    for field_name in result.fields_found:
        if field_name in ("property_type", "image_url"):
            continue
        val = getattr(result.data, field_name, None)
        if val is not None:
            snapshot[field_name] = val
    prop.scraped_snapshot = json.dumps(snapshot) if snapshot else None

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


# Fields that don't affect financial calculations — no need to invalidate cache
# Fields that don't affect financial calculations — no need to recompute cache
_NON_FINANCIAL_FIELDS = {
    "name",
    "source_url",
    "image_url",
    "address",
    "city",
    "state",
    "zip_code",
    "notes",
    "property_type",
    "in_portfolio",
    "beds",
    "baths",
    "sqft",
    "lot_sqft",
    "year_built",
    "estimated_value",
    "active_rental_type",
}


def _recompute_cache(prop: Property, db: Session) -> None:
    """Recompute and cache metrics for the property's active rental type."""
    scenario = (
        db.query(MortgageScenario)
        .filter(
            MortgageScenario.property_id == prop.id,
            MortgageScenario.is_active == True,
        )
        .first()
    )
    if not scenario:
        prop.cached_monthly_cashflow = None
        prop.cached_cash_on_cash_return = None
        return

    if prop.active_rental_type == "ltr":
        ltr = (
            db.query(LTRAssumptions)
            .filter(LTRAssumptions.property_id == prop.id)
            .first()
        )
        if ltr:
            compute_and_cache_ltr_summary(prop, scenario, ltr, db)
        else:
            prop.cached_monthly_cashflow = None
            prop.cached_cash_on_cash_return = None
    else:
        assumptions = (
            db.query(STRAssumptions)
            .filter(STRAssumptions.property_id == prop.id)
            .first()
        )
        if assumptions:
            compute_and_cache_summary(prop, scenario, assumptions, db)
        else:
            prop.cached_monthly_cashflow = None
            prop.cached_cash_on_cash_return = None


@router.put("/{property_id}", response_model=PropertyResponse)
def update_property(
    property_id: str, data: PropertyUpdate, db: Session = Depends(get_db)
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    updated_fields = data.model_dump(exclude_unset=True)
    rental_type_changed = (
        "active_rental_type" in updated_fields
        and updated_fields["active_rental_type"] != prop.active_rental_type
    )
    has_financial_change = any(f not in _NON_FINANCIAL_FIELDS for f in updated_fields)

    for field, value in updated_fields.items():
        setattr(prop, field, value)

    if rental_type_changed or has_financial_change:
        _recompute_cache(prop, db)

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
