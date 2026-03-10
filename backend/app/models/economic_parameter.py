from sqlalchemy import ForeignKey, Integer, Numeric
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EconomicParameter(Base):
    __tablename__ = "economic_parameters"

    simulation_id = mapped_column(
        UUID(as_uuid=True), ForeignKey("simulations.id", ondelete="CASCADE"),
        primary_key=True
    )
    sales_prices_by_use: Mapped[dict] = mapped_column(JSON, nullable=False)
    cost_construction_dev: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    cost_planning_mgmt: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    levies_fees_taxes: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    timeline_months: Mapped[int] = mapped_column(Integer, nullable=False)
    interest_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    sales_pace_per_month: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    marketing_discount_pct: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    ai_extraction_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    simulation = relationship("Simulation", back_populates="economic_parameters")
