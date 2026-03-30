import uuid
from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MortgageScenario(Base):
    __tablename__ = "mortgage_scenarios"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    property_id: Mapped[str] = mapped_column(String(36), ForeignKey("properties.id"))
    name: Mapped[str] = mapped_column(String(255), default="Default Scenario")
    loan_type: Mapped[str] = mapped_column(String(20), default="conventional")
    purchase_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    down_payment_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=25.0)
    down_payment_amt: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    interest_rate: Mapped[float] = mapped_column(Numeric(6, 3), default=7.25)
    loan_term_years: Mapped[int] = mapped_column(Integer, default=30)
    closing_cost_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=3.0)
    closing_cost_amt: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    renovation_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    furniture_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    other_upfront_costs: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    pmi_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    origination_points_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    io_period_years: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    property: Mapped["Property"] = relationship(back_populates="scenarios")
