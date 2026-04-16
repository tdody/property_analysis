from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import UserSettings
from app.schemas.settings import UserSettingsResponse, UserSettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

CURRENT_USER_ID = "default"


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
