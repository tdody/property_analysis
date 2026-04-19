import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.scenario import MortgageScenario  # noqa: F401


class ScenarioSnapshot(Base):
    __tablename__ = "scenario_snapshots"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    scenario_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("mortgage_scenarios.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(255), default="")
    snapshot_data: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    scenario: Mapped["MortgageScenario"] = relationship()
