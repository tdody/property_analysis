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
    # Scenario-level read-offs for the list view
    purchase_price: float | None = None
    interest_rate: float | None = None
    loan_term_years: int | None = None

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
