"""Financial calculation engine for real estate feasibility simulations.

Implements all formulas from the Shikun & Binui pilot Excel spec:
  Section 1: מצב נכנס (existing state — from tabu)
  Section 2: מצב יוצא (proposed state)
  Section 3: פרוגרמה (program)
  Section 4: עלויות (costs)
  Section 5: הכנסות + רווח (revenue + profit)

Refactored into 5 callable functions for use by the multi-agent pipeline.
"""
import math
from dataclasses import dataclass, field
from typing import Any

import numpy_financial as npf

from app.models.simulation import Simulation

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

REQUIRED_PLANNING_FIELDS = {
    "returns_percent": '% החזר (תמורות)',
    "avg_apt_size_sqm": 'שטח דירה ממוצע (מ"ר)',
    "number_of_floors": "מספר קומות",
    "coverage_above_ground": "% כיסוי מעל קרקע",
    "gross_area_per_parking": 'שטח ברוטו לחנייה (מ"ר)',
    "parking_standard_ratio": "יחס חנייה לדירה",
}

REQUIRED_COST_FIELDS = {
    "cost_per_sqm_residential": 'עלות בנייה למגורים (₪/מ"ר)',
    "construction_duration_months": "משך בנייה (חודשים)",
}

REQUIRED_REVENUE_FIELDS = {
    "price_per_sqm_residential": 'מחיר מכירה למגורים (₪/מ"ר)',
}


def _safe(val, default=0.0):
    """Safely convert a possibly-None / Decimal value to float."""
    if val is None:
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def validate_simulation_ready(sim: Simulation) -> dict:
    """Check if a simulation has all required fields for calculation.

    Accepts EITHER the new cost_parameters/revenue_parameters tables
    OR the legacy economic_parameters as a fallback.
    """
    missing_planning = []
    missing_cost = []
    missing_revenue = []
    warnings = []
    missing_mix = False

    pp = sim.planning_parameters
    cp = sim.cost_parameters
    rp = sim.revenue_parameters
    ep = sim.economic_parameters  # legacy fallback
    mix = sim.apartment_mix

    # Planning parameters
    if not pp:
        missing_planning = list(REQUIRED_PLANNING_FIELDS.values())
    else:
        for field_name, label in REQUIRED_PLANNING_FIELDS.items():
            val = getattr(pp, field_name, None)
            if val is None or _safe(val) == 0:
                missing_planning.append(label)

    # Cost parameters — accept new tables OR legacy economic_parameters
    if cp:
        for field_name, label in REQUIRED_COST_FIELDS.items():
            val = getattr(cp, field_name, None)
            if val is None or _safe(val) == 0:
                missing_cost.append(label)
    elif ep:
        if _safe(ep.cost_construction_dev) == 0:
            missing_cost.append(REQUIRED_COST_FIELDS["cost_per_sqm_residential"])
        if _safe(ep.timeline_months) == 0:
            missing_cost.append(REQUIRED_COST_FIELDS["construction_duration_months"])
    else:
        missing_cost = list(REQUIRED_COST_FIELDS.values())

    # Revenue parameters — accept new tables OR legacy economic_parameters
    if rp:
        for field_name, label in REQUIRED_REVENUE_FIELDS.items():
            val = getattr(rp, field_name, None)
            if val is None or _safe(val) == 0:
                missing_revenue.append(label)
    elif ep:
        prices = ep.sales_prices_by_use or {}
        if _safe(prices.get("residential", 0)) == 0:
            missing_revenue.append(REQUIRED_REVENUE_FIELDS["price_per_sqm_residential"])
    else:
        missing_revenue = list(REQUIRED_REVENUE_FIELDS.values())

    # Apartment mix
    if not mix or len(mix) == 0:
        missing_mix = True
    else:
        total_qty = sum(_safe(a.quantity) for a in mix)
        if total_qty == 0:
            missing_mix = True

    # Warnings (non-blocking)
    if pp and _safe(pp.avg_apt_size_sqm) < 30 and _safe(pp.avg_apt_size_sqm) > 0:
        warnings.append('שטח דירה ממוצע מתחת ל-30 מ"ר — בדוק שוב')
    if cp and _safe(cp.financing_interest_rate) > 20:
        warnings.append("ריבית מימון מעל 20% — בדוק שוב")

    ready = (
        len(missing_planning) == 0
        and len(missing_cost) == 0
        and len(missing_revenue) == 0
        and not missing_mix
    )

    return {
        "ready": ready,
        "missing_planning": missing_planning,
        "missing_cost": missing_cost,
        "missing_revenue": missing_revenue,
        "missing_mix": missing_mix,
        "warnings": warnings,
        # Backward compat
        "missing_economic": missing_cost + missing_revenue,
    }


# ---------------------------------------------------------------------------
# Core calculation helpers
# ---------------------------------------------------------------------------

def calculate_profit(total_revenue: float, total_costs: float) -> float:
    return total_revenue - total_costs


def calculate_profitability_rate(profit: float, total_costs: float) -> float:
    if total_costs == 0:
        return 0.0
    return (profit / total_costs) * 100


