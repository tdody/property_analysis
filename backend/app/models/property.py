from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.assumptions import STRAssumptions
    from app.models.ltr_assumptions import LTRAssumptions
    from app.models.scenario import MortgageScenario


class RentalType(str, Enum):
    STR = "str"
    LTR = "ltr"


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    name: Mapped[str] = mapped_column(String(255))
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    address: Mapped[str] = mapped_column(String(500), default="")
    city: Mapped[str] = mapped_column(String(255), default="")
    state: Mapped[str] = mapped_column(String(2), default="")
    zip_code: Mapped[str] = mapped_column(String(10), default="")
    listing_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    estimated_value: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    beds: Mapped[int] = mapped_column(Integer, default=0)
    baths: Mapped[float] = mapped_column(Float, default=0)
    sqft: Mapped[int] = mapped_column(Integer, default=0)
    lot_sqft: Mapped[int | None] = mapped_column(Integer, nullable=True)
    year_built: Mapped[int | None] = mapped_column(Integer, nullable=True)
    property_type: Mapped[str] = mapped_column(String(50), default="single_family")
    hoa_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    annual_taxes: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    tax_rate: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    is_homestead_tax: Mapped[bool] = mapped_column(Boolean, default=True)
    nonhomestead_annual_taxes: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    notes: Mapped[str] = mapped_column(Text, default="")
    scraped_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    in_portfolio: Mapped[bool] = mapped_column(Boolean, default=False)
    cached_monthly_cashflow: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    cached_cash_on_cash_return: Mapped[float | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )
    active_rental_type: Mapped[str] = mapped_column(
        String(10), default=RentalType.STR.value
    )

    scenarios: Mapped[list["MortgageScenario"]] = relationship(
        back_populates="property", cascade="all, delete-orphan"
    )
    assumptions: Mapped["STRAssumptions | None"] = relationship(
        back_populates="property", uselist=False, cascade="all, delete-orphan"
    )
    ltr_assumptions: Mapped["LTRAssumptions | None"] = relationship(
        back_populates="property", uselist=False, cascade="all, delete-orphan"
    )
