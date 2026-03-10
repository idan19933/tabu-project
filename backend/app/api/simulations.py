import asyncio
import json
import logging
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse as SSEStreamingResponse

from app.database import get_db
from app.models.simulation import SimulationStatus
from app.schemas.simulation import CompareOut, SimulationDetail, SimulationFullUpdate
from app.services import simulation_service
from app.utils.field_labels import FIELD_LABELS

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{sim_id}", response_model=SimulationDetail)
def get_simulation(sim_id: UUID, db: Session = Depends(get_db)):
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")
    return sim


@router.put("/{sim_id}", response_model=SimulationDetail)
def update_simulation(sim_id: UUID, body: SimulationFullUpdate, db: Session = Depends(get_db)):
    """Update simulation — allows partial data, always works (no validation on save).

    Upserts planning_parameters and economic_parameters if they don't exist.
    """
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")
    return simulation_service.update_full(
        db,
        sim,
        version_name=body.version_name,
        planning=body.planning_parameters.model_dump() if body.planning_parameters else None,
        apartment_mix_list=[a.model_dump() for a in body.apartment_mix] if body.apartment_mix is not None else None,
        economic=body.economic_parameters.model_dump() if body.economic_parameters else None,
        cost=body.cost_parameters.model_dump() if body.cost_parameters else None,
        revenue=body.revenue_parameters.model_dump() if body.revenue_parameters else None,
    )


@router.post("/{sim_id}/clone", response_model=SimulationDetail, status_code=201)
def clone_simulation(sim_id: UUID, db: Session = Depends(get_db)):
    """Clone a simulation with deep-copy of all parameters."""
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")
    return simulation_service.clone(db, sim)


@router.get("/{sim_id}/review", response_model=SimulationDetail)
def review_simulation(sim_id: UUID, db: Session = Depends(get_db)):
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")
    return sim


@router.put("/{sim_id}/approve", response_model=SimulationDetail)
def approve_simulation(sim_id: UUID, db: Session = Depends(get_db)):
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")
    # Already approved or completed — no-op, just return current state
    if sim.status in (SimulationStatus.APPROVED_FOR_CALC, SimulationStatus.COMPLETED):
        return sim
    if sim.status not in (SimulationStatus.PENDING_REVIEW, SimulationStatus.DRAFT, SimulationStatus.AI_EXTRACTING):
        raise HTTPException(400, f"Cannot approve simulation in status {sim.status.value}")
    simulation_service.set_status(db, sim, SimulationStatus.APPROVED_FOR_CALC)
    return simulation_service.get_by_id(db, sim.id)


@router.get("/{sim_id}/validation")
def validate_simulation(sim_id: UUID, db: Session = Depends(get_db)):
    """Check if simulation has all required fields for calculation."""
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")
    from app.services.calculation_service import validate_simulation_ready
    return validate_simulation_ready(sim)


@router.post("/{sim_id}/calculate", response_model=SimulationDetail)
def calculate_simulation(sim_id: UUID, db: Session = Depends(get_db)):
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")

    # Allow calculation from more statuses (user may have edited after approve)
    if sim.status not in (
        SimulationStatus.APPROVED_FOR_CALC,
        SimulationStatus.PENDING_REVIEW,
        SimulationStatus.COMPLETED,  # allow recalculation
    ):
        raise HTTPException(400, f"Cannot calculate simulation in status {sim.status.value}")

    # Validate all required fields are present
    from app.services.calculation_service import validate_simulation_ready
    validation = validate_simulation_ready(sim)
    if not validation["ready"]:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "MISSING_FIELDS",
                "message": "חסרים שדות נדרשים לחישוב",
                "validation": validation,
            },
        )

    try:
        from app.agents.financial_agent import run_agentic_calculation
        results = run_agentic_calculation(sim)
        simulation_service.save_results(db, sim, **results)
        simulation_service.set_status(db, sim, SimulationStatus.COMPLETED)
        return simulation_service.get_by_id(db, sim.id)
    except Exception as e:
        import traceback
        logger.error(f"Calculation error: {traceback.format_exc()}")
        raise HTTPException(500, detail=f"Calculation error: {str(e)}")


@router.get("/{sim_id}/report/management")
def download_management_report(sim_id: UUID, db: Session = Depends(get_db)):
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")
    if not sim.simulation_results:
        raise HTTPException(400, "אין תוצאות לסימולציה — יש להריץ חישוב קודם")

    from app.services.report_service import generate_management_report
    buf = generate_management_report(sim)
    safe_name = f"management_report_{sim.id}.xlsx"
    utf8_name = f"management_report_{sim.version_name}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=\"{safe_name}\"; filename*=UTF-8''{quote(utf8_name)}"
        },
    )


