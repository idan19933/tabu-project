import uuid as _uuid
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models.apartment_mix import ApartmentMix
from app.models.cost_parameter import CostParameter
from app.models.economic_parameter import EconomicParameter
from app.models.planning_parameter import PlanningParameter
from app.models.revenue_parameter import RevenueParameter
from app.models.simulation import Simulation, SimulationStatus
from app.models.simulation_result import SimulationResult


def _full_query(db: Session):
    return db.query(Simulation).options(
        joinedload(Simulation.planning_parameters),
        joinedload(Simulation.apartment_mix),
        joinedload(Simulation.economic_parameters),
        joinedload(Simulation.cost_parameters),
        joinedload(Simulation.revenue_parameters),
        joinedload(Simulation.simulation_results),
    )


def list_by_project(db: Session, project_id: UUID) -> list[Simulation]:
    return (
        db.query(Simulation)
        .filter(Simulation.project_id == project_id)
        .order_by(Simulation.created_at.desc())
        .all()
    )


def get_by_id(db: Session, sim_id: UUID) -> Simulation | None:
    return _full_query(db).filter(Simulation.id == sim_id).first()


def create(db: Session, project_id: UUID, version_name: str) -> Simulation:
    sim = Simulation(project_id=project_id, version_name=version_name)
    db.add(sim)
    db.commit()
    db.refresh(sim)
    return sim


def _upsert_dict(db: Session, model_cls, sim, data: dict, defaults: dict | None = None):
    """Generic upsert for a 1:1 relationship table."""
    existing = db.query(model_cls).filter(model_cls.simulation_id == sim.id).first()
    if existing:
        for k, v in data.items():
            if v is not None:
                setattr(existing, k, v)
    else:
        row = defaults.copy() if defaults else {}
        row.update({k: v for k, v in data.items() if v is not None})
        row["simulation_id"] = sim.id
        db.add(model_cls(**row))


def update_full(
    db: Session,
    sim: Simulation,
    version_name: str | None = None,
    planning: dict | None = None,
    apartment_mix_list: list[dict] | None = None,
    economic: dict | None = None,
    cost: dict | None = None,
    revenue: dict | None = None,
) -> Simulation:
    if version_name is not None:
        sim.version_name = version_name

    # UPSERT planning_parameters
    if planning is not None:
        _upsert_dict(db, PlanningParameter, sim, planning, defaults={})

    # UPSERT apartment_mix — replace rows
    if apartment_mix_list is not None:
        db.query(ApartmentMix).filter(ApartmentMix.simulation_id == sim.id).delete()
        for item in apartment_mix_list:
            db.add(ApartmentMix(simulation_id=sim.id, **item))

    # UPSERT economic_parameters (legacy)
    if economic is not None:
        defaults = {
            "sales_prices_by_use": {}, "cost_construction_dev": 0,
            "cost_planning_mgmt": 0, "levies_fees_taxes": 0,
            "timeline_months": 0, "interest_rate": 0,
            "sales_pace_per_month": 0, "marketing_discount_pct": 0,
        }
        _upsert_dict(db, EconomicParameter, sim, economic, defaults)

    # UPSERT cost_parameters (new spec)
    if cost is not None:
        _upsert_dict(db, CostParameter, sim, cost, defaults={})

    # UPSERT revenue_parameters (new spec)
    if revenue is not None:
        _upsert_dict(db, RevenueParameter, sim, revenue, defaults={})

    # If sim was edited after being completed or in review, allow re-calculation
    if sim.status in (SimulationStatus.PENDING_REVIEW, SimulationStatus.COMPLETED):
        sim.status = SimulationStatus.APPROVED_FOR_CALC

    db.commit()
    return get_by_id(db, sim.id)


def clone(db: Session, sim: Simulation) -> Simulation:
    """Deep-copy a simulation with all parameters for what-if analysis."""
    new_sim = Simulation(
        project_id=sim.project_id,
        version_name=f"{sim.version_name} - העתק",
        status=SimulationStatus.APPROVED_FOR_CALC,
    )
    db.add(new_sim)
    db.flush()

    # Deep copy planning_parameters
    if sim.planning_parameters:
        pp = sim.planning_parameters
        data = {}
        for col in PlanningParameter.__table__.columns:
            if col.name != "simulation_id":
                data[col.name] = getattr(pp, col.name)
        db.add(PlanningParameter(simulation_id=new_sim.id, **data))

    # Deep copy ALL apartment_mix rows
    for am in sim.apartment_mix:
        db.add(ApartmentMix(
            simulation_id=new_sim.id,
            apartment_type=am.apartment_type,
            quantity=am.quantity,
            percentage_of_mix=am.percentage_of_mix,
        ))

    # Deep copy economic_parameters (legacy)
    if sim.economic_parameters:
        ep = sim.economic_parameters
        data = {}
        for col in EconomicParameter.__table__.columns:
            if col.name != "simulation_id":
                data[col.name] = getattr(ep, col.name)
        db.add(EconomicParameter(simulation_id=new_sim.id, **data))

    # Deep copy cost_parameters
    if sim.cost_parameters:
        cp = sim.cost_parameters
        data = {}
        for col in CostParameter.__table__.columns:
            if col.name != "simulation_id":
                data[col.name] = getattr(cp, col.name)
        db.add(CostParameter(simulation_id=new_sim.id, **data))

    # Deep copy revenue_parameters
    if sim.revenue_parameters:
        rp = sim.revenue_parameters
        data = {}
        for col in RevenueParameter.__table__.columns:
            if col.name != "simulation_id":
                data[col.name] = getattr(rp, col.name)
        db.add(RevenueParameter(simulation_id=new_sim.id, **data))

    # Do NOT copy simulation_results — clone starts fresh
    db.commit()
    return get_by_id(db, new_sim.id)


def set_status(db: Session, sim: Simulation, status: SimulationStatus) -> Simulation:
    sim.status = status
    db.commit()
    db.refresh(sim)
    return sim


def _build_snapshot(sr: SimulationResult) -> dict:
    """Build a dict snapshot of current result values for delta analysis."""
    snapshot = {}
    for col in SimulationResult.__table__.columns:
        if col.name in ("simulation_id", "previous_results_snapshot"):
            continue
        val = getattr(sr, col.name, None)
        if val is not None:
            try:
                snapshot[col.name] = float(val)
            except (TypeError, ValueError):
                snapshot[col.name] = val
        else:
            snapshot[col.name] = None
    return snapshot


def save_results(db: Session, sim: Simulation, **results) -> SimulationResult:
    """Save calculation results. Accepts any column names from SimulationResult.

    If previous results exist, snapshots them into previous_results_snapshot
    for delta analysis.
    """
    valid_cols = {c.name for c in SimulationResult.__table__.columns if c.name != "simulation_id"}
    if sim.simulation_results:
        # Snapshot current results before overwriting
        snapshot = _build_snapshot(sim.simulation_results)
        results["previous_results_snapshot"] = snapshot
        for f in valid_cols:
            if f in results:
                setattr(sim.simulation_results, f, results[f])
    else:
        data = {f: results.get(f) for f in valid_cols if f in results}
        data["simulation_id"] = sim.id
        db.add(SimulationResult(**data))
    db.commit()
    return sim.simulation_results
