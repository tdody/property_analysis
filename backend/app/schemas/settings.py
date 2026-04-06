from datetime import datetime
from pydantic import BaseModel


class UserSettingsResponse(BaseModel):
    id: str
    user_id: str
    default_peak_months: int
    default_peak_occupancy_pct: float
    default_off_peak_occupancy_pct: float
    company_name: str | None = None
    logo_filename: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserSettingsUpdate(BaseModel):
    default_peak_months: int | None = None
    default_peak_occupancy_pct: float | None = None
    default_off_peak_occupancy_pct: float | None = None
    company_name: str | None = None
