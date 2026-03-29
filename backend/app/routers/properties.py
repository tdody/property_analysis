from fastapi import APIRouter, Depends, HTTPException
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
)

router = APIRouter(prefix="/api/properties", tags=["properties"])


@router.get("", response_model=list[PropertySummary])
def list_properties(db: Session = Depends(get_db)):
    props = db.query(Property).filter(Property.is_archived == False).all()
    summaries = []
    for prop in props:
        summary = PropertySummary.model_validate(prop)
        # Metric computation deferred until compute router exists (Task 10)
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
