from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.property import Property


class LTRAssumptions(Base):
    __tablename__ = "ltr_assumptions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    property_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("properties.id", ondelete="CASCADE"), unique=True
    )

    # Revenue
    monthly_rent: Mapped[float] = mapped_column(Numeric(10, 2), default=1500)
    lease_duration_months: Mapped[int] = mapped_column(Integer, default=12)
    pet_rent_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    late_fee_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    vacancy_rate_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=5.0)
    lease_up_period_months: Mapped[int] = mapped_column(Integer, default=1)

    # Expenses
    property_mgmt_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=8.0)
    insurance_annual: Mapped[float] = mapped_column(Numeric(10, 2), default=2500)
    maintenance_reserve_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=5.0)
    capex_reserve_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=5.0)
    landlord_repairs_annual: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    tenant_turnover_cost: Mapped[float] = mapped_column(Numeric(10, 2), default=1500)
    utilities_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    lawn_snow_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    other_monthly_expense: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    accounting_annual: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    legal_annual: Mapped[float] = mapped_column(Numeric(10, 2), default=0)

    # Shared / Depreciation / Growth
    land_value_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=20.0)
    property_appreciation_pct_annual: Mapped[float] = mapped_column(
        Numeric(6, 2), default=2.5
    )
    revenue_growth_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=3.0)
    expense_growth_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=3.0)
    marginal_tax_rate_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)

    property: Mapped["Property"] = relationship(back_populates="ltr_assumptions")