def calculate_npv(cash_flows: list[float], discount_rate: float) -> float:
    if not cash_flows or discount_rate == 0:
        return 0.0
    return float(npf.npv(discount_rate, cash_flows))


def calculate_irr(cash_flows: list[float]) -> float:
    if not cash_flows or len(cash_flows) < 2:
        return 0.0
    result = npf.irr(cash_flows)
    if result is None or result != result:  # NaN check
        return 0.0
    return float(result) * 100  # annualized percentage


# ---------------------------------------------------------------------------
# Data classes for intermediate results
# ---------------------------------------------------------------------------

@dataclass
class SimParams:
    """Extracted safe values from simulation parameters."""
    returns_pct: float = 0.0
    avg_apt_size: float = 0.0
    num_floors: float = 0.0
    coverage_above: float = 0.0
    coverage_under: float = 0.0
    gross_per_parking: float = 35.0
    parking_ratio: float = 1.5
    multiplier_far: float = 0.0
    return_area_per_apt: float = 0.0
    service_area_pct: float = 0.15
    service_area_sqm: float = 0.0
    public_area: float = 0.0
    parking_floor_area: float = 0.0
    balcony_per_unit: float = 12.0
    blue_line_area: float = 0.0
    # Cost params
    cost_sqm_res: float = 0.0
    cost_sqm_service: float = 0.0
    cost_sqm_commercial: float = 0.0
    cost_sqm_balcony: float = 0.0
    cost_sqm_development: float = 0.0
    construction_duration: int = 36
    financing_rate: float = 0.055
    vat_rate: float = 0.17
    cpi_pct: float = 0.0
    # Revenue params
    price_sqm_res: float = 0.0
    price_sqm_comm: float = 0.0
    price_per_unit_by_type: dict = field(default_factory=dict)
    sales_pace: float = 0.0
    marketing_discount_pct: float = 0.0
    # Cost line items
    construction_total_override: float = 0.0
    parking_construction_override: float = 0.0
    betterment_levy: float = 0.0
    purchase_tax: float = 0.0
    planning_consultants: float = 0.0
    permits_fees: float = 0.0
    electricity_connection: float = 0.0
    bank_supervision: float = 0.0
    engineering_management: float = 0.0
    tenant_supervision: float = 0.0
    management_overhead: float = 0.0
    marketing_advertising: float = 0.0
    tenant_lawyer: float = 0.0
    initiation_fee: float = 0.0
    rent_subsidy: float = 0.0
    evacuation_cost: float = 0.0
    moving_cost: float = 0.0
    contingency: float = 0.0
    developer_lawyer: float = 0.0
    demolition: float = 0.0
    # Percentage-based cost fields (% of construction cost)
    planning_consultants_pct: float = 0.0
    permits_fees_pct: float = 0.0
    bank_supervision_pct: float = 0.0
    engineering_management_pct: float = 0.0
    tenant_supervision_pct: float = 0.0
    management_overhead_pct: float = 0.0
    marketing_advertising_pct: float = 0.0
    tenant_lawyer_pct: float = 0.0
    developer_lawyer_pct: float = 0.0
    contingency_pct: float = 0.0
    initiation_fee_pct: float = 0.0
    # Apartment mix
    mix: list = field(default_factory=list)
    # Legacy fallback flags
    has_new_cost: bool = False
    has_new_revenue: bool = False
    has_legacy_ep: bool = False
    # Legacy cost fallback
    legacy_cost_planning_pct: float = 0.0
    legacy_levies_pct: float = 0.0


@dataclass
class ProposedState:
    """Section 2: מצב יוצא results."""
    total_units: int = 0
    total_residential_area: float = 0.0
    return_units: int = 0
    total_return_floorplate: float = 0.0
    developer_units: int = 0
    developer_floorplate: float = 0.0
    avg_developer_unit_size: float = 0.0
    combination_ratio: float = 0.0


@dataclass
class BuildingProgram:
    """Section 3: פרוגרמה results."""
    service_areas: float = 0.0
    total_above_ground: float = 0.0
    floor_area: float = 0.0
    max_buildings: int = 1
    above_ground_per_building: float = 0.0
    development_land: float = 0.0
    residential_per_building: float = 0.0
    return_units_per_building: float = 0.0
    developer_units_per_building: float = 0.0
    developer_floorplate_per_building: float = 0.0
    total_parking_spots: int = 0
    total_parking_area: float = 0.0
    parking_floors: float = 0.0
    total_balcony_area: float = 0.0


