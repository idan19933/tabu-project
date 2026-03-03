from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RevenueParameter(Base):
    """Revenue pricing inputs matching the Excel spec (row 67)."""
    __tablename__ = "revenue_parameters"

    simulation_id = mapped_column(
        UUID(as_uuid=True), ForeignKey("simulations.id", ondelete="CASCADE"),
        primary_key=True
    )

    # Price per unit by type — JSON like {"3_rooms": 2500000, "4_rooms": 3200000}
    price_per_unit_by_type = mapped_column(JSON, nullable=True)

    # Or price per sqm by use
    price_per_sqm_residential = mapped_column(Numeric(12, 2), nullable=True)
    price_per_sqm_commercial = mapped_column(Numeric(12, 2), nullable=True)

    # Audit gap: sales pace, marketing discount, parking/storage prices
    sales_pace_per_month = mapped_column(Numeric(8, 2), nullable=True)
    marketing_discount_pct = mapped_column(Numeric(5, 2), nullable=True)
    price_per_sqm_parking = mapped_column(Numeric(12, 2), nullable=True)       # מחיר חניה למ"ר
    price_per_sqm_storage = mapped_column(Numeric(12, 2), nullable=True)       # מחיר מחסן למ"ר

    # AI metadata
    ai_extraction_metadata = mapped_column(JSON, nullable=True)

    simulation = relationship("Simulation", back_populates="revenue_parameters")
