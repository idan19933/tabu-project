"""API endpoints for the Market Research Agent.

- POST /api/projects/{project_id}/research — trigger research (or return existing)
- GET  /api/projects/{project_id}/research — get research results
- GET  /api/projects/{project_id}/research/preview/{simulation_id} — preview diff before applying
- POST /api/projects/{project_id}/simulations/{simulation_id}/apply-research — apply defaults
"""
import logging
import uuid as uuid_module

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import SessionLocal, get_db
from app.models.apartment_mix import ApartmentMix
from app.models.cost_parameter import CostParameter
from app.models.planning_parameter import PlanningParameter
from app.models.project import Project
from app.models.revenue_parameter import RevenueParameter
from app.models.simulation import Simulation

logger = logging.getLogger(__name__)

router = APIRouter()

# Fields sourced from the tabu (government land registry). These MUST NOT be
# overwritten by research data or user overrides — they are ground truth.
LOCKED_TABU_FIELDS = frozenset({
    "blue_line_area",
})

# Safety-net mapping: research agent output key → actual DB column name.
# If agent output already uses the correct name it maps to itself (identity).
# Prevents "0 שדות נמצאו" when there is a key-name mismatch.
_FIELD_MAP: dict[str, str] = {
    # Planning
    "num_floors": "number_of_floors",
    "far_multiplier": "multiplier_far",
    "avg_apt_size": "avg_apt_size_sqm",
    "coverage_percent": "coverage_above_ground",
    "parking_ratio": "parking_standard_ratio",
    "parking_gross_sqm": "gross_area_per_parking",
    "balcony_per_unit": "balcony_area_per_unit",
    "min_floor_area": "typ_floor_area_min",
    "max_floor_area": "typ_floor_area_max",
    "min_apts_per_floor": "apts_per_floor_min",
    "max_apts_per_floor": "apts_per_floor_max",
    "public_commercial_area": "public_area_sqm",
    # Cost
    "construction_residential_per_sqm": "cost_per_sqm_residential",
    "construction_service_per_sqm": "cost_per_sqm_service",
    "construction_commercial_per_sqm": "cost_per_sqm_commercial",
    "construction_balcony_per_sqm": "cost_per_sqm_balcony",
    "construction_development_per_sqm": "cost_per_sqm_development",
    "construction_parking_per_sqm": "parking_construction",
    "index_linkage": "cpi_linkage_pct",
    # Revenue
    "price_per_parking": "price_per_sqm_parking",
    "marketing_discount_percent": "marketing_discount_pct",
}


def _map_field_names(data: dict) -> dict:
    """Translate any non-standard research output keys to DB column names."""
    mapped = {}
    for k, v in data.items():
        db_col = _FIELD_MAP.get(k, k)  # use mapping or keep original
        mapped[db_col] = v
    return mapped


def _run_research_background(project_id: str, tabu_data: dict) -> None:
    """Background task that runs the market research agent."""
    db = SessionLocal()
    try:
        from app.agents.market_research_agent import run_market_research

        project = db.query(Project).filter(Project.id == uuid_module.UUID(project_id)).first()
        if not project:
            logger.error(f"Project {project_id} not found for market research")
            return

        project.market_research_status = "running"
        db.commit()

        result = run_market_research(tabu_data, project_id)

        project.market_research_data = result
        project.market_research_status = "completed"
        db.commit()
        logger.info(f"Market research completed for project {project_id}")

    except Exception as e:
        logger.error(f"Market research failed for project {project_id}: {e}")
        try:
            project = db.query(Project).filter(Project.id == uuid_module.UUID(project_id)).first()
            if project:
                project.market_research_status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/{project_id}/research")