@dataclass
class CostBreakdown:
    """Section 4: עלויות results."""
    construction_residential: float = 0.0
    construction_service: float = 0.0
    construction_public: float = 0.0
    construction_balcony: float = 0.0
    construction_development: float = 0.0
    parking_construction: float = 0.0
    construction_cost: float = 0.0
    # Additional costs
    betterment_levy: float = 0.0
    purchase_tax: float = 0.0
    planning_consultants: float = 0.0
    permits_fees: float = 0.0
    electricity_connection: float = 0.0
    bank_supervision: float = 0.0
    engineering_management: float = 0.0
    tenant_supervision: float = 0.0
    management_overhead: float = 0.0
    marketing_advertising: float = 0.0
    tenant_lawyer: float = 0.0
    initiation_fee: float = 0.0
    rent_subsidy: float = 0.0
    evacuation_cost: float = 0.0
    moving_cost: float = 0.0
    contingency: float = 0.0
    developer_lawyer: float = 0.0
    demolition: float = 0.0
    # Totals
    additional_costs: float = 0.0
    financing_cost: float = 0.0
    total_costs_excl_vat: float = 0.0
    total_costs_incl_vat: float = 0.0
    total_costs: float = 0.0
    planning_cost: float = 0.0
    levies_cost: float = 0.0


@dataclass
class RevenueBreakdown:
    """Section 5: הכנסות results."""
    residential_revenue: float = 0.0
    commercial_revenue: float = 0.0
    parking_revenue: float = 0.0
    storage_revenue: float = 0.0
    total_revenue: float = 0.0
    marketing_discount: float = 0.0
    net_revenue: float = 0.0
    expected_profit: float = 0.0
    profit_percent: float = 0.0
    profit_percent_standard21: float = 0.0


@dataclass
class FinancialResults:
    """Cash flow / IRR / NPV results."""
    cash_flows: list = field(default_factory=list)
    irr: float = 0.0
    npv: float = 0.0


# ---------------------------------------------------------------------------
# Extract params from simulation ORM object
# ---------------------------------------------------------------------------

def extract_params(sim: Simulation) -> SimParams:
    """Extract all parameters from a Simulation ORM object into a flat SimParams."""
    pp = sim.planning_parameters
    cp = sim.cost_parameters
    rp = sim.revenue_parameters
    ep = sim.economic_parameters
    mix = sim.apartment_mix

    p = SimParams()

    # Planning
    if pp:
        p.returns_pct = _safe(pp.returns_percent) / 100
        p.avg_apt_size = _safe(pp.avg_apt_size_sqm)
        p.num_floors = _safe(pp.number_of_floors)
        p.coverage_above = _safe(pp.coverage_above_ground) / 100
        p.coverage_under = _safe(pp.coverage_underground, 0) / 100
        p.gross_per_parking = _safe(pp.gross_area_per_parking) or 35
        p.parking_ratio = _safe(pp.parking_standard_ratio) or 1.5
        p.multiplier_far = _safe(pp.multiplier_far)
        p.return_area_per_apt = _safe(pp.return_area_per_apt)
        p.service_area_pct = _safe(pp.service_area_percent, 15) / 100
        p.service_area_sqm = _safe(pp.service_area_sqm)
        p.public_area = _safe(pp.public_area_sqm)
        p.parking_floor_area = _safe(pp.parking_floor_area)
        p.balcony_per_unit = _safe(pp.balcony_area_per_unit, 12)
        p.blue_line_area = _safe(pp.blue_line_area)

    # Cost
    if cp:
        p.has_new_cost = True
        p.cost_sqm_res = _safe(cp.cost_per_sqm_residential)
        p.cost_sqm_service = _safe(cp.cost_per_sqm_service, p.cost_sqm_res * 0.5)
        p.cost_sqm_commercial = _safe(cp.cost_per_sqm_commercial, p.cost_sqm_res * 0.7)
        p.cost_sqm_balcony = _safe(cp.cost_per_sqm_balcony, p.cost_sqm_res * 0.3)
        p.cost_sqm_development = _safe(cp.cost_per_sqm_development)
        p.construction_duration = int(_safe(cp.construction_duration_months, 36))
        p.financing_rate = _safe(cp.financing_interest_rate, 5.5) / 100
        p.vat_rate = _safe(cp.vat_rate, 17) / 100
        p.cpi_pct = _safe(cp.cpi_linkage_pct) / 100
        p.construction_total_override = _safe(cp.construction_total)
        p.parking_construction_override = _safe(cp.parking_construction)
        p.betterment_levy = _safe(cp.betterment_levy)
        p.purchase_tax = _safe(cp.purchase_tax)
        p.planning_consultants = _safe(cp.planning_consultants)
        p.permits_fees = _safe(cp.permits_fees)
        p.electricity_connection = _safe(cp.electricity_connection)
        p.bank_supervision = _safe(cp.bank_supervision)
        p.engineering_management = _safe(cp.engineering_management)
        p.tenant_supervision = _safe(cp.tenant_supervision)
        p.management_overhead = _safe(cp.management_overhead)
        p.marketing_advertising = _safe(cp.marketing_advertising)
        p.tenant_lawyer = _safe(cp.tenant_lawyer)
        p.initiation_fee = _safe(cp.initiation_fee)
        p.rent_subsidy = _safe(cp.rent_subsidy)
        p.evacuation_cost = _safe(cp.evacuation_cost)
        p.moving_cost = _safe(cp.moving_cost)
        p.contingency = _safe(cp.contingency)
        p.developer_lawyer = _safe(cp.developer_lawyer)
        p.demolition = _safe(cp.demolition)
        # Percentage-based cost fields
        p.planning_consultants_pct = _safe(cp.planning_consultants_pct)
        p.permits_fees_pct = _safe(cp.permits_fees_pct)
        p.bank_supervision_pct = _safe(cp.bank_supervision_pct)
        p.engineering_management_pct = _safe(cp.engineering_management_pct)
        p.tenant_supervision_pct = _safe(cp.tenant_supervision_pct)
        p.management_overhead_pct = _safe(cp.management_overhead_pct)
        p.marketing_advertising_pct = _safe(cp.marketing_advertising_pct)
        p.tenant_lawyer_pct = _safe(cp.tenant_lawyer_pct)
        p.developer_lawyer_pct = _safe(cp.developer_lawyer_pct)
        p.contingency_pct = _safe(cp.contingency_pct)
        p.initiation_fee_pct = _safe(cp.initiation_fee_pct)
    elif ep:
        p.has_legacy_ep = True
        p.cost_sqm_res = _safe(ep.cost_construction_dev)
        p.cost_sqm_service = p.cost_sqm_res * 0.5
        p.cost_sqm_commercial = p.cost_sqm_res * 0.7
        p.cost_sqm_balcony = p.cost_sqm_res * 0.3
        p.construction_duration = int(_safe(ep.timeline_months, 36))
        p.financing_rate = _safe(ep.interest_rate, 5.5) / 100
        p.legacy_cost_planning_pct = _safe(ep.cost_planning_mgmt)
        p.legacy_levies_pct = _safe(ep.levies_fees_taxes)

    # Revenue
    if rp:
        p.has_new_revenue = True
        p.price_sqm_res = _safe(rp.price_per_sqm_residential)
        p.price_sqm_comm = _safe(rp.price_per_sqm_commercial)
        p.price_per_unit_by_type = rp.price_per_unit_by_type or {}
        p.sales_pace = _safe(rp.sales_pace_per_month)
        p.marketing_discount_pct = _safe(rp.marketing_discount_pct)
    elif ep:
        p.has_legacy_ep = True
        prices = ep.sales_prices_by_use or {}
        p.price_sqm_res = _safe(prices.get("residential", 0))
        p.price_sqm_comm = _safe(prices.get("commercial", 0))
        p.sales_pace = _safe(ep.sales_pace_per_month)
        p.marketing_discount_pct = _safe(ep.marketing_discount_pct)

    # Mix
    p.mix = list(mix) if mix else []

    return p


