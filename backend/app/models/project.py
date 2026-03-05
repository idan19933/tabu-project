import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    tabu_data: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)

    # Cached geo location from GovMap WFS
    geo_data: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)

    # Market research agent output
    market_research_data: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)
    market_research_status: Mapped[str | None] = mapped_column(
        String(20), nullable=True, default=None
    )  # null | "running" | "completed" | "failed"

    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    simulations = relationship("Simulation", back_populates="project", cascade="all, delete-orphan")
