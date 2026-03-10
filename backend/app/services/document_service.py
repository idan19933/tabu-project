import shutil
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.models.document import Document
from app.models.project import Project


def save_upload(db: Session, project_id: UUID, file: UploadFile, document_type: str) -> Document:
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(exist_ok=True)

    dest = upload_dir / f"{project_id}_{file.filename}"
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    doc = Document(
        project_id=project_id,
        document_type=document_type,
        file_path=str(dest),
    )
    db.add(doc)

    # Update project.updated_at
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        project.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(doc)
    return doc


def get_by_project(db: Session, project_id: UUID) -> list[Document]:
    return db.query(Document).filter(Document.project_id == project_id).all()


def get_by_id(db: Session, doc_id: UUID) -> Document | None:
    return db.query(Document).filter(Document.id == doc_id).first()