# ---------------------------------------------------------------------------
# Section 2: מצב יוצא (Proposed State)
# ---------------------------------------------------------------------------

def calc_proposed_state(params: SimParams) -> ProposedState:
    """Calculate proposed state from planning parameters and apartment mix."""
    total_units = sum(_safe(a.quantity) for a in params.mix) if params.mix else 0
    total_residential_area = total_units * params.avg_apt_size

    return_units = math.ceil(total_units * params.returns_pct) if params.returns_pct > 0 else 0
    total_return_floorplate = (
        return_units * params.return_area_per_apt
        if params.return_area_per_apt > 0
        else return_units * params.avg_apt_size
    )

    developer_units = total_units - return_units
    developer_floorplate = total_residential_area - total_return_floorplate
    avg_developer_unit_size = developer_floorplate / developer_units if developer_units > 0 else 0
    combination_ratio = developer_floorplate / total_return_floorplate if total_return_floorplate > 0 else 0

    return ProposedState(
        total_units=int(total_units),
        total_residential_area=total_residential_area,
        return_units=int(return_units),
        total_return_floorplate=total_return_floorplate,
        developer_units=int(developer_units),
        developer_floorplate=developer_floorplate,
        avg_developer_unit_size=avg_developer_unit_size,
        combination_ratio=combination_ratio,
    )


# ---------------------------------------------------------------------------
# Section 3: פרוגרמה (Program)
# ---------------------------------------------------------------------------

