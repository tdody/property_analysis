from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.assumptions import STRAssumptions
from app.schemas.assumptions import AssumptionsUpdate, AssumptionsResponse

router = APIRouter(prefix="/api/properties/{property_id}/assumptions", tags=["assumptions"])


@router.get("", response_model=AssumptionsResponse)
def get_assumptions(property_id: str, db: Session = Depends(get_db)):
    assumptions = db.query(STRAssumptions).filter(STRAssumptions.property_id == property_id).first()
    if not assumptions:
        raise HTTPException(status_code=404, detail="Assumptions not found")
    return assumptions


@router.put("", response_model=AssumptionsResponse)
def update_assumptions(property_id: str, data: AssumptionsUpdate, db: Session = Depends(get_db)):
    assumptions = db.query(STRAssumptions).filter(STRAssumptions.property_id == property_id).first()
    if not assumptions:
        raise HTTPException(status_code=404, detail="Assumptions not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(assumptions, field, value)
    db.commit()
    db.refresh(assumptions)
    return assumptions
