import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.scenario import MortgageScenario
from app.schemas.scenario import ScenarioCreate, ScenarioUpdate, ScenarioResponse

router = APIRouter(prefix="/api/properties/{property_id}/scenarios", tags=["scenarios"])


@router.get("", response_model=list[ScenarioResponse])
def list_scenarios(property_id: str, db: Session = Depends(get_db)):
    return db.query(MortgageScenario).filter(MortgageScenario.property_id == property_id).all()


@router.post("", response_model=ScenarioResponse, status_code=201)
def create_scenario(property_id: str, data: ScenarioCreate, db: Session = Depends(get_db)):
    scenario = MortgageScenario(property_id=property_id, **data.model_dump())
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.put("/{scenario_id}", response_model=ScenarioResponse)
def update_scenario(property_id: str, scenario_id: str, data: ScenarioUpdate, db: Session = Depends(get_db)):
    scenario = db.query(MortgageScenario).filter(
        MortgageScenario.id == scenario_id,
        MortgageScenario.property_id == property_id,
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(scenario, field, value)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.delete("/{scenario_id}")
def delete_scenario(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    scenario = db.query(MortgageScenario).filter(
        MortgageScenario.id == scenario_id,
        MortgageScenario.property_id == property_id,
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    db.delete(scenario)
    db.commit()
    return {"status": "deleted"}


@router.post("/{scenario_id}/duplicate", response_model=ScenarioResponse, status_code=201)
def duplicate_scenario(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    original = db.query(MortgageScenario).filter(
        MortgageScenario.id == scenario_id,
        MortgageScenario.property_id == property_id,
    ).first()
    if not original:
        raise HTTPException(status_code=404, detail="Scenario not found")

    clone = MortgageScenario(
        id=str(uuid.uuid4()),
        property_id=property_id,
        name=f"{original.name} (copy)",
        loan_type=original.loan_type,
        purchase_price=original.purchase_price,
        down_payment_pct=original.down_payment_pct,
        down_payment_amt=original.down_payment_amt,
        interest_rate=original.interest_rate,
        loan_term_years=original.loan_term_years,
        closing_cost_pct=original.closing_cost_pct,
        closing_cost_amt=original.closing_cost_amt,
        renovation_cost=original.renovation_cost,
        furniture_cost=original.furniture_cost,
        other_upfront_costs=original.other_upfront_costs,
        pmi_monthly=original.pmi_monthly,
        is_active=False,
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return clone


@router.put("/{scenario_id}/activate", response_model=ScenarioResponse)
def activate_scenario(property_id: str, scenario_id: str, db: Session = Depends(get_db)):
    # Deactivate all scenarios for this property
    db.query(MortgageScenario).filter(
        MortgageScenario.property_id == property_id
    ).update({"is_active": False})
    # Activate the target
    scenario = db.query(MortgageScenario).filter(
        MortgageScenario.id == scenario_id,
        MortgageScenario.property_id == property_id,
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    scenario.is_active = True
    db.commit()
    db.refresh(scenario)
    return scenario
