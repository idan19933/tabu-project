from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.simulation import SimulationStatus


class SimulationCreate(BaseModel):
    version_name: str


class SimulationUpdate(BaseModel):
    version_name: str | None = None


class SimulationBrief(BaseModel):
    id: UUID
    version_name: str
    status: SimulationStatus
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Planning Parameters ---
class PlanningParameterIn(BaseModel):
    returns_percent: float | None = None
    multiplier_far: float | None = None
    avg_apt_size_sqm: float | None = None
    service_area_sqm: float | None = None
    number_of_floors: int | None = None
    coverage_above_ground: float | None = None
    coverage_underground: float | None = None
    gross_area_per_parking: float | None = None
    building_lines_notes: str | None = None
    public_tasks_notes: str | None = None
    parking_standard_ratio: float | None = None
    typ_floor_area_min: float | None = None
    typ_floor_area_max: float | None = None
    apts_per_floor_min: int | None = None
    apts_per_floor_max: int | None = None
    # New fields
    return_area_per_apt: float | None = None
    service_area_percent: float | None = None
    public_area_sqm: float | None = None
    parking_floor_area: float | None = None
    balcony_area_per_unit: float | None = None
    blue_line_area: float | None = None
    # Audit gap
    planning_stage: str | None = None


class PlanningParameterOut(PlanningParameterIn):
    ai_extraction_metadata: dict | None = None

    model_config = {"from_attributes": True}


# --- Apartment Mix ---
class ApartmentMixIn(BaseModel):
    apartment_type: str
    quantity: int
    percentage_of_mix: float


class ApartmentMixOut(ApartmentMixIn):
    id: UUID

    model_config = {"from_attributes": True}


# --- Legacy Economic Parameters (kept for backward compat) ---
class EconomicParameterIn(BaseModel):
    sales_prices_by_use: dict | None = None
    cost_construction_dev: float | None = None
    cost_planning_mgmt: float | None = None
    levies_fees_taxes: float | None = None
    timeline_months: int | None = None
    interest_rate: float | None = None
    sales_pace_per_month: float | None = None
    marketing_discount_pct: float | None = None


class EconomicParameterOut(EconomicParameterIn):
    ai_extraction_metadata: dict | None = None

    model_config = {"from_attributes": True}


# --- Cost Parameters (new spec) ---
class CostParameterIn(BaseModel):
    construction_duration_months: int | None = None
    cost_per_sqm_residential: float | None = None
    cost_per_sqm_service: float | None = None
    cost_per_sqm_commercial: float | None = None
    cost_per_sqm_balcony: float | None = None
    cost_per_sqm_development: float | None = None
    betterment_levy: float | None = None
    purchase_tax: float | None = None
    planning_consultants: float | None = None
    permits_fees: float | None = None
    electricity_connection: float | None = None
    bank_supervision: float | None = None
    engineering_management: float | None = None
    tenant_supervision: float | None = None
    management_overhead: float | None = None
    marketing_advertising: float | None = None
    tenant_lawyer: float | None = None
    initiation_fee: float | None = None
    rent_subsidy: float | None = None
    evacuation_cost: float | None = None
    moving_cost: float | None = None
    contingency: float | None = None
    developer_lawyer: float | None = None
    demolition: float | None = None
    construction_total: float | None = None
    parking_construction: float | None = None
    financing_interest_rate: float | None = None
    vat_rate: float | None = 17
    # Audit gap
    cpi_linkage_pct: float | None = None


class CostParameterOut(CostParameterIn):
    ai_extraction_metadata: dict | None = None

    model_config = {"from_attributes": True}


# --- Revenue Parameters (new spec) ---
class RevenueParameterIn(BaseModel):
    price_per_unit_by_type: dict | None = None
    price_per_sqm_residential: float | None = None
    price_per_sqm_commercial: float | None = None
    # Audit gap
    sales_pace_per_month: float | None = None
    marketing_discount_pct: float | None = None
    price_per_sqm_parking: float | None = None
    price_per_sqm_storage: float | None = None


class RevenueParameterOut(RevenueParameterIn):
    ai_extraction_metadata: dict | None = None

    model_config = {"from_attributes": True}


# --- Simulation Results ---
class SimulationResultOut(BaseModel):
    # KPIs
    profit: float | None = None
    profitability_rate: float | None = None
    irr: float | None = None
    npv: float | None = None
    # Revenue & Costs
    total_revenue: float | None = None
    net_revenue: float | None = None
    total_costs: float | None = None
    construction_cost: float | None = None
    planning_cost: float | None = None
    levies_cost: float | None = None
    total_units: int | None = None
    total_residential_area: float | None = None
    residential_revenue: float | None = None
    commercial_revenue: float | None = None
    monthly_cash_flows: list | None = None
    calculation_details: dict | None = None
    # New: מצב יוצא
    total_return_floorplate: float | None = None
    total_new_units: int | None = None
    total_floorplate: float | None = None
    developer_units: int | None = None
    developer_floorplate: float | None = None
    avg_developer_unit_size: float | None = None
    combination_ratio: float | None = None
    # New: פרוגרמה
    service_areas: float | None = None
    total_above_ground: float | None = None
    floor_area: float | None = None
    max_buildings: int | None = None
    above_ground_per_building: float | None = None
    development_land: float | None = None
    residential_per_building: float | None = None
    return_units_per_building: float | None = None
    developer_units_per_building: float | None = None
    developer_floorplate_per_building: float | None = None
    total_parking_spots: int | None = None
    total_parking_area: float | None = None
    parking_floors: float | None = None
    total_balcony_area: float | None = None
    # New: Financial
    financing_cost: float | None = None
    total_costs_excl_vat: float | None = None
    total_costs_incl_vat: float | None = None
    expected_profit: float | None = None
    profit_percent: float | None = None
    profit_percent_standard21: float | None = None
    # Breakdowns
    cost_breakdown: dict | None = None
    revenue_breakdown: dict | None = None
    area_breakdown: dict | None = None
    # Audit gap: delta snapshot
    previous_results_snapshot: dict | None = None

    model_config = {"from_attributes": True}


# --- Full Simulation Detail ---
class SimulationDetail(SimulationBrief):
    project_id: UUID
    planning_parameters: PlanningParameterOut | None = None
    apartment_mix: list[ApartmentMixOut] = []
    economic_parameters: EconomicParameterOut | None = None
    cost_parameters: CostParameterOut | None = None
    revenue_parameters: RevenueParameterOut | None = None
    simulation_results: SimulationResultOut | None = None


class SimulationFullUpdate(BaseModel):
    version_name: str | None = None
    planning_parameters: PlanningParameterIn | None = None
    apartment_mix: list[ApartmentMixIn] | None = None
    economic_parameters: EconomicParameterIn | None = None
    cost_parameters: CostParameterIn | None = None
    revenue_parameters: RevenueParameterIn | None = None


class CompareOut(BaseModel):
    simulation_a: SimulationDetail
    simulation_b: SimulationDetail