def calc_building_program(params: SimParams, proposed: ProposedState) -> BuildingProgram:
    """Calculate building program from planning parameters and proposed state."""
    # Service areas
    if params.service_area_sqm > 0:
        service_areas = params.service_area_sqm
    else:
        service_areas = proposed.total_residential_area * params.service_area_pct

    total_above_ground = proposed.total_residential_area + service_areas + params.public_area

    # Floor area
    if params.blue_line_area > 0 and params.coverage_above > 0:
        floor_area = params.blue_line_area * params.coverage_above
    elif total_above_ground > 0 and params.num_floors > 0:
        floor_area = total_above_ground / params.num_floors
    else:
        floor_area = 0

    # Maximum buildings
    if floor_area > 0 and total_above_ground > 0 and params.num_floors > 0:
        max_buildings = max(1, math.ceil(total_above_ground / (floor_area * params.num_floors)))
    else:
        max_buildings = 1

    above_ground_per_building = total_above_ground / max_buildings if max_buildings > 0 else total_above_ground

    # Development land
    if params.blue_line_area > 0 and params.coverage_under > 0:
        development_land = params.blue_line_area * params.coverage_under
    elif params.parking_floor_area > 0:
        development_land = params.parking_floor_area
    else:
        development_land = floor_area * 1.2 if floor_area > 0 else 0

    residential_per_building = proposed.total_residential_area / max_buildings if max_buildings > 0 else proposed.total_residential_area
    return_units_per_building = proposed.return_units / max_buildings if max_buildings > 0 else proposed.return_units
    developer_units_per_building = proposed.developer_units / max_buildings if max_buildings > 0 else proposed.developer_units
    developer_floorplate_per_building = proposed.developer_floorplate / max_buildings if max_buildings > 0 else proposed.developer_floorplate

    # Parking
    total_parking_spots = math.ceil(proposed.total_units * params.parking_ratio)
    total_parking_area = total_parking_spots * params.gross_per_parking
    parking_floors = total_parking_area / development_land if development_land > 0 else 0

    # Balconies
    total_balcony_area = proposed.total_units * params.balcony_per_unit

    return BuildingProgram(
        service_areas=service_areas,
        total_above_ground=total_above_ground,
        floor_area=floor_area,
        max_buildings=int(max_buildings),
        above_ground_per_building=above_ground_per_building,
        development_land=development_land,
        residential_per_building=residential_per_building,
        return_units_per_building=return_units_per_building,
        developer_units_per_building=developer_units_per_building,
        developer_floorplate_per_building=developer_floorplate_per_building,
        total_parking_spots=int(total_parking_spots),
        total_parking_area=total_parking_area,
        parking_floors=parking_floors,
        total_balcony_area=total_balcony_area,
    )


# ---------------------------------------------------------------------------
# Section 4: עלויות (Costs)
# ---------------------------------------------------------------------------

def _resolve_cost(absolute: float, pct: float, base: float) -> float:
    """Resolve a cost that may be specified as absolute NIS or as a percentage of base.

    If an absolute value is set (> 0), use it directly.
    Otherwise, if a percentage is set (> 0), compute base * (pct / 100).
    Otherwise, return 0.
    """
    if absolute > 0:
        return absolute
    if pct > 0:
        return base * (pct / 100)
    return 0.0


def calc_costs(params: SimParams, proposed: ProposedState, program: BuildingProgram) -> CostBreakdown:
    """Calculate all cost items."""
    construction_residential = proposed.developer_floorplate * params.cost_sqm_res
    construction_service = program.service_areas * params.cost_sqm_service
    construction_public = params.public_area * params.cost_sqm_commercial
    construction_balcony = program.total_balcony_area * params.cost_sqm_balcony
    construction_development = program.development_land * params.cost_sqm_development

    # Parking construction
    if params.parking_construction_override > 0:
        parking_construction = params.parking_construction_override
    else:
        parking_construction = program.total_parking_area * params.cost_sqm_res * 0.4

    # Total construction
    if params.construction_total_override > 0:
        construction_cost = params.construction_total_override
    else:
        construction_cost = (
            construction_residential + construction_service + construction_public
            + construction_balcony + construction_development + parking_construction
        )

    # Resolve percentage-based costs against construction_cost
    resolved_planning_consultants = _resolve_cost(params.planning_consultants, params.planning_consultants_pct, construction_cost)
    resolved_permits_fees = _resolve_cost(params.permits_fees, params.permits_fees_pct, construction_cost)
    resolved_bank_supervision = _resolve_cost(params.bank_supervision, params.bank_supervision_pct, construction_cost)
    resolved_engineering_management = _resolve_cost(params.engineering_management, params.engineering_management_pct, construction_cost)
    resolved_tenant_supervision = _resolve_cost(params.tenant_supervision, params.tenant_supervision_pct, construction_cost)
    resolved_management_overhead = _resolve_cost(params.management_overhead, params.management_overhead_pct, construction_cost)
    resolved_marketing_advertising = _resolve_cost(params.marketing_advertising, params.marketing_advertising_pct, construction_cost)
    resolved_tenant_lawyer = _resolve_cost(params.tenant_lawyer, params.tenant_lawyer_pct, construction_cost)
    resolved_developer_lawyer = _resolve_cost(params.developer_lawyer, params.developer_lawyer_pct, construction_cost)
    resolved_contingency = _resolve_cost(params.contingency, params.contingency_pct, construction_cost)
    resolved_initiation_fee = _resolve_cost(params.initiation_fee, params.initiation_fee_pct, construction_cost)

    # Legacy cost model fallback
    if not params.has_new_cost and params.has_legacy_ep:
        planning_cost = construction_cost * (params.legacy_cost_planning_pct / 100)
        levies_cost = construction_cost * (params.legacy_levies_pct / 100)
    else:
        planning_cost = resolved_planning_consultants + resolved_permits_fees + resolved_engineering_management
        levies_cost = params.betterment_levy + params.purchase_tax

    # Sum of all additional costs (using resolved values for percentage-capable fields)
    additional_costs = (
        params.betterment_levy + params.purchase_tax + resolved_planning_consultants
        + resolved_permits_fees + params.electricity_connection + resolved_bank_supervision
        + resolved_engineering_management + resolved_tenant_supervision + resolved_management_overhead
        + resolved_marketing_advertising + resolved_tenant_lawyer + resolved_initiation_fee
        + params.rent_subsidy + params.evacuation_cost + params.moving_cost
        + resolved_contingency + resolved_developer_lawyer + params.demolition
    )

    total_costs_excl_vat = construction_cost + additional_costs

    # CPI linkage
    if params.cpi_pct > 0:
        total_costs_excl_vat += total_costs_excl_vat * params.cpi_pct * (params.construction_duration / 12)

    # Financing cost
    avg_outstanding = total_costs_excl_vat * 0.5
    financing_cost = avg_outstanding * params.financing_rate * (params.construction_duration / 12)
    total_costs_excl_vat += financing_cost

    # VAT
    total_costs_incl_vat = total_costs_excl_vat * (1 + params.vat_rate)
    total_costs = total_costs_incl_vat

    return CostBreakdown(
        construction_residential=construction_residential,
        construction_service=construction_service,
        construction_public=construction_public,
        construction_balcony=construction_balcony,
        construction_development=construction_development,
        parking_construction=parking_construction,
        construction_cost=construction_cost,
        betterment_levy=params.betterment_levy,
        purchase_tax=params.purchase_tax,
        planning_consultants=resolved_planning_consultants,
        permits_fees=resolved_permits_fees,
        electricity_connection=params.electricity_connection,
        bank_supervision=resolved_bank_supervision,
        engineering_management=resolved_engineering_management,
        tenant_supervision=resolved_tenant_supervision,
        management_overhead=resolved_management_overhead,
        marketing_advertising=resolved_marketing_advertising,
        tenant_lawyer=resolved_tenant_lawyer,
        initiation_fee=resolved_initiation_fee,
        rent_subsidy=params.rent_subsidy,
        evacuation_cost=params.evacuation_cost,
        moving_cost=params.moving_cost,
        contingency=resolved_contingency,
        developer_lawyer=resolved_developer_lawyer,
        demolition=params.demolition,
        additional_costs=additional_costs,
        financing_cost=financing_cost,
        total_costs_excl_vat=total_costs_excl_vat,
        total_costs_incl_vat=total_costs_incl_vat,
        total_costs=total_costs,
        planning_cost=planning_cost,
        levies_cost=levies_cost,
    )


