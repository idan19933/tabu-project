import uuid

from sqlalchemy import ForeignKey, Integer, Numeric
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CostParameter(Base):
    """All cost inputs matching the Shikun & Binui Excel spec (rows 38-66)."""
    __tablename__ = "cost_parameters"

    simulation_id = mapped_column(
        UUID(as_uuid=True), ForeignKey("simulations.id", ondelete="CASCADE"),
        primary_key=True
    )

    # Duration
    construction_duration_months = mapped_column(Integer, nullable=True)

    # Cost per sqm rates
    cost_per_sqm_residential = mapped_column(Numeric(12, 2), nullable=True)    # עלות למ"ר פלדלת מגורים
    cost_per_sqm_service = mapped_column(Numeric(12, 2), nullable=True)        # עלות למ"ר שטחי שירות
    cost_per_sqm_commercial = mapped_column(Numeric(12, 2), nullable=True)     # עלות למ"ר מסחר ותעסוקה
    cost_per_sqm_balcony = mapped_column(Numeric(12, 2), nullable=True)        # עלות למ"ר מרפסות שמש
    cost_per_sqm_development = mapped_column(Numeric(12, 2), nullable=True)    # עלות למ"ר פיתוח

    # Levies and taxes
    betterment_levy = mapped_column(Numeric(14, 2), nullable=True)             # היטל השבחה
    purchase_tax = mapped_column(Numeric(14, 2), nullable=True)                # מס רכישה

    # Professional fees
    planning_consultants = mapped_column(Numeric(14, 2), nullable=True)        # תכנון ויועצים
    permits_fees = mapped_column(Numeric(14, 2), nullable=True)                # אגרות והיטלים
    electricity_connection = mapped_column(Numeric(14, 2), nullable=True)      # חיבור חשמל
    bank_supervision = mapped_column(Numeric(14, 2), nullable=True)            # פיקוח בנקאי
    engineering_management = mapped_column(Numeric(14, 2), nullable=True)      # ניהול הנדסי
    tenant_supervision = mapped_column(Numeric(14, 2), nullable=True)          # פיקוח דיירים
    management_overhead = mapped_column(Numeric(14, 2), nullable=True)         # ניהול ותקורה
    marketing_advertising = mapped_column(Numeric(14, 2), nullable=True)       # פרסום ושיווק
    tenant_lawyer = mapped_column(Numeric(14, 2), nullable=True)               # עו"ד דיירים
    initiation_fee = mapped_column(Numeric(14, 2), nullable=True)              # דמי ייזום ארגון

    # Tenant-related costs
    rent_subsidy = mapped_column(Numeric(14, 2), nullable=True)                # שכר דירה לדירות תמורה
    evacuation_cost = mapped_column(Numeric(14, 2), nullable=True)             # פינוי דירות
    moving_cost = mapped_column(Numeric(14, 2), nullable=True)                 # הובלה

    # Other costs
    contingency = mapped_column(Numeric(14, 2), nullable=True)                 # בצ"מ
    developer_lawyer = mapped_column(Numeric(14, 2), nullable=True)            # עו"ד יזם
    demolition = mapped_column(Numeric(14, 2), nullable=True)                  # הריסה
    construction_total = mapped_column(Numeric(14, 2), nullable=True)          # בנייה (total override)
    parking_construction = mapped_column(Numeric(14, 2), nullable=True)        # עלות בנייה חניון

    # Financial
    financing_interest_rate = mapped_column(Numeric(5, 2), nullable=True)      # ריבית מימון
    vat_rate = mapped_column(Numeric(5, 2), nullable=True, default=17)         # מע"מ (default 17%)

    # Audit gap: CPI linkage
    cpi_linkage_pct = mapped_column(Numeric(5, 2), nullable=True)              # הצמדה למדד

    # Percentage-based cost fields (% of construction cost)
    planning_consultants_pct = mapped_column(Numeric(5, 2), nullable=True)     # תכנון ויועצים (%)
    permits_fees_pct = mapped_column(Numeric(5, 2), nullable=True)             # אגרות והיטלים (%)
    bank_supervision_pct = mapped_column(Numeric(5, 2), nullable=True)         # פיקוח בנקאי (%)
    engineering_management_pct = mapped_column(Numeric(5, 2), nullable=True)   # ניהול הנדסי (%)
    tenant_supervision_pct = mapped_column(Numeric(5, 2), nullable=True)       # פיקוח דיירים (%)
    management_overhead_pct = mapped_column(Numeric(5, 2), nullable=True)      # ניהול ותקורה (%)
    marketing_advertising_pct = mapped_column(Numeric(5, 2), nullable=True)    # פרסום ושיווק (%)
    tenant_lawyer_pct = mapped_column(Numeric(5, 2), nullable=True)            # עו"ד דיירים (%)
    developer_lawyer_pct = mapped_column(Numeric(5, 2), nullable=True)         # עו"ד יזם (%)
    contingency_pct = mapped_column(Numeric(5, 2), nullable=True)              # בצ"מ (%)
    initiation_fee_pct = mapped_column(Numeric(5, 2), nullable=True)           # דמי ייזום ארגון (%)

    # Data sources for traceability
    data_sources = mapped_column(JSON, nullable=True)

    # AI metadata
    ai_extraction_metadata = mapped_column(JSON, nullable=True)

    simulation = relationship("Simulation", back_populates="cost_parameters")
