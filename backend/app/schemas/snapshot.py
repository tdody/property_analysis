# backend/app/schemas/snapshot.py
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SnapshotCreate(BaseModel):
    name: str | None = None


class SnapshotListItem(BaseModel):
    id: str
    scenario_id: str
    name: str
    created_at: datetime
    monthly_cashflow: float | None = None
    cash_on_cash_return: float | None = None

    model_config = {"from_attributes": True}


class SnapshotResponse(BaseModel):
    id: str
    scenario_id: str
    name: str
    snapshot_data: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class DiffChange(BaseModel):
    field: str
    label: str
    category: str
    old_value: Any
    new_value: Any
    format: str  # "currency", "percent", "number", "text"
    direction: str | None = None  # "increased", "decreased", None


class DiffResponse(BaseModel):
    snapshot_name: str
    snapshot_date: datetime
    total_changes: int
    changes: list[DiffChange]
    unchanged_count: int
    rental_type_changed: bool = False
    snapshot_rental_type: str | None = None
    current_rental_type: str | None = None
