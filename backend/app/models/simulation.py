import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SimulationStatus(str, enum.Enum):
    DRAFT = "Draft"
    AI_EXTRACTING = "AI_Extracting"
    PENDING_REVIEW = "Pending_Review"
    APPROVED_FOR_CALC = "Approved_For_Calc"
    COMPLETED = "Completed"


class Simulation(Base):
    __tablename__ = "simulations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    version_name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[SimulationStatus] = mapped_column(
        Enum(SimulationStatus), default=SimulationStatus.DRAFT, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    extraction_progress: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)
    agent_status: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)

    project = relationship("Project", back_populates="simulations")
    documents = relationship(
        "Document", back_populates="simulation", cascade="all, delete-orphan",
        foreign_keys="[Document.simulation_id]",
    )
    planning_parameters = relationship(
        "PlanningParameter", back_populates="simulation", uselist=False, cascade="all, delete-orphan"
    )
    apartment_mix = relationship(
        "ApartmentMix", back_populates="simulation", cascade="all, delete-orphan"
    )
    economic_parameters = relationship(
        "EconomicParameter", back_populates="simulation", uselist=False, cascade="all, delete-orphan"
    )
    cost_parameters = relationship(
        "CostParameter", back_populates="simulation", uselist=False, cascade="all, delete-orphan"
    )
    revenue_parameters = relationship(
        "RevenueParameter", back_populates="simulation", uselist=False, cascade="all, delete-orphan"
    )
    simulation_results = relationship(
        "SimulationResult", back_populates="simulation", uselist=False, cascade="all, delete-orphan"
    )
