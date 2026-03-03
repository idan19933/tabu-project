from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.apartment_mix import ApartmentMix
from app.models.cost_parameter import CostParameter
from app.models.economic_parameter import EconomicParameter
from app.models.planning_parameter import PlanningParameter
from app.models.revenue_parameter import RevenueParameter
from app.models.simulation import Simulation, SimulationStatus
from app.schemas.project import ProjectCreate, ProjectDetail, ProjectOut, ProjectUpdate
from app.schemas.simulation import SimulationBrief, SimulationCreate, SimulationDetail
from app.services import project_service, simulation_service

router = APIRouter()


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return project_service.get_all(db)


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    return project_service.create(db, body.name)


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: UUID, db: Session = Depends(get_db)):
    project = project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: UUID, body: ProjectUpdate, db: Session = Depends(get_db)):
    project = project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project_service.update(db, project, body.name)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: UUID, db: Session = Depends(get_db)):
    project = project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    project_service.delete(db, project)


@router.get("/{project_id}/simulations", response_model=list[SimulationBrief])
def list_simulations(project_id: UUID, db: Session = Depends(get_db)):
    project = project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return simulation_service.list_by_project(db, project_id)


@router.post("/{project_id}/simulations", response_model=SimulationDetail, status_code=201)
def create_simulation(project_id: UUID, body: SimulationCreate, db: Session = Depends(get_db)):
    """Create a new empty simulation. Documents are uploaded to simulations directly."""
    project = project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    sim = simulation_service.create(db, project_id, body.version_name)
    db.commit()
    return simulation_service.get_by_id(db, sim.id)
