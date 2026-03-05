from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str


class ProjectUpdate(BaseModel):
    name: str | None = None


class ProjectOut(BaseModel):
    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectDetail(ProjectOut):
    documents: list["DocumentBrief"] = []
    simulations: list["SimulationBrief"] = []
    tabu_data: dict | None = None
    market_research_status: str | None = None
    market_research_data: dict | None = None


# Avoid circular imports — forward refs resolved below
from app.schemas.document import DocumentBrief  # noqa: E402
from app.schemas.simulation import SimulationBrief  # noqa: E402

ProjectDetail.model_rebuild()