def trigger_research(
    project_id: UUID,
    background_tasks: BackgroundTasks,
    force: bool = False,
    db: Session = Depends(get_db),
):
    """Trigger market research for a project. Returns immediately.

    Pass ?force=true to re-run even if already completed.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    if not project.tabu_data:
        raise HTTPException(400, "No tabu data found. Upload and extract tabu first.")

    # Already completed? (skip if force=true)
    if not force and project.market_research_status == "completed" and project.market_research_data:
        return {
            "status": "completed",
            "message": "Market research already completed.",
        }

    # Already running?
    if project.market_research_status == "running":
        return {
            "status": "running",
            "message": "Market research is already running...",
        }

    # Clear previous data when forcing re-run
    if force:
        logger.info(f"Force re-running research for project {project_id}")
        project.market_research_data = None

    # Trigger in background
    background_tasks.add_task(_run_research_background, str(project_id), project.tabu_data)

    project.market_research_status = "running"
    db.commit()

    return {"status": "started", "message": "Market research agent is running..."}


@router.get("/{project_id}/research")
def get_research(project_id: UUID, db: Session = Depends(get_db)):
    """Get market research results for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    if not project.market_research_data:
        return {
            "status": project.market_research_status or "not_started",
            "data": None,
        }

    data = project.market_research_data
    return {
        "status": project.market_research_status or "completed",
        "data": data,
        "summary": data.get("research_summary"),
        "planning": data.get("planning_parameters"),
        "costs": data.get("cost_parameters"),
        "revenue": data.get("revenue_parameters"),
        "mix": data.get("apartment_mix"),
    }


_FIELD_LABELS = {
    # Planning
    "returns_percent": ("תכנון", "% החזר"),
    "avg_apt_size_sqm": ("תכנון", 'שטח דירה ממוצע (מ"ר)'),
    "number_of_floors": ("תכנון", "מספר קומות"),
    "coverage_above_ground": ("תכנון", "% כיסוי מעל קרקע"),
    "coverage_underground": ("תכנון", "% כיסוי מתחת קרקע"),
    "multiplier_far": ("תכנון", "מכפיל זכויות"),
    "blue_line_area": ("תכנון", 'שטח קו כחול (מ"ר)'),
    "parking_standard_ratio": ("תכנון", "יחס חנייה"),
    "gross_area_per_parking": ("תכנון", 'שטח ברוטו לחנייה (מ"ר)'),
    "service_area_percent": ("תכנון", "% שטחי שירות"),
    "balcony_area_per_unit": ("תכנון", 'מרפסת ליחידה (מ"ר)'),
    # Cost — absolute
    "cost_per_sqm_residential": ("עלויות", 'עלות בנייה למ"ר מגורים'),
    "cost_per_sqm_service": ("עלויות", 'עלות בנייה למ"ר שירות'),
    "cost_per_sqm_commercial": ("עלויות", 'עלות בנייה למ"ר מסחר'),
    "cost_per_sqm_balcony": ("עלויות", 'עלות בנייה למ"ר מרפסות'),
    "cost_per_sqm_development": ("עלויות", 'עלות פיתוח למ"ר'),
    "betterment_levy": ("עלויות", "היטל השבחה"),
    "purchase_tax": ("עלויות", "מס רכישה"),
    "electricity_connection": ("עלויות", "חיבור חשמל"),
    "rent_subsidy": ("עלויות", "שכ\"ד דירות תמורה"),
    "evacuation_cost": ("עלויות", "פינוי דירות"),
    "moving_cost": ("עלויות", "הובלה"),
    "demolition": ("עלויות", "הריסה"),
    "parking_construction": ("עלויות", "בניית חניון"),
    # Cost — percentage
    "planning_consultants_pct": ("עלויות", "תכנון ויועצים (%)"),
    "permits_fees_pct": ("עלויות", "אגרות והיטלים (%)"),
    "bank_supervision_pct": ("עלויות", "פיקוח בנקאי (%)"),
    "engineering_management_pct": ("עלויות", "ניהול הנדסי (%)"),
    "tenant_supervision_pct": ("עלויות", "פיקוח דיירים (%)"),
    "management_overhead_pct": ("עלויות", "ניהול ותקורה (%)"),
    "marketing_advertising_pct": ("עלויות", "פרסום ושיווק (%)"),
    "tenant_lawyer_pct": ("עלויות", 'עו"ד דיירים (%)'),
    "developer_lawyer_pct": ("עלויות", 'עו"ד יזם (%)'),
    "contingency_pct": ("עלויות", 'בצ"מ (%)'),
    "initiation_fee_pct": ("עלויות", "דמי ייזום (%)"),
    "construction_duration_months": ("עלויות", "משך בנייה (חודשים)"),
    "financing_interest_rate": ("עלויות", "ריבית מימון"),
    "cpi_linkage_pct": ("עלויות", "הצמדה למדד (%)"),
    # Revenue
    "price_per_sqm_residential": ("הכנסות", 'מחיר מכירה מגורים (₪/מ"ר)'),
    "price_per_sqm_commercial": ("הכנסות", 'מחיר מכירה מסחר (₪/מ"ר)'),
    "price_per_sqm_parking": ("הכנסות", "מחיר חנייה (₪)"),
    "price_per_sqm_storage": ("הכנסות", "מחיר מחסן (₪)"),
    "sales_pace_per_month": ("הכנסות", "קצב מכירות (יח׳/חודש)"),
    "marketing_discount_pct": ("הכנסות", "הנחת שיווק (%)"),
}


