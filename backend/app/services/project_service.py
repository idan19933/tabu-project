from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models.project import Project


def get_all(db: Session) -> list[Project]:
    return db.query(Project).order_by(Project.created_at.desc()).all()


def get_by_id(db: Session, project_id: UUID) -> Project | None:
    return (
        db.query(Project)
        .options(joinedload(Project.documents), joinedload(Project.simulations))
        .filter(Project.id == project_id)
        .first()
    )


def create(db: Session, name: str) -> Project:
    project = Project(name=name)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update(db: Session, project: Project, name: str | None) -> Project:
    if name is not None:
        project.name = name
    db.commit()
    db.refresh(project)
    return project


def delete(db: Session, project: Project) -> None:
    db.delete(project)
    db.commit()