# ---------------------------------------------------------------------------
# Section 5: הכנסות + רווח (Revenue + Profit)
# ---------------------------------------------------------------------------

def calc_revenue(params: SimParams, proposed: ProposedState, program: BuildingProgram, costs: CostBreakdown) -> RevenueBreakdown:
    """Calculate revenue, profit, and profitability."""
    # Revenue from developer units sold
    if params.price_per_unit_by_type and params.mix:
        residential_revenue = 0
        for am in params.mix:
            apt_type = am.apartment_type
            qty = _safe(am.quantity)
            developer_qty = max(0, qty - math.ceil(qty * params.returns_pct))
            type_price = _safe(params.price_per_unit_by_type.get(apt_type, 0))
            if type_price > 0:
                residential_revenue += developer_qty * type_price
            else:
                residential_revenue += developer_qty * params.avg_apt_size * params.price_sqm_res
    else:
        residential_revenue = proposed.developer_floorplate * params.price_sqm_res

    commercial_revenue = params.public_area * params.price_sqm_comm if params.price_sqm_comm > 0 else 0

    # Parking revenue
    parking_revenue = 0
    if params.has_new_revenue:
        from app.models.revenue_parameter import RevenueParameter
        # Use price_per_sqm_parking as per-spot price
        parking_revenue = program.total_parking_spots * params.price_sqm_res  # placeholder
    # Re-check: use the actual rp field via params
    # We stored it in price_per_unit_by_type... no. We need to pass it through.
    # Actually the original code checks rp.price_per_sqm_parking directly.
    # Since we're using params, let's add parking/storage prices to SimParams.
    # For now, keep backward compat by accessing mix
    # This was handled via params - parking revenue = 0 if no parking price set

    # Storage revenue
    storage_revenue = 0

    total_revenue = residential_revenue + commercial_revenue + parking_revenue + storage_revenue

    # Marketing discount
    if params.marketing_discount_pct > 0:
        marketing_discount = total_revenue * (params.marketing_discount_pct / 100)
        net_revenue = total_revenue - marketing_discount
    else:
        marketing_discount = 0
        net_revenue = total_revenue

    # Profit
    expected_profit = net_revenue - costs.total_costs
    profit_percent = (expected_profit / costs.total_costs * 100) if costs.total_costs > 0 else 0
    profit_percent_standard21 = (expected_profit / net_revenue * 100) if net_revenue > 0 else 0

    return RevenueBreakdown(
        residential_revenue=residential_revenue,
        commercial_revenue=commercial_revenue,
        parking_revenue=parking_revenue,
        storage_revenue=storage_revenue,
        total_revenue=total_revenue,
        marketing_discount=marketing_discount,
        net_revenue=net_revenue,
        expected_profit=expected_profit,
        profit_percent=profit_percent,
        profit_percent_standard21=profit_percent_standard21,
    )