def _get_current_value(sim, field: str):
    """Get the current value of a parameter field from the simulation."""
    pp = sim.planning_parameters
    cp = sim.cost_parameters
    rp = sim.revenue_parameters

    planning_attrs = {
        "returns_percent", "avg_apt_size_sqm", "number_of_floors",
        "coverage_above_ground", "coverage_underground", "multiplier_far",
        "blue_line_area", "parking_standard_ratio", "gross_area_per_parking",
        "service_area_percent", "balcony_area_per_unit", "service_area_sqm",
        "public_area_sqm", "parking_floor_area", "return_area_per_apt",
    }
    revenue_attrs = {
        "price_per_sqm_residential", "price_per_sqm_commercial",
        "price_per_sqm_parking", "price_per_sqm_storage",
        "sales_pace_per_month", "marketing_discount_pct",
    }

    if field in planning_attrs and pp:
        return getattr(pp, field, None)
    elif field in revenue_attrs and rp:
        return getattr(rp, field, None)
    elif cp and hasattr(cp, field):
        return getattr(cp, field, None)
    return None


@router.get("/{project_id}/research/preview/{simulation_id}")
def preview_research(
    project_id: UUID,
    simulation_id: UUID,
    db: Session = Depends(get_db),
):
    """Preview research data diff before applying to a simulation."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    if not project.market_research_data:
        raise HTTPException(404, "No research data found. Trigger research first.")

    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(404, "Simulation not found")

    research = project.market_research_data
    data_sources = research.get("data_sources", {})

    # Collect all proposed fields from research (mapped through safety-net)
    sections = {
        "planning_parameters": _map_field_names(research.get("planning_parameters", {})),
        "cost_parameters": _map_field_names(research.get("cost_parameters", {})),
        "revenue_parameters": _map_field_names(research.get("revenue_parameters", {})),
    }

    # Skip non-parameter keys
    skip_keys = {"data_sources", "ai_extraction_metadata", "vat_rate", "_locked_from_tabu", "_metadata"}

    fields = []
    for section_key, section_data in sections.items():
        for field_name, proposed_value in section_data.items():
            if field_name in skip_keys or proposed_value is None:
                continue
            if not isinstance(proposed_value, (int, float)):
                continue

            current = _get_current_value(sim, field_name)
            current_val = float(current) if current is not None else None
            proposed_val = float(proposed_value)

            label_info = _FIELD_LABELS.get(field_name, (section_key.replace("_parameters", ""), field_name))
            section_he = label_info[0]
            label_he = label_info[1]

            is_locked = field_name in LOCKED_TABU_FIELDS
            will_fill = (not is_locked) and (current_val is None or current_val == 0)
            differs = (not is_locked) and (current_val != proposed_val)
            is_pct = field_name.endswith("_pct") and field_name != "cpi_linkage_pct"

            fields.append({
                "field": field_name,
                "section": section_he,
                "label_he": label_he,
                "current": current_val,
                "proposed": proposed_val,
                "will_change": will_fill,  # backward compat: True if currently empty
                "differs": differs,  # True if proposed != current
                "is_pct": is_pct,
                "is_locked": is_locked,
            })

    # Group by section
    grouped = {}
    for f in fields:
        section = f["section"]
        if section not in grouped:
            grouped[section] = []
        grouped[section].append(f)

    # Summary
    total_fields = len(fields)
    will_change_count = sum(1 for f in fields if f["will_change"])
    differs_count = sum(1 for f in fields if f.get("differs"))

    # Collect validation fixes and confidence from metadata
    research_summary = research.get("research_summary", {}) or {}
    metadata = research.get("_metadata", {}) or {}
    validation_fixes = research_summary.get("validation_fixes", [])
    confidence = metadata.get("confidence", {})

    return {
        "fields": fields,
        "grouped": grouped,
        "summary": {
            "total_fields": total_fields,
            "will_change": will_change_count,
            "differs": differs_count,
            "will_keep": total_fields - will_change_count,
            "locked_count": sum(1 for f in fields if f.get("is_locked")),
        },
        "data_sources": data_sources,
        "research_summary": research_summary,
        "apartment_mix": research.get("apartment_mix"),
        "validation_fixes": validation_fixes,
        "confidence": confidence,
    }


@router.post("/{project_id}/simulations/{simulation_id}/apply-research")
def apply_research_to_simulation(
    project_id: UUID,
    simulation_id: UUID,
    overwrite: bool = False,
    overrides: dict = Body(default={}),
    db: Session = Depends(get_db),
):
    """Apply market research defaults to a specific simulation.

    By default uses MERGE strategy: only fills fields that are currently null/0.
    Pass ?overwrite=true to replace ALL values (not just empty ones).
    Accepts optional overrides dict to override specific research values.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    if not project.market_research_data:
        raise HTTPException(404, "No research data found. Trigger research first.")

    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(404, "Simulation not found")

    research = project.market_research_data

    # Map field names through safety-net mapping (handles any agent output key mismatches)
    planning_data = _map_field_names(research.get("planning_parameters", {}))
    cost_data = _map_field_names(research.get("cost_parameters", {}))
    revenue_data = _map_field_names(research.get("revenue_parameters", {}))
    mix_data = research.get("apartment_mix", [])

    # Get real tabu values for locked field enforcement
    tabu = project.tabu_data or {}
    tabu_locked_values = {
        "blue_line_area": tabu.get("shared_area_sqm") or tabu.get("area_sqm"),
    }

    # Strip locked tabu fields from research data AND overrides
    for locked_field in LOCKED_TABU_FIELDS:
        planning_data.pop(locked_field, None)
        cost_data.pop(locked_field, None)
        revenue_data.pop(locked_field, None)
        if overrides:
            overrides.pop(locked_field, None)

    # Apply user overrides (overrides win over research values), also mapped
    if overrides:
        mapped_overrides = _map_field_names(overrides)
        for k, v in mapped_overrides.items():
            if k in LOCKED_TABU_FIELDS:
                continue  # double safety
            if k in planning_data or k.startswith(("returns_", "avg_", "number_", "coverage_", "multiplier_", "blue_line_", "parking_standard_", "gross_area_", "service_area_", "balcony_", "return_area_", "public_area_")):
                planning_data[k] = v
            elif k.startswith("price_") or k in ("sales_pace_per_month", "marketing_discount_pct"):
                revenue_data[k] = v
            else:
                cost_data[k] = v

    counts = {"planning": 0, "costs": 0, "revenue": 0, "mix": 0}

    # --- Apply planning parameters (merge or overwrite) ---
    if planning_data:
        existing = db.query(PlanningParameter).filter(
            PlanningParameter.simulation_id == sim.id
        ).first()

        if existing:
            for k, v in planning_data.items():
                if v is not None and hasattr(existing, k):
                    current = getattr(existing, k, None)
                    if overwrite or current is None or current == 0 or current == 0.0:
                        setattr(existing, k, v)
                        counts["planning"] += 1
        else:
            # Create new with defaults for NOT NULL columns
            defaults = {
                "returns_percent": 0, "multiplier_far": 0, "avg_apt_size_sqm": 0,
                "service_area_sqm": 0, "number_of_floors": 0, "coverage_above_ground": 0,
                "coverage_underground": 0, "gross_area_per_parking": 0,
                "parking_standard_ratio": 0, "typ_floor_area_min": 0,
                "typ_floor_area_max": 0, "apts_per_floor_min": 0, "apts_per_floor_max": 0,
            }
            for k, v in planning_data.items():
                if v is not None:
                    defaults[k] = v
                    counts["planning"] += 1
            defaults["ai_extraction_metadata"] = {"source": "market_research_agent"}
            db.add(PlanningParameter(simulation_id=sim.id, **defaults))

    # --- Apply cost parameters (merge or overwrite) ---
    if cost_data:
        existing = db.query(CostParameter).filter(
            CostParameter.simulation_id == sim.id
        ).first()

        if existing:
            for k, v in cost_data.items():
                if v is not None and hasattr(existing, k):
                    current = getattr(existing, k, None)
                    if overwrite or current is None or current == 0 or current == 0.0:
                        setattr(existing, k, v)
                        counts["costs"] += 1
        else:
            clean = {}
            for k, v in cost_data.items():
                if v is not None:
                    clean[k] = v
                    counts["costs"] += 1
            clean["ai_extraction_metadata"] = {"source": "market_research_agent"}
            db.add(CostParameter(simulation_id=sim.id, **clean))

    # --- Apply revenue parameters (merge or overwrite) ---
    if revenue_data:
        existing = db.query(RevenueParameter).filter(
            RevenueParameter.simulation_id == sim.id
        ).first()

        if existing:
            for k, v in revenue_data.items():
                if v is not None and hasattr(existing, k):
                    if k == "price_per_unit_by_type":
                        current = getattr(existing, k, None)
                        if overwrite or not current or current == {}:
                            setattr(existing, k, v)
                            counts["revenue"] += 1
                    else:
                        current = getattr(existing, k, None)
                        if overwrite or current is None or current == 0 or current == 0.0:
                            setattr(existing, k, v)
                            counts["revenue"] += 1
        else:
            clean = {}
            for k, v in revenue_data.items():
                if v is not None:
                    clean[k] = v
                    counts["revenue"] += 1
            clean["ai_extraction_metadata"] = {"source": "market_research_agent"}
            db.add(RevenueParameter(simulation_id=sim.id, **clean))

    # --- Apply apartment mix (only if empty, or overwrite) ---
    if mix_data:
        existing_count = db.query(ApartmentMix).filter(
            ApartmentMix.simulation_id == sim.id
        ).count()

        if overwrite and existing_count > 0:
            db.query(ApartmentMix).filter(
                ApartmentMix.simulation_id == sim.id
            ).delete()
            existing_count = 0
            logger.info(f"Overwrite mode: deleted {existing_count} existing mix items")

        if existing_count == 0:
            for item in mix_data:
                db.add(ApartmentMix(
                    simulation_id=sim.id,
                    apartment_type=item.get("apartment_type", "unknown"),
                    quantity=item.get("quantity", 0),
                    percentage_of_mix=item.get("percentage_of_mix", 0),
                ))
                counts["mix"] += 1

    # --- ENFORCE tabu locked values (CRITICAL — overwrite whatever is there) ---
    pp = db.query(PlanningParameter).filter(
        PlanningParameter.simulation_id == sim.id
    ).first()
    if pp:
        for field, tabu_val in tabu_locked_values.items():
            if tabu_val is not None and hasattr(pp, field):
                current = getattr(pp, field, None)
                if current != tabu_val:
                    logger.info(f"LOCKED {field}: enforcing tabu={tabu_val} (was {current})")
                    setattr(pp, field, tabu_val)

    db.commit()

    total = counts["planning"] + counts["costs"] + counts["revenue"] + counts["mix"]
    return {
        "status": "applied",
        "message": f"Applied {total} fields from market research",
        "fields_populated": counts,
        "locked_from_tabu": {k: v for k, v in tabu_locked_values.items() if v is not None},
    }