@router.get("/{sim_id}/report/economic")
def download_economic_report(sim_id: UUID, db: Session = Depends(get_db)):
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")
    if not sim.simulation_results:
        raise HTTPException(400, "אין תוצאות לסימולציה — יש להריץ חישוב קודם")

    from app.services.report_service import generate_economic_report
    buf = generate_economic_report(sim)
    safe_name = f"economic_report_{sim.id}.xlsx"
    utf8_name = f"economic_report_{sim.version_name}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=\"{safe_name}\"; filename*=UTF-8''{quote(utf8_name)}"
        },
    )


@router.get("/{sim_id}/calculation-details")
def get_calculation_details(sim_id: UUID, db: Session = Depends(get_db)):
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")
    if not sim.simulation_results:
        raise HTTPException(400, "אין תוצאות לסימולציה")

    from app.models.simulation_result import SimulationResult
    r = sim.simulation_results
    result = {}
    for col in SimulationResult.__table__.columns:
        if col.name == "simulation_id":
            continue
        val = getattr(r, col.name, None)
        if val is not None:
            # Convert Decimal to float for JSON serialization
            try:
                result[col.name] = float(val)
            except (TypeError, ValueError):
                result[col.name] = val
        else:
            result[col.name] = None
    return result


@router.get("/{sim_id}/delta")
def get_delta_analysis(sim_id: UUID, db: Session = Depends(get_db)):
    """Compare current results with previous results snapshot."""
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")
    if not sim.simulation_results:
        raise HTTPException(400, "אין תוצאות לסימולציה")

    snapshot = sim.simulation_results.previous_results_snapshot
    if not snapshot:
        return {"has_delta": False, "deltas": {}}

    kpi_fields = [
        "profit", "expected_profit", "profitability_rate", "profit_percent",
        "irr", "npv", "total_revenue", "net_revenue", "total_costs",
        "total_costs_incl_vat", "total_costs_excl_vat",
    ]
    deltas = {}
    for field in kpi_fields:
        before = snapshot.get(field)
        after_val = getattr(sim.simulation_results, field, None)
        if before is None or after_val is None:
            continue
        try:
            before = float(before)
            after = float(after_val)
        except (TypeError, ValueError):
            continue
        change = after - before
        change_pct = (change / abs(before) * 100) if before != 0 else 0
        deltas[field] = {
            "before": round(before, 2),
            "after": round(after, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
        }
    return {"has_delta": True, "deltas": deltas}


@router.get("/{sim_id}/sensitivity")
def get_parameter_sensitivity(sim_id: UUID, db: Session = Depends(get_db)):
    """Run per-parameter sensitivity analysis."""
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")
    if not sim.simulation_results:
        raise HTTPException(400, "אין תוצאות — יש להריץ חישוב קודם")

    from app.services.sensitivity_service import run_parameter_sensitivity
    try:
        result = run_parameter_sensitivity(sim)
        return result
    except Exception as e:
        raise HTTPException(500, detail=f"Sensitivity analysis error: {str(e)}")


@router.get("/{sim_id1}/compare/{sim_id2}", response_model=CompareOut)
def compare_simulations(sim_id1: UUID, sim_id2: UUID, db: Session = Depends(get_db)):
    sim_a = simulation_service.get_by_id(db, sim_id1)
    sim_b = simulation_service.get_by_id(db, sim_id2)
    if not sim_a or not sim_b:
        raise HTTPException(404, "One or both simulations not found")
    return CompareOut(simulation_a=sim_a, simulation_b=sim_b)


# ---------------------------------------------------------------------------
# Multi-Agent Pipeline Endpoints
# ---------------------------------------------------------------------------

@router.post("/{sim_id}/run-pipeline")
def run_pipeline(sim_id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Trigger the full agent orchestrator pipeline."""
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")

    from app.agents.orchestrator import run_pipeline as orchestrator_run
    background_tasks.add_task(orchestrator_run, str(sim_id))

    return {"status": "pipeline_started", "simulation_id": str(sim_id)}


@router.get("/{sim_id}/agent-stream")
async def agent_stream(sim_id: UUID, db: Session = Depends(get_db)):
    """SSE endpoint for real-time agent progress updates."""
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")

    from app.agents.orchestrator import get_agent_events

    async def event_generator():
        event_index = 0
        while True:
            events = get_agent_events(str(sim_id), after=event_index)
            for event in events:
                data = json.dumps(event, default=str)
                yield f"event: agent_update\ndata: {data}\n\n"
                event_index += 1

                # Check if pipeline is done
                full_status = event.get("full_status", {})
                all_done = all(
                    s.get("status") in ("completed", "error", "skipped")
                    for s in full_status.values()
                    if isinstance(s, dict)
                )
                if all_done and len(full_status) >= 4:
                    done_data = json.dumps(full_status, default=str)
                    yield f"event: pipeline_complete\ndata: {done_data}\n\n"
                    return

            await asyncio.sleep(1)

    return SSEStreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.get("/{sim_id}/missing-fields")
def get_missing_fields(sim_id: UUID, db: Session = Depends(get_db)):
    """Return which required fields are still null/zero."""
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")

    from app.services.calculation_service import validate_simulation_ready
    validation = validate_simulation_ready(sim)

    return {
        "ready": validation["ready"],
        "missing_planning": validation["missing_planning"],
        "missing_cost": validation["missing_cost"],
        "missing_revenue": validation["missing_revenue"],
        "missing_mix": validation["missing_mix"],
        "warnings": validation["warnings"],
    }


@router.get("/{sim_id}/alternatives")
def get_alternatives(sim_id: UUID, db: Session = Depends(get_db)):
    """Return scenarios and optimization suggestions."""
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")
    if not sim.simulation_results:
        raise HTTPException(400, "אין תוצאות — יש להריץ חישוב קודם")

    return {
        "scenarios": sim.simulation_results.scenarios,
        "optimizations": sim.simulation_results.optimizations,
        "ai_validation_notes": sim.simulation_results.ai_validation_notes,
    }


@router.get("/{sim_id}/agent-status")
def get_agent_status(sim_id: UUID, db: Session = Depends(get_db)):
    """Return current agent pipeline status."""
    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")
    return sim.agent_status or {}


# ---------------------------------------------------------------------------
# Data Sources & Provenance
# ---------------------------------------------------------------------------

def _infer_provenance(field: str) -> dict:
    """Backward-compat: guess source for old simulations that lack _field_provenance."""
    if field == "blue_line_area":
        return {"source": "tabu", "step": "locked", "detail": "נסח טאבו — שטח קו כחול"}
    if field.endswith("_pct") or field in (
        "vat_rate", "cpi_linkage_pct", "service_area_percent",
        "gross_area_per_parking", "balcony_area_per_unit",
        "purchase_tax", "parking_construction",
    ):
        return {"source": "default", "step": "step5_parameters", "detail": "ברירת מחדל תעשייתית"}
    if field.startswith("price_per_sqm_"):
        return {"source": "market_research", "step": "step4_prices", "detail": "מחקר שוק — מחירי מכירה"}
    if field.startswith("cost_per_sqm_"):
        return {"source": "market_research", "step": "step3_costs", "detail": "מחקר שוק — עלויות בנייה"}
    if field in ("number_of_floors", "coverage_above_ground", "coverage_underground"):
        return {"source": "market_research", "step": "step2_zoning", "detail": "מחקר תב״ע"}
    if field in ("betterment_levy", "demolition", "financing_interest_rate"):
        return {"source": "market_research", "step": "step3_costs", "detail": "מחקר שוק"}
    # Everything else is likely calculated
    return {"source": "calculated", "step": "step5_parameters", "detail": "חישוב אוטומטי"}


@router.get("/{sim_id}/data-sources")
def get_data_sources(sim_id: UUID, db: Session = Depends(get_db)):
    """Return provenance information for every field in the simulation."""
    from app.models.cost_parameter import CostParameter
    from app.models.planning_parameter import PlanningParameter
    from app.models.project import Project
    from app.models.revenue_parameter import RevenueParameter

    sim = simulation_service.get_by_id(db, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")

    project = db.query(Project).filter(Project.id == sim.project_id).first()
    research = (project.market_research_data or {}) if project else {}

    # Collect provenance from multiple sources (prefer stored metadata, fallback to research, then infer)
    research_provenance = research.get("_field_provenance", {})

    pp = sim.planning_parameters
    cp = sim.cost_parameters
    rp = sim.revenue_parameters

    pp_meta = (getattr(pp, "ai_extraction_metadata", None) or {}) if pp else {}
    cp_meta = (getattr(cp, "ai_extraction_metadata", None) or {}) if cp else {}
    rp_meta = (getattr(rp, "ai_extraction_metadata", None) or {}) if rp else {}

    stored_provenance = {
        **pp_meta.get("field_provenance", {}),
        **cp_meta.get("field_provenance", {}),
        **rp_meta.get("field_provenance", {}),
    }

    # Skip non-parameter keys
    skip_keys = {
        "data_sources", "ai_extraction_metadata", "_locked_from_tabu", "_metadata",
        "planning_stage", "building_lines_notes", "public_tasks_notes",
        "price_per_unit_by_type", "simulation_id", "id",
    }

    fields = []

    # Collect fields from planning parameters
    if pp:
        for col in pp.__table__.columns:
            name = col.name
            if name in skip_keys or name == "simulation_id":
                continue
            val = getattr(pp, name, None)
            if val is None or (isinstance(val, (int, float)) and val == 0):
                continue
            if not isinstance(val, (int, float)):
                continue
            label_info = FIELD_LABELS.get(name, ("תכנון", name))
            prov = stored_provenance.get(name) or research_provenance.get(name) or _infer_provenance(name)
            fields.append({
                "field": name,
                "section": label_info[0],
                "label_he": label_info[1],
                "value": float(val),
                "source_type": prov.get("source", "unknown"),
                "source_step": prov.get("step", ""),
                "source_detail": prov.get("detail", ""),
            })

    # Collect fields from cost parameters
    if cp:
        for col in cp.__table__.columns:
            name = col.name
            if name in skip_keys or name == "simulation_id":
                continue
            val = getattr(cp, name, None)
            if val is None or (isinstance(val, (int, float)) and val == 0):
                continue
            if not isinstance(val, (int, float)):
                continue
            label_info = FIELD_LABELS.get(name, ("עלויות", name))
            prov = stored_provenance.get(name) or research_provenance.get(name) or _infer_provenance(name)
            fields.append({
                "field": name,
                "section": label_info[0],
                "label_he": label_info[1],
                "value": float(val),
                "source_type": prov.get("source", "unknown"),
                "source_step": prov.get("step", ""),
                "source_detail": prov.get("detail", ""),
            })

    # Collect fields from revenue parameters
    if rp:
        for col in rp.__table__.columns:
            name = col.name
            if name in skip_keys or name == "simulation_id":
                continue
            val = getattr(rp, name, None)
            if val is None or (isinstance(val, (int, float)) and val == 0):
                continue
            if not isinstance(val, (int, float)):
                continue
            label_info = FIELD_LABELS.get(name, ("הכנסות", name))
            prov = stored_provenance.get(name) or research_provenance.get(name) or _infer_provenance(name)
            fields.append({
                "field": name,
                "section": label_info[0],
                "label_he": label_info[1],
                "value": float(val),
                "source_type": prov.get("source", "unknown"),
                "source_step": prov.get("step", ""),
                "source_detail": prov.get("detail", ""),
            })

    # Add key result fields as "calculated"
    r = sim.simulation_results
    if r:
        result_fields = [
            ("profit", "expected_profit"), ("profitability_rate", "profit_percent"),
            ("irr",), ("npv",), ("total_costs",), ("total_revenue",),
        ]
        for names in result_fields:
            for name in names:
                val = getattr(r, name, None)
                if val is not None:
                    label_info = FIELD_LABELS.get(name, ("תוצאות", name))
                    fields.append({
                        "field": name,
                        "section": "תוצאות",
                        "label_he": label_info[1],
                        "value": float(val),
                        "source_type": "calculated",
                        "source_step": "calculation_engine",
                        "source_detail": "מנוע חישוב — מודל שיכון ובינוי",
                    })
                    break  # Take the first non-null alias

    # Group by source_type
    grouped: dict[str, list] = {}
    for f in fields:
        st = f["source_type"]
        if st not in grouped:
            grouped[st] = []
        grouped[st].append(f)

    # Collect research metadata
    research_summary = research.get("research_summary", {}) or {}
    data_sources = research.get("data_sources", {})
    confidence = research_summary.get("confidence", {})
    locked_from_tabu = research.get("_locked_from_tabu", {})
    comparable = research_summary.get("comparable_projects", "")
    validation_fixes = research_summary.get("validation_fixes", [])

    return {
        "fields": fields,
        "grouped_by_source": grouped,
        "data_sources": data_sources,
        "confidence": confidence,
        "research_summary": research_summary if research_summary else None,
        "locked_from_tabu": locked_from_tabu,
        "comparable_projects": comparable,
        "validation_fixes": validation_fixes,
    }
