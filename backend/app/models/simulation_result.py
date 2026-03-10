from sqlalchemy import ForeignKey, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SimulationResult(Base):
    __tablename__ = "simulation_results"

    simulation_id = mapped_column(
        UUID(as_uuid=True), ForeignKey("simulations.id", ondelete="CASCADE"),
        primary_key=True
    )

    # Legacy KPI fields (kept for backward compat)
    profit: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    profitability_rate: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    irr: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    npv: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)

    # Legacy expanded fields
    total_revenue = mapped_column(Numeric(14, 2), nullable=True)
    net_revenue = mapped_column(Numeric(14, 2), nullable=True)
    total_costs = mapped_column(Numeric(14, 2), nullable=True)
    construction_cost = mapped_column(Numeric(14, 2), nullable=True)
    planning_cost = mapped_column(Numeric(14, 2), nullable=True)
    levies_cost = mapped_column(Numeric(14, 2), nullable=True)
    total_units = mapped_column(Integer, nullable=True)
    total_residential_area = mapped_column(Numeric(10, 2), nullable=True)
    residential_revenue = mapped_column(Numeric(14, 2), nullable=True)
    commercial_revenue = mapped_column(Numeric(14, 2), nullable=True)
    monthly_cash_flows = mapped_column(JSON, nullable=True)
    calculation_details = mapped_column(JSON, nullable=True)

    # --- New: מצב יוצא calculations ---
    total_return_floorplate = mapped_column(Numeric(14, 2), nullable=True)     # פלדלת תמורה
    total_new_units = mapped_column(Integer, nullable=True)                    # מספר דירות יוצא
    total_floorplate = mapped_column(Numeric(14, 2), nullable=True)            # שטח פלדלת כולל
    developer_units = mapped_column(Integer, nullable=True)                    # סה"כ דירות יזם
    developer_floorplate = mapped_column(Numeric(14, 2), nullable=True)        # שטח פלדלת כולל יזם
    avg_developer_unit_size = mapped_column(Numeric(10, 2), nullable=True)     # שטח פלדלת דירתית ממוצע ליזם
    combination_ratio = mapped_column(Numeric(5, 2), nullable=True)            # קומבינציה

    # --- New: פרוגרמה calculations ---
    service_areas = mapped_column(Numeric(14, 2), nullable=True)               # שטחי שירות
    total_above_ground = mapped_column(Numeric(14, 2), nullable=True)          # סה"כ שטחים עילי
    floor_area = mapped_column(Numeric(14, 2), nullable=True)                  # שטח רצפה
    max_buildings = mapped_column(Integer, nullable=True)                      # מספר בניינים מקסימלי
    above_ground_per_building = mapped_column(Numeric(14, 2), nullable=True)   # שטח עילי לבניין
    development_land = mapped_column(Numeric(14, 2), nullable=True)            # שטח קרקע לפיתוח
    residential_per_building = mapped_column(Numeric(14, 2), nullable=True)    # שטח עילי למגורים לבניין
    return_units_per_building = mapped_column(Numeric(8, 2), nullable=True)    # דירות תמורה לבניין
    developer_units_per_building = mapped_column(Numeric(8, 2), nullable=True)
    developer_floorplate_per_building = mapped_column(Numeric(14, 2), nullable=True)
    total_parking_spots = mapped_column(Integer, nullable=True)                # כמות חניות
    total_parking_area = mapped_column(Numeric(14, 2), nullable=True)          # שטח לחניון
    parking_floors = mapped_column(Numeric(8, 2), nullable=True)               # מספר קומות חניון
    total_balcony_area = mapped_column(Numeric(14, 2), nullable=True)          # שטח מרפסות

    # --- New: Financial results ---
    financing_cost = mapped_column(Numeric(14, 2), nullable=True)              # עלות מימון וערבויות
    total_costs_excl_vat = mapped_column(Numeric(14, 2), nullable=True)        # סה"כ עלויות ללא מע"מ
    total_costs_incl_vat = mapped_column(Numeric(14, 2), nullable=True)        # סה"כ עלויות כולל מע"מ
    expected_profit = mapped_column(Numeric(14, 2), nullable=True)             # רווח צפוי
    profit_percent = mapped_column(Numeric(8, 2), nullable=True)               # אחוז רווח
    profit_percent_standard21 = mapped_column(Numeric(8, 2), nullable=True)    # אחוז רווח לפי תקן 21

    # --- New: Breakdown JSONs ---
    cost_breakdown = mapped_column(JSON, nullable=True)
    revenue_breakdown = mapped_column(JSON, nullable=True)
    area_breakdown = mapped_column(JSON, nullable=True)

    # --- Audit gap: Delta analysis snapshot ---
    previous_results_snapshot = mapped_column(JSON, nullable=True)

    # --- Multi-agent: Scenarios & Alternatives ---
    scenarios = mapped_column(JSON, nullable=True)
    optimizations = mapped_column(JSON, nullable=True)
    ai_validation_notes = mapped_column(Text, nullable=True)

    simulation = relationship("Simulation", back_populates="simulation_results")
