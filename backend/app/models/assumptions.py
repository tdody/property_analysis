import uuid
from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class STRAssumptions(Base):
    __tablename__ = "str_assumptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    property_id: Mapped[str] = mapped_column(String(36), ForeignKey("properties.id", ondelete="CASCADE"), unique=True)

    # Revenue
    avg_nightly_rate: Mapped[float] = mapped_column(Numeric(10, 2), default=200)
    occupancy_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=65.0)
    cleaning_fee_per_stay: Mapped[float] = mapped_column(Numeric(10, 2), default=150)
    avg_stay_length_nights: Mapped[float] = mapped_column(Numeric(6, 2), default=3.0)

    # Operating Expenses
    platform_fee_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=3.0)
    cleaning_cost_per_turn: Mapped[float] = mapped_column(Numeric(10, 2), default=120)
    property_mgmt_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    utilities_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=250)
    insurance_annual: Mapped[float] = mapped_column(Numeric(10, 2), default=2500)
    maintenance_reserve_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=5.0)
    capex_reserve_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=5.0)
    damage_reserve_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=2.0)
    supplies_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=100)
    lawn_snow_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    other_monthly_expense: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    vacancy_reserve_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    marketing_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    software_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    accounting_annual: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    legal_annual: Mapped[float] = mapped_column(Numeric(10, 2), default=0)

    # Rental Delay
    rental_delay_months: Mapped[int] = mapped_column(Integer, default=1)

    # Vermont / State Taxes
    state_rooms_tax_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=9.0)
    str_surcharge_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=3.0)
    local_option_tax_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=1.0)
    local_str_registration_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    local_gross_receipts_tax_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    platform_remits_tax: Mapped[bool] = mapped_column(Boolean, default=True)

    # Depreciation
    land_value_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=20.0)

    # Appreciation
    property_appreciation_pct_annual: Mapped[float] = mapped_column(Numeric(6, 2), default=2.5)

    # Growth Rates (Multi-Year Projections)
    revenue_growth_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=3.0)
    expense_growth_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=3.0)

    # Tax
    marginal_tax_rate_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)

    # Seasonal Occupancy
    use_seasonal_occupancy: Mapped[bool] = mapped_column(Boolean, default=False)
    peak_months: Mapped[int] = mapped_column(Integer, default=6)
    peak_occupancy_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=80.0)
    off_peak_occupancy_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=45.0)

    property: Mapped["Property"] = relationship(back_populates="assumptions")
