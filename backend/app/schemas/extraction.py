from pydantic import BaseModel, Field


class ExtractedTabuData(BaseModel):
    """Structured output from Tabu (land registry) document extraction."""
    block: str | None = Field(None, description="גוש")
    parcel: str | None = Field(None, description="חלקה")
    sub_parcel: str | None = Field(None, description="תת-חלקה")
    owners: list[dict] | None = Field(None, description="בעלים")
    rights: list[dict] | None = Field(None, description="זכויות")
    liens: list[dict] | None = Field(None, description="שעבודים")
    mortgages: list[dict] | None = Field(None, description="משכנתאות")
    warnings: list[str] | None = Field(None, description="הערות אזהרה")
    area_sqm: float | None = Field(None, description="שטח במ\"ר")
    address: str | None = Field(None, description="כתובת")


class ExtractedPlanningParameters(BaseModel):
    returns_percent: float | None = Field(None, description="אחוזי תשואה / החזר")
    multiplier_far: float | None = Field(None, description="מכפיל זכויות בנייה")
    avg_apt_size_sqm: float | None = Field(None, description="שטח דירה ממוצע במ\"ר")
    service_area_sqm: float | None = Field(None, description="שטח שירות במ\"ר")
    number_of_floors: int | None = Field(None, description="מספר קומות")
    coverage_above_ground: float | None = Field(None, description="אחוזי כיסוי מעל הקרקע")
    coverage_underground: float | None = Field(None, description="אחוזי כיסוי מתחת לקרקע")
    gross_area_per_parking: float | None = Field(None, description="שטח ברוטו למקום חניה")
    building_lines_notes: str | None = Field(None, description="הערות קווי בניין")
    public_tasks_notes: str | None = Field(None, description="הערות משימות ציבוריות")
    parking_standard_ratio: float | None = Field(None, description="יחס חניה תקני")
    typ_floor_area_min: float | None = Field(None, description="שטח קומה טיפוסית מינימום")
    typ_floor_area_max: float | None = Field(None, description="שטח קומה טיפוסית מקסימום")
    apts_per_floor_min: int | None = Field(None, description="דירות לקומה מינימום")
    apts_per_floor_max: int | None = Field(None, description="דירות לקומה מקסימום")
    # New fields
    return_area_per_apt: float | None = Field(None, description="שטח החזר לדירה במ\"ר")
    service_area_percent: float | None = Field(None, description="אחוז שטח שירות")
    public_area_sqm: float | None = Field(None, description="שטח ציבורי/מסחרי במ\"ר")
    parking_floor_area: float | None = Field(None, description="שטח קומת חניה במ\"ר")
    balcony_area_per_unit: float | None = Field(None, description="שטח מרפסת ליחידה במ\"ר")
    blue_line_area: float | None = Field(None, description="שטח קו כחול במ\"ר")


class ExtractedEconomicParameters(BaseModel):
    sales_prices_by_use: dict | None = Field(None, description="מחירי מכירה לפי שימוש")
    cost_construction_dev: float | None = Field(None, description="עלות בנייה ופיתוח")
    cost_planning_mgmt: float | None = Field(None, description="עלות תכנון וניהול")
    levies_fees_taxes: float | None = Field(None, description="היטלים, אגרות ומיסים")
    timeline_months: int | None = Field(None, description="לוח זמנים בחודשים")
    interest_rate: float | None = Field(None, description="שיעור ריבית")
    sales_pace_per_month: float | None = Field(None, description="קצב מכירות לחודש")
    marketing_discount_pct: float | None = Field(None, description="אחוז הנחת שיווק")


class ExtractedCostParameters(BaseModel):
    construction_duration_months: int | None = Field(None, description="משך בנייה בחודשים")
    cost_per_sqm_residential: float | None = Field(None, description="עלות בנייה מגורים למ\"ר")
    cost_per_sqm_service: float | None = Field(None, description="עלות בנייה שירות למ\"ר")
    cost_per_sqm_commercial: float | None = Field(None, description="עלות בנייה מסחרי למ\"ר")
    cost_per_sqm_balcony: float | None = Field(None, description="עלות בנייה מרפסת למ\"ר")
    cost_per_sqm_development: float | None = Field(None, description="עלות פיתוח למ\"ר")
    betterment_levy: float | None = Field(None, description="היטל השבחה")
    purchase_tax: float | None = Field(None, description="מס רכישה")
    planning_consultants: float | None = Field(None, description="תכנון ויועצים")
    permits_fees: float | None = Field(None, description="היתרים ואגרות")
    electricity_connection: float | None = Field(None, description="חיבור חשמל")
    bank_supervision: float | None = Field(None, description="פיקוח בנק")
    engineering_management: float | None = Field(None, description="ניהול הנדסי")
    tenant_supervision: float | None = Field(None, description="פיקוח דיירים")
    management_overhead: float | None = Field(None, description="הנהלה וכלליות")
    marketing_advertising: float | None = Field(None, description="שיווק ופרסום")
    tenant_lawyer: float | None = Field(None, description="עו\"ד דיירים")
    initiation_fee: float | None = Field(None, description="דמי ייזום")
    rent_subsidy: float | None = Field(None, description="סבסוד שכ\"ד")
    evacuation_cost: float | None = Field(None, description="עלות פינוי")
    moving_cost: float | None = Field(None, description="הובלות")
    contingency: float | None = Field(None, description="בלת\"מ")
    developer_lawyer: float | None = Field(None, description="עו\"ד יזם")
    demolition: float | None = Field(None, description="הריסה")
    construction_total: float | None = Field(None, description="סה\"כ עלות בנייה")
    parking_construction: float | None = Field(None, description="עלות בניית חנייה")
    financing_interest_rate: float | None = Field(None, description="ריבית מימון")
    vat_rate: float | None = Field(None, description="שיעור מע\"מ")


class ExtractedRevenueParameters(BaseModel):
    price_per_unit_by_type: dict | None = Field(None, description="מחיר ליחידה לפי סוג")
    price_per_sqm_residential: float | None = Field(None, description="מחיר מכירה מגורים למ\"ר")
    price_per_sqm_commercial: float | None = Field(None, description="מחיר מכירה מסחרי למ\"ר")


class ExtractedApartmentMix(BaseModel):
    apartment_type: str = Field(..., description="סוג דירה")
    quantity: int = Field(..., description="כמות")
    percentage_of_mix: float = Field(..., description="אחוז מהתמהיל")


class ExtractedParameters(BaseModel):
    planning: ExtractedPlanningParameters | None = None
    economic: ExtractedEconomicParameters | None = None
    cost: ExtractedCostParameters | None = None
    revenue: ExtractedRevenueParameters | None = None
    apartment_mix: list[ExtractedApartmentMix] | None = None


class AIExtractionMetadata(BaseModel):
    source_document_id: str
    extraction_model: str = "claude-sonnet-4-20250514"
    confidence_scores: dict[str, float] = {}
    source_quotes: dict[str, str] = {}