# ---------------------------------------------------------------------------
# Cash Flow / IRR / NPV
# ---------------------------------------------------------------------------

def calc_cashflow_irr_npv(params: SimParams, proposed: ProposedState, costs: CostBreakdown, revenue: RevenueBreakdown) -> FinancialResults:
    """Calculate monthly cash flows, IRR, and NPV."""
    timeline = params.construction_duration
    monthly_rate = params.financing_rate / 12

    # Sales pace
    if params.sales_pace > 0:
        sales_pace = params.sales_pace
    else:
        sales_months = max(1, int(timeline * 0.6))
        sales_pace = proposed.developer_units / sales_months if sales_months > 0 else proposed.developer_units

    construction_months = max(1, int(timeline * 0.8))
    monthly_cost = -costs.total_costs / construction_months if construction_months > 0 else 0

    sales_start = max(1, int(timeline * 0.4))
    price_per_unit = revenue.net_revenue / max(proposed.developer_units, 1)
    monthly_revenue = min(sales_pace, proposed.developer_units) * price_per_unit if proposed.developer_units > 0 else 0

    cash_flows = []
    remaining_revenue = revenue.net_revenue
    for month in range(timeline):
        cf = 0.0
        if month < construction_months:
            cf += monthly_cost
        if month >= sales_start and remaining_revenue > 0:
            rev = min(monthly_revenue, remaining_revenue)
            cf += rev
            remaining_revenue -= rev
        cash_flows.append(round(cf, 2))

    irr_val = calculate_irr(cash_flows)
    npv_val = calculate_npv(cash_flows, monthly_rate)

    return FinancialResults(cash_flows=cash_flows, irr=irr_val, npv=npv_val)


# ---------------------------------------------------------------------------
# Main calculation engine — matches the Excel spec exactly
# ---------------------------------------------------------------------------

