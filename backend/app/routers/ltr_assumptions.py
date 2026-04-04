from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.models.ltr_assumptions import LTRAssumptions
from app.schemas.ltr_assumptions import LTRAssumptionsUpdate, LTRAssumptionsResponse

router = APIRouter(prefix="/api/properties/{property_id}/ltr-assumptions", tags=["ltr-assumptions"])


def _get_or_create_ltr(property_id: str, db: Session) -> LTRAssumptions:
    """Get LTR assumptions, auto-creating with defaults if missing."""
    ltr = db.query(LTRAssumptions).filter(LTRAssumptions.property_id == property_id).first()
    if not ltr:
        prop = db.query(Property).filter(Property.id == property_id).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")
        ltr = LTRAssumptions(property_id=property_id)
        db.add(ltr)
        db.commit()
        db.refresh(ltr)
    return ltr


@router.get("", response_model=LTRAssumptionsResponse)
def get_ltr_assumptions(property_id: str, db: Session = Depends(get_db)):
    return _get_or_create_ltr(property_id, db)


@router.put("", response_model=LTRAssumptionsResponse)
def update_ltr_assumptions(property_id: str, data: LTRAssumptionsUpdate, db: Session = Depends(get_db)):
    ltr = _get_or_create_ltr(property_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ltr, field, value)
    prop = db.query(Property).filter(Property.id == property_id).first()
    if prop:
        prop.cached_monthly_cashflow = None
        prop.cached_cash_on_cash_return = None
    db.commit()
    db.refresh(ltr)
    return ltr
