from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PlanningParameter(Base):
    __tablename__ = "planning_parameters"

    simulation_id = mapped_column(
        UUID(as_uuid=True), ForeignKey("simulations.id", ondelete="CASCADE"),
        primary_key=True
    )

    # Original fields (kept for backward compat, all nullable now)
    returns_percent: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True, default=0)
    multiplier_far: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True, default=0)
    avg_apt_size_sqm: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True, default=0)
    service_area_sqm: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True, default=0)
    number_of_floors: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    coverage_above_ground: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True, default=0)
    coverage_underground: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True, default=0)
    gross_area_per_parking: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True, default=0)
    building_lines_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    public_tasks_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    parking_standard_ratio: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True, default=0)
    typ_floor_area_min: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True, default=0)
    typ_floor_area_max: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True, default=0)
    apts_per_floor_min: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    apts_per_floor_max: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)

    # New fields matching Excel spec
    return_area_per_apt = mapped_column(Numeric(8, 2), nullable=True)       # שטח תמורה לדירה
    service_area_percent = mapped_column(Numeric(5, 2), nullable=True)      # אחוז שטחי שירות
    public_area_sqm = mapped_column(Numeric(10, 2), nullable=True)          # שטח ציבורי
    parking_floor_area = mapped_column(Numeric(10, 2), nullable=True)       # שטח לקומת חניון
    balcony_area_per_unit = mapped_column(Numeric(8, 2), nullable=True)     # שטח מרפסת
    blue_line_area = mapped_column(Numeric(10, 2), nullable=True)           # שטח קו כחול

    # Audit gap: planning stage
    planning_stage: Mapped[str | None] = mapped_column(String(50), nullable=True)

    ai_extraction_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    simulation = relationship("Simulation", back_populates="planning_parameters")
