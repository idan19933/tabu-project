import uuid as uuid_module
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.document import DocumentBrief, DocumentOut
from app.services import document_service

router = APIRouter()


@router.post("/upload", response_model=DocumentOut, status_code=201)
def upload_document(
    project_id: UUID = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    simulation_id: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    doc = document_service.save_upload(db, project_id, file, document_type)

    # Attach to simulation if provided (non-tabu docs belong to simulations)
    if simulation_id and document_type != "tabu":
        try:
            doc.simulation_id = uuid_module.UUID(simulation_id)
            db.commit()
        except (ValueError, Exception):
            pass

    # Trigger AI extraction in background
    from app.agents.extraction_agent import run_extraction
    background_tasks.add_task(run_extraction, str(doc.id), str(project_id))

    return doc


@router.get("/by-project/{project_id}", response_model=list[DocumentBrief])
def get_project_documents(project_id: UUID, db: Session = Depends(get_db)):
    """List all documents for a project."""
    return document_service.get_by_project(db, project_id)


@router.get("/by-simulation/{simulation_id}", response_model=list[DocumentBrief])
def get_simulation_documents(simulation_id: UUID, db: Session = Depends(get_db)):
    """List all documents attached to a simulation."""
    from app.models.document import Document
    docs = db.query(Document).filter(Document.simulation_id == simulation_id).all()
    return docs
