import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(255), unique=True, default="default")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Seasonal occupancy defaults
    default_peak_months: Mapped[int] = mapped_column(Integer, default=6)
    default_peak_occupancy_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=80.0)
    default_off_peak_occupancy_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=45.0)
