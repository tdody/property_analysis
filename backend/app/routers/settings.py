import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import UserSettings
from app.schemas.settings import UserSettingsResponse, UserSettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

CURRENT_USER_ID = "default"
LOGO_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "uploads" / "logos"
MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2 MB
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}


def get_or_create_settings(db: Session) -> UserSettings:
    settings = (
        db.query(UserSettings).filter(UserSettings.user_id == CURRENT_USER_ID).first()
    )
    if not settings:
        settings = UserSettings(user_id=CURRENT_USER_ID)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("", response_model=UserSettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    return get_or_create_settings(db)


@router.put("", response_model=UserSettingsResponse)
def update_settings(data: UserSettingsUpdate, db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings


@router.post("/logo", response_model=UserSettingsResponse)
def upload_logo(file: UploadFile, db: Session = Depends(get_db)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PNG and JPEG files are allowed")

    contents = file.file.read()
    if len(contents) > MAX_LOGO_SIZE:
        raise HTTPException(status_code=400, detail="File size must be under 2 MB")

    # Validate magic bytes
    if ext == ".png" and contents[:4] != b"\x89PNG":
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PNG")
    if ext in (".jpg", ".jpeg") and contents[:2] != b"\xff\xd8":
        raise HTTPException(status_code=400, detail="File does not appear to be a valid JPEG")

    os.makedirs(LOGO_DIR, exist_ok=True)

    filename = f"logo{ext}"
    filepath = (LOGO_DIR / filename).resolve()
    if not filepath.is_relative_to(LOGO_DIR.resolve()):
        raise HTTPException(status_code=400, detail="Invalid filename")
    filepath.write_bytes(contents)

    settings = get_or_create_settings(db)
    settings.logo_filename = filename
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/logo")
def get_logo(db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    if not settings.logo_filename:
        raise HTTPException(status_code=404, detail="No logo uploaded")
    filepath = LOGO_DIR / settings.logo_filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Logo file not found")
    return FileResponse(filepath)
