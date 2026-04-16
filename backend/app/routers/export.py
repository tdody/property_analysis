import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.services.pdf.generator import generate_lender_packet

router = APIRouter(tags=["export"])


@router.get("/api/properties/{property_id}/export/pdf")
def export_pdf(property_id: str, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    try:
        pdf_bytes = generate_lender_packet(property_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    safe_name = re.sub(r"[^\w\-]", "_", prop.name)
    filename = f"{safe_name}_lender_packet.pdf"

    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
