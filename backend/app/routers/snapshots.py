import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.models.scenario import MortgageScenario
from app.models.snapshot import ScenarioSnapshot
from app.schemas.snapshot import (
    SnapshotCreate,
    SnapshotListItem,
    SnapshotResponse,
    DiffResponse,
    DiffChange,
)
from app.services.snapshot import (
    create_snapshot,
    build_snapshot_data,
    compute_diff,
    restore_snapshot,
)

router = APIRouter(
    prefix="/api/properties/{property_id}/scenarios/{scenario_id}/snapshots",
    tags=["snapshots"],
)


def _get_prop_and_scenario(property_id: str, scenario_id: str, db: Session):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    scenario = (
        db.query(MortgageScenario)
        .filter(
            MortgageScenario.id == scenario_id,
            MortgageScenario.property_id == property_id,
        )
        .first()
    )
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return prop, scenario


@router.post("", response_model=SnapshotResponse, status_code=201)
def create_snapshot_endpoint(
    property_id: str,
    scenario_id: str,
    data: SnapshotCreate,
    db: Session = Depends(get_db),
):
    prop, scenario = _get_prop_and_scenario(property_id, scenario_id, db)
    try:
        snapshot = create_snapshot(prop, scenario, db, name=data.name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    db.refresh(snapshot)
    resp = SnapshotResponse(
        id=snapshot.id,
        scenario_id=snapshot.scenario_id,
        name=snapshot.name,
        snapshot_data=json.loads(snapshot.snapshot_data),
        created_at=snapshot.created_at,
    )
    return resp


@router.get("", response_model=list[SnapshotListItem])
def list_snapshots(
    property_id: str,
    scenario_id: str,
    db: Session = Depends(get_db),
):
    _get_prop_and_scenario(property_id, scenario_id, db)
    snapshots = (
        db.query(ScenarioSnapshot)
        .filter(ScenarioSnapshot.scenario_id == scenario_id)
        .order_by(ScenarioSnapshot.created_at.desc())
        .all()
    )
    items = []
    for s in snapshots:
        data = (
            json.loads(s.snapshot_data)
            if isinstance(s.snapshot_data, str)
            else s.snapshot_data
        )
        sc = data.get("scenario", {})
        items.append(
            SnapshotListItem(
                id=s.id,
                scenario_id=s.scenario_id,
                name=s.name,
                created_at=s.created_at,
                purchase_price=sc.get("purchase_price"),
                interest_rate=sc.get("interest_rate"),
                loan_term_years=sc.get("loan_term_years"),
            )
        )
    return items


@router.get("/{snapshot_id}", response_model=SnapshotResponse)
def get_snapshot(
    property_id: str,
    scenario_id: str,
    snapshot_id: str,
    db: Session = Depends(get_db),
):
    _get_prop_and_scenario(property_id, scenario_id, db)
    snapshot = (
        db.query(ScenarioSnapshot)
        .filter(
            ScenarioSnapshot.id == snapshot_id,
            ScenarioSnapshot.scenario_id == scenario_id,
        )
        .first()
    )
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return SnapshotResponse(
        id=snapshot.id,
        scenario_id=snapshot.scenario_id,
        name=snapshot.name,
        snapshot_data=json.loads(snapshot.snapshot_data),
        created_at=snapshot.created_at,
    )


@router.delete("/{snapshot_id}")
def delete_snapshot(
    property_id: str,
    scenario_id: str,
    snapshot_id: str,
    db: Session = Depends(get_db),
):
    _get_prop_and_scenario(property_id, scenario_id, db)
    snapshot = (
        db.query(ScenarioSnapshot)
        .filter(
            ScenarioSnapshot.id == snapshot_id,
            ScenarioSnapshot.scenario_id == scenario_id,
        )
        .first()
    )
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    db.delete(snapshot)
    db.commit()
    return {"status": "deleted"}


@router.get("/{snapshot_id}/diff", response_model=DiffResponse)
def diff_snapshot(
    property_id: str,
    scenario_id: str,
    snapshot_id: str,
    db: Session = Depends(get_db),
):
    prop, scenario = _get_prop_and_scenario(property_id, scenario_id, db)
    snapshot = (
        db.query(ScenarioSnapshot)
        .filter(
            ScenarioSnapshot.id == snapshot_id,
            ScenarioSnapshot.scenario_id == scenario_id,
        )
        .first()
    )
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    old_state = (
        json.loads(snapshot.snapshot_data)
        if isinstance(snapshot.snapshot_data, str)
        else snapshot.snapshot_data
    )
    new_state = build_snapshot_data(prop, scenario, db)
    diff = compute_diff(old_state, new_state)

    return DiffResponse(
        snapshot_name=snapshot.name,
        snapshot_date=snapshot.created_at,
        total_changes=diff["total_changes"],
        changes=[DiffChange(**c) for c in diff["changes"]],
        unchanged_count=diff["unchanged_count"],
    )


@router.post("/{snapshot_id}/restore")
def restore_snapshot_endpoint(
    property_id: str,
    scenario_id: str,
    snapshot_id: str,
    db: Session = Depends(get_db),
):
    prop, scenario = _get_prop_and_scenario(property_id, scenario_id, db)
    snapshot = (
        db.query(ScenarioSnapshot)
        .filter(
            ScenarioSnapshot.id == snapshot_id,
            ScenarioSnapshot.scenario_id == scenario_id,
        )
        .first()
    )
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    auto_snapshot = restore_snapshot(prop, scenario, snapshot, db)
    db.commit()
    return {
        "status": "restored",
        "auto_snapshot_id": auto_snapshot.id,
        "auto_snapshot_name": auto_snapshot.name,
    }
