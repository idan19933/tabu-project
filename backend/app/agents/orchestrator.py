"""Agent Orchestrator — coordinates the multi-agent pipeline.

Pipeline: Extract → Research → Calculate → Alternatives

Runs agents sequentially, passing context between them.
Updates simulation.agent_status JSON after each step.
Supports SSE for real-time progress.
"""
import asyncio
import json
import logging
import uuid
from typing import Any, AsyncGenerator

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.document import Document, ExtractionStatus
from app.models.simulation import Simulation, SimulationStatus
from app.services import simulation_service
from app.services.calculation_service import validate_simulation_ready
from app.utils.pdf import extract_text

logger = logging.getLogger(__name__)

# In-memory store for SSE status updates (keyed by simulation_id)
_agent_streams: dict[str, list[dict]] = {}


def _update_agent_status(db: Session, sim: Simulation, step: str, status: str, details: dict | None = None):
    """Update simulation.agent_status JSON and broadcast to SSE."""
    current = sim.agent_status or {}
    current[step] = {"status": status, **(details or {})}
    sim.agent_status = current
    # Force SQLAlchemy to detect the change
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(sim, "agent_status")
    db.commit()

    # Store event for SSE
    sim_id = str(sim.id)
    if sim_id not in _agent_streams:
        _agent_streams[sim_id] = []
    _agent_streams[sim_id].append({
        "step": step,
        "status": status,
        "details": details or {},
        "full_status": dict(current),
    })


def get_agent_events(sim_id: str, after: int = 0) -> list[dict]:
    """Get SSE events for a simulation after a given index."""
    events = _agent_streams.get(sim_id, [])
    return events[after:]


def clear_agent_events(sim_id: str):
    """Clear SSE events for a simulation."""
    _agent_streams.pop(sim_id, None)


def run_pipeline(simulation_id: str) -> dict[str, Any]:
    """Run the full agent pipeline for a simulation.

    Pipeline: Extract → Research → Calculate → Alternatives

    This is designed to be called as a background task.
    """
    db = SessionLocal()
    try:
        sim_uuid = uuid.UUID(simulation_id)
        sim = simulation_service.get_by_id(db, sim_uuid)
        if not sim:
            logger.error(f"Simulation {simulation_id} not found")
            return {"success": False, "error": "Simulation not found"}

        # Initialize agent status
        sim.agent_status = {
            "extraction": {"status": "pending"},
            "research": {"status": "pending"},
            "calculation": {"status": "pending"},
            "alternatives": {"status": "pending"},
        }
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(sim, "agent_status")
        db.commit()

        # Clear any previous SSE events
        clear_agent_events(simulation_id)

        # --- Step 1: Extraction ---
        _update_agent_status(db, sim, "extraction", "running")
        extraction_result = _run_extraction_step(db, sim)
        _update_agent_status(db, sim, "extraction", "completed", {
            "docs_processed": extraction_result.get("docs_processed", 0),
        })

        # --- Step 2: Research ---
        _update_agent_status(db, sim, "research", "running")
        research_result = _run_research_step(db, sim)
        _update_agent_status(db, sim, "research", "completed", {
            "fields_found": research_result.get("fields_found", 0),
        })

        # --- Step 3: Calculation ---
        _update_agent_status(db, sim, "calculation", "running")
        calc_result = _run_calculation_step(db, sim)
        if not calc_result.get("success"):
            _update_agent_status(db, sim, "calculation", "error", {
                "error": calc_result.get("error", "Unknown error"),
            })
            _update_agent_status(db, sim, "alternatives", "skipped")
            return {"success": False, "error": calc_result.get("error")}
        _update_agent_status(db, sim, "calculation", "completed")

        # --- Step 4: Alternatives ---
        _update_agent_status(db, sim, "alternatives", "running")
        alt_result = _run_alternatives_step(db, sim, calc_result["results"])
        _update_agent_status(db, sim, "alternatives", "completed", {
            "scenarios_count": len(alt_result.get("scenarios", [])),
            "optimizations_count": len(alt_result.get("optimizations", [])),
        })

        # Mark simulation as completed
        simulation_service.set_status(db, sim, SimulationStatus.COMPLETED)

        return {
            "success": True,
            "results": calc_result.get("results"),
            "alternatives": alt_result,
            "ai_validation_notes": calc_result.get("ai_validation_notes"),
        }

    except Exception as e:
        logger.error(f"Pipeline error for simulation {simulation_id}: {e}")
        try:
            sim = simulation_service.get_by_id(db, uuid.UUID(simulation_id))
            if sim:
                _update_agent_status(db, sim, "error", "failed", {"error": str(e)})
        except Exception:
            pass
        return {"success": False, "error": str(e)}
    finally:
        db.close()


def _run_extraction_step(db: Session, sim: Simulation) -> dict:
    """Run extraction on all documents attached to this simulation."""
    docs = db.query(Document).filter(
        Document.simulation_id == sim.id,
        Document.document_type != "tabu",
    ).all()

    if not docs:
        # Also check project-level docs that aren't attached to a simulation
        docs = db.query(Document).filter(
            Document.project_id == sim.project_id,
            Document.simulation_id.is_(None),
            Document.document_type != "tabu",
        ).all()

    docs_processed = 0
    for doc in docs:
        if doc.extraction_status == ExtractionStatus.COMPLETED:
            docs_processed += 1
            continue

        try:
            from app.agents.extraction_agent import run_extraction
            run_extraction(str(doc.id), str(sim.project_id))
            docs_processed += 1
        except Exception as e:
            logger.error(f"Extraction failed for doc {doc.id}: {e}")

    return {"docs_processed": docs_processed}