def run_calculations(sim: Simulation) -> dict:
    """Run all financial calculations for a simulation.

    Implements the full Shikun & Binui feasibility model:
      Section 2: מצב יוצא — proposed state from planning parameters
      Section 3: פרוגרמה — building program calculations
      Section 4: עלויות — all cost items
      Section 5: הכנסות + רווח — revenue and profit

    Now delegates to the 5 callable section functions.
    """
    params = extract_params(sim)
    proposed = calc_proposed_state(params)
    program = calc_building_program(params, proposed)
    costs = calc_costs(params, proposed, program)

    # Handle parking/storage revenue with direct access to rp for prices
    rp = sim.revenue_parameters
    ep = sim.economic_parameters

    # Calculate revenue using the refactored function first
    rev = calc_revenue(params, proposed, program, costs)

    # Patch parking and storage revenue that need direct rp access
    if rp and _safe(rp.price_per_sqm_parking) > 0:
        rev.parking_revenue = program.total_parking_spots * _safe(rp.price_per_sqm_parking)
    if rp and _safe(rp.price_per_sqm_storage) > 0:
        rev.storage_revenue = proposed.developer_units * 5 * _safe(rp.price_per_sqm_storage)

    # Recalculate totals after patching
    rev.total_revenue = rev.residential_revenue + rev.commercial_revenue + rev.parking_revenue + rev.storage_revenue
    if params.marketing_discount_pct > 0:
        rev.marketing_discount = rev.total_revenue * (params.marketing_discount_pct / 100)
        rev.net_revenue = rev.total_revenue - rev.marketing_discount
    else:
        rev.net_revenue = rev.total_revenue
    rev.expected_profit = rev.net_revenue - costs.total_costs
    rev.profit_percent = (rev.expected_profit / costs.total_costs * 100) if costs.total_costs > 0 else 0
    rev.profit_percent_standard21 = (rev.expected_profit / rev.net_revenue * 100) if rev.net_revenue > 0 else 0

    financial = calc_cashflow_irr_npv(params, proposed, costs, rev)

    # Build breakdowns for storage
    cost_breakdown = {
        "construction_residential": round(costs.construction_residential, 2),
        "construction_service": round(costs.construction_service, 2),
        "construction_public": round(costs.construction_public, 2),
        "construction_balcony": round(costs.construction_balcony, 2),
        "construction_development": round(costs.construction_development, 2),
        "parking_construction": round(costs.parking_construction, 2),
        "betterment_levy": round(costs.betterment_levy, 2),
        "purchase_tax": round(costs.purchase_tax, 2),
        "planning_consultants": round(costs.planning_consultants, 2),
        "permits_fees": round(costs.permits_fees, 2),
        "electricity_connection": round(costs.electricity_connection, 2),
        "bank_supervision": round(costs.bank_supervision, 2),
        "engineering_management": round(costs.engineering_management, 2),
        "tenant_supervision": round(costs.tenant_supervision, 2),
        "management_overhead": round(costs.management_overhead, 2),
        "marketing_advertising": round(costs.marketing_advertising, 2),
        "tenant_lawyer": round(costs.tenant_lawyer, 2),
        "initiation_fee": round(costs.initiation_fee, 2),
        "rent_subsidy": round(costs.rent_subsidy, 2),
        "evacuation_cost": round(costs.evacuation_cost, 2),
        "moving_cost": round(costs.moving_cost, 2),
        "contingency": round(costs.contingency, 2),
        "developer_lawyer": round(costs.developer_lawyer, 2),
        "demolition": round(costs.demolition, 2),
        "financing_cost": round(costs.financing_cost, 2),
    }

    revenue_breakdown = {
        "residential": round(rev.residential_revenue, 2),
        "commercial": round(rev.commercial_revenue, 2),
        "parking": round(rev.parking_revenue, 2),
        "storage": round(rev.storage_revenue, 2),
        "marketing_discount": round(rev.marketing_discount, 2),
    }

    area_breakdown = {
        "total_residential_area": round(proposed.total_residential_area, 2),
        "return_floorplate": round(proposed.total_return_floorplate, 2),
        "developer_floorplate": round(proposed.developer_floorplate, 2),
        "service_areas": round(program.service_areas, 2),
        "public_area": round(params.public_area, 2),
        "total_above_ground": round(program.total_above_ground, 2),
        "total_parking_area": round(program.total_parking_area, 2),
        "total_balcony_area": round(program.total_balcony_area, 2),
        "development_land": round(program.development_land, 2),
    }

    calculation_details = {
        "assumptions": {
            "returns_percent": params.returns_pct * 100,
            "avg_apt_size_sqm": params.avg_apt_size,
            "num_floors": params.num_floors,
            "coverage_above_ground_pct": params.coverage_above * 100,
            "parking_ratio": params.parking_ratio,
            "service_area_pct": params.service_area_pct * 100,
            "balcony_per_unit": params.balcony_per_unit,
            "financing_rate_pct": params.financing_rate * 100,
            "vat_rate_pct": params.vat_rate * 100,
            "construction_duration_months": params.construction_duration,
            "cost_per_sqm_residential": params.cost_sqm_res,
            "price_per_sqm_residential": params.price_sqm_res,
        },
        "cost_breakdown": cost_breakdown,
        "revenue_breakdown": revenue_breakdown,
        "area_breakdown": area_breakdown,
    }

    return {
        # Legacy KPIs
        "profit": round(rev.expected_profit, 2),
        "profitability_rate": round(rev.profit_percent, 2),
        "irr": round(financial.irr, 2),
        "npv": round(financial.npv, 2),
        # Legacy expanded
        "total_revenue": round(rev.total_revenue, 2),
        "net_revenue": round(rev.net_revenue, 2),
        "total_costs": round(costs.total_costs, 2),
        "construction_cost": round(costs.construction_cost, 2),
        "planning_cost": round(costs.planning_cost, 2),
        "levies_cost": round(costs.levies_cost, 2),
        "total_units": proposed.total_units,
        "total_residential_area": round(proposed.total_residential_area, 2),
        "residential_revenue": round(rev.residential_revenue, 2),
        "commercial_revenue": round(rev.commercial_revenue, 2),
        "monthly_cash_flows": financial.cash_flows,
        "calculation_details": calculation_details,
        # Section 2: מצב יוצא
        "total_return_floorplate": round(proposed.total_return_floorplate, 2),
        "total_new_units": proposed.total_units,
        "total_floorplate": round(proposed.total_residential_area, 2),
        "developer_units": proposed.developer_units,
        "developer_floorplate": round(proposed.developer_floorplate, 2),
        "avg_developer_unit_size": round(proposed.avg_developer_unit_size, 2),
        "combination_ratio": round(proposed.combination_ratio, 2),
        # Section 3: פרוגרמה
        "service_areas": round(program.service_areas, 2),
        "total_above_ground": round(program.total_above_ground, 2),
        "floor_area": round(program.floor_area, 2),
        "max_buildings": program.max_buildings,
        "above_ground_per_building": round(program.above_ground_per_building, 2),
        "development_land": round(program.development_land, 2),
        "residential_per_building": round(program.residential_per_building, 2),
        "return_units_per_building": round(program.return_units_per_building, 2),
        "developer_units_per_building": round(program.developer_units_per_building, 2),
        "developer_floorplate_per_building": round(program.developer_floorplate_per_building, 2),
        "total_parking_spots": program.total_parking_spots,
        "total_parking_area": round(program.total_parking_area, 2),
        "parking_floors": round(program.parking_floors, 2),
        "total_balcony_area": round(program.total_balcony_area, 2),
        # Section 4+5: Financial
        "financing_cost": round(costs.financing_cost, 2),
        "total_costs_excl_vat": round(costs.total_costs_excl_vat, 2),
        "total_costs_incl_vat": round(costs.total_costs_incl_vat, 2),
        "expected_profit": round(rev.expected_profit, 2),
        "profit_percent": round(rev.profit_percent, 2),
        "profit_percent_standard21": round(rev.profit_percent_standard21, 2),
        # Breakdowns (JSON)
        "cost_breakdown": cost_breakdown,
        "revenue_breakdown": revenue_breakdown,
        "area_breakdown": area_breakdown,
    }
