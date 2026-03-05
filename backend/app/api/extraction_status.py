"""Polling endpoint for real-time extraction status tracking."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.document import Document
from app.models.project import Project
from app.models.simulation import Simulation, SimulationStatus

router = APIRouter()


class DocumentExtractionStatus(BaseModel):
    id: UUID
    document_type: str
    extraction_status: str
    extraction_error: str | None = None

    model_config = {"from_attributes": True}


class ExtractionStatusResponse(BaseModel):
    project_id: UUID
    documents: list[DocumentExtractionStatus]
    tabu_data: dict | None = None
    extraction_progress: dict | None = None
    active_simulation_id: UUID | None = None
    active_simulation_status: str | None = None


@router.get("/{project_id}/extraction-status", response_model=ExtractionStatusResponse)
def get_extraction_status(project_id: UUID, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    docs = db.query(Document).filter(Document.project_id == project_id).all()

    # Find active AI-extracting simulation
    active_sim = (
        db.query(Simulation)
        .filter(
            Simulation.project_id == project_id,
            Simulation.status.in_([
                SimulationStatus.AI_EXTRACTING,
                SimulationStatus.PENDING_REVIEW,
            ]),
        )
        .order_by(Simulation.created_at.desc())
        .first()
    )

    return ExtractionStatusResponse(
        project_id=project_id,
        documents=[
            DocumentExtractionStatus(
                id=d.id,
                document_type=d.document_type,
                extraction_status=d.extraction_status.value,
                extraction_error=d.extraction_error,
            )
            for d in docs
        ],
        tabu_data=project.tabu_data,
        extraction_progress=active_sim.extraction_progress if active_sim else None,
        active_simulation_id=active_sim.id if active_sim else None,
        active_simulation_status=active_sim.status.value if active_sim else None,
    )