def _run_research_step(db: Session, sim: Simulation) -> dict:
    """Run research agent to find missing field values."""
    # Check what's missing
    sim = simulation_service.get_by_id(db, sim.id)
    validation = validate_simulation_ready(sim)

    missing_fields = (
        validation.get("missing_planning", [])
        + validation.get("missing_cost", [])
        + validation.get("missing_revenue", [])
    )

    if not missing_fields:
        return {"fields_found": 0, "still_missing": []}

    # Gather document texts
    docs = db.query(Document).filter(
        Document.project_id == sim.project_id,
        Document.extraction_status == ExtractionStatus.COMPLETED,
    ).all()

    document_texts = []
    for doc in docs:
        try:
            text = extract_text(doc.file_path)
            document_texts.append({
                "doc_type": doc.doc_type or doc.document_type,
                "text": text,
            })
        except Exception:
            pass

    if not document_texts:
        return {"fields_found": 0, "still_missing": missing_fields}

    from app.agents.research_agent import run_research
    result = run_research(missing_fields, document_texts)

    # Apply found fields to simulation parameters
    found = result.get("found_fields", {})
    if found:
        _apply_found_fields(db, sim, found)

    return {
        "fields_found": len(found),
        "still_missing": result.get("still_missing", []),
    }


def _apply_found_fields(db: Session, sim: Simulation, found_fields: dict):
    """Apply research-found fields to simulation parameters."""
    from app.models.planning_parameter import PlanningParameter
    from app.models.cost_parameter import CostParameter
    from app.models.revenue_parameter import RevenueParameter

    planning_fields = {
        "returns_percent", "avg_apt_size_sqm", "number_of_floors",
        "coverage_above_ground", "gross_area_per_parking", "parking_standard_ratio",
        "coverage_underground", "multiplier_far", "service_area_sqm",
        "return_area_per_apt", "service_area_percent", "public_area_sqm",
        "parking_floor_area", "balcony_area_per_unit", "blue_line_area",
    }
    cost_fields = {
        "cost_per_sqm_residential", "construction_duration_months",
        "financing_interest_rate", "vat_rate",
        "cost_per_sqm_service", "cost_per_sqm_commercial",
        "cost_per_sqm_balcony", "cost_per_sqm_development",
        "betterment_levy", "purchase_tax", "electricity_connection",
        "rent_subsidy", "evacuation_cost", "moving_cost",
        "demolition", "parking_construction", "cpi_linkage_pct",
        # Percentage-based cost fields
        "planning_consultants_pct", "permits_fees_pct", "bank_supervision_pct",
        "engineering_management_pct", "tenant_supervision_pct", "management_overhead_pct",
        "marketing_advertising_pct", "tenant_lawyer_pct", "developer_lawyer_pct",
        "contingency_pct", "initiation_fee_pct",
    }
    revenue_fields = {
        "price_per_sqm_residential", "price_per_sqm_commercial",
        "sales_pace_per_month", "marketing_discount_pct",
    }

    for field_name, value in found_fields.items():
        if value is None:
            continue
        try:
            if field_name in planning_fields:
                pp = db.query(PlanningParameter).filter(PlanningParameter.simulation_id == sim.id).first()
                if pp:
                    current = getattr(pp, field_name, None)
                    if current is None or current == 0 or current == 0.0:
                        setattr(pp, field_name, value)
            elif field_name in cost_fields:
                cp = db.query(CostParameter).filter(CostParameter.simulation_id == sim.id).first()
                if cp:
                    current = getattr(cp, field_name, None)
                    if current is None or current == 0 or current == 0.0:
                        setattr(cp, field_name, value)
            elif field_name in revenue_fields:
                rp = db.query(RevenueParameter).filter(RevenueParameter.simulation_id == sim.id).first()
                if rp:
                    current = getattr(rp, field_name, None)
                    if current is None or current == 0 or current == 0.0:
                        setattr(rp, field_name, value)
        except Exception as e:
            logger.warning(f"Failed to apply field {field_name}: {e}")

    db.commit()


def _run_calculation_step(db: Session, sim: Simulation) -> dict:
    """Run calculation agent."""
    # Refresh simulation to get latest params
    sim = simulation_service.get_by_id(db, sim.id)

    from app.agents.calculation_agent import run_calculation_agent
    result = run_calculation_agent(sim)

    if result.get("success") and result.get("results"):
        # Save results
        simulation_service.save_results(db, sim, **result["results"])

        # Save AI validation notes
        if result.get("ai_validation_notes") and sim.simulation_results:
            sim.simulation_results.ai_validation_notes = result["ai_validation_notes"]
            db.commit()

    return result


def _run_alternatives_step(db: Session, sim: Simulation, base_results: dict) -> dict:
    """Run alternatives agent."""
    sim = simulation_service.get_by_id(db, sim.id)

    from app.agents.alternatives_agent import run_alternatives_agent
    result = run_alternatives_agent(sim, base_results)

    # Save scenarios and optimizations to simulation results
    if sim.simulation_results:
        sim.simulation_results.scenarios = result.get("scenarios")
        sim.simulation_results.optimizations = result.get("optimizations")
        db.commit()

    return result
