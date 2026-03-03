"""Agent 1: PDF Data Extraction using LangChain + Claude.

Supports two document types:
- "tabu": Extracts property ownership/rights data from Tabu (land registry) documents.
  Persists to project.tabu_data and document.extracted_data.
- "planning" / "economic" / "general": Extracts planning parameters, economic data,
  and apartment mix from feasibility study documents.

Tracks extraction_status per document and extraction_progress on simulation.
"""
import logging
import uuid

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import settings
from app.database import SessionLocal
from app.models.apartment_mix import ApartmentMix
from app.models.cost_parameter import CostParameter
from app.models.document import Document, ExtractionStatus
from app.models.economic_parameter import EconomicParameter
from app.models.planning_parameter import PlanningParameter
from app.models.project import Project
from app.models.revenue_parameter import RevenueParameter
from app.models.simulation import Simulation, SimulationStatus
from app.schemas.extraction import (
    AIExtractionMetadata,
    ExtractedParameters,
    ExtractedTabuData,
)
from app.services import document_service
from app.utils.pdf import extract_text

logger = logging.getLogger(__name__)

TABU_SYSTEM_PROMPT = """You are an expert at extracting data from Israeli Tabu (נסח טאבו) land registry documents.
Extract all relevant property information including: block (גוש), parcel (חלקה), sub-parcel (תת-חלקה),
owners, rights, liens, mortgages, warnings (הערות אזהרה), area in sqm, and address.
Return structured JSON matching the schema provided."""

SMART_EXTRACTION_SYSTEM_PROMPT = """You are an expert at extracting real estate feasibility parameters from Hebrew documents.
You are also an expert at automatically detecting the document type.

STEP 1: Detect the document type:
- "tabu" — נסח טאבו / land registry document (contains block/parcel/owners/rights)
- "planning" — תב"ע / building plan (contains zoning, floors, coverage, building rights)
- "economic" — דוח כלכלי / economic report or appraisal (contains costs, prices, revenue)
- "general" — general feasibility document (may contain mixed data)

STEP 2: Extract ALL relevant fields based on detected type.

You must return a JSON object with this structure:
{
  "detected_doc_type": "tabu" | "planning" | "economic" | "general",
  "confidence": 0.0-1.0,
  "extraction": { ... the extracted data matching the schema below ... }
}

For non-tabu documents, the "extraction" field should match this schema:"""

PLANNING_SYSTEM_PROMPT = """You are an expert at extracting real estate feasibility parameters from Hebrew documents.
Extract planning parameters, cost parameters, revenue parameters, legacy economic parameters,
and apartment mix (types and quantities).

You must return a JSON object matching this exact structure:
{
  "planning": {
    "returns_percent": number or null (% החזר/תמורות),
    "multiplier_far": number or null,
    "avg_apt_size_sqm": number or null,
    "service_area_sqm": number or null,
    "number_of_floors": integer or null,
    "coverage_above_ground": number or null,
    "coverage_underground": number or null,
    "gross_area_per_parking": number or null,
    "building_lines_notes": string or null,
    "public_tasks_notes": string or null,
    "parking_standard_ratio": number or null,
    "typ_floor_area_min": number or null,
    "typ_floor_area_max": number or null,
    "apts_per_floor_min": integer or null,
    "apts_per_floor_max": integer or null,
    "return_area_per_apt": number or null,
    "service_area_percent": number or null,
    "public_area_sqm": number or null,
    "parking_floor_area": number or null,
    "balcony_area_per_unit": number or null,
    "blue_line_area": number or null
  },
  "cost": {
    "construction_duration_months": integer or null,
    "cost_per_sqm_residential": number or null (עלות בנייה מגורים ₪/מ"ר),
    "cost_per_sqm_service": number or null,
    "cost_per_sqm_commercial": number or null,
    "cost_per_sqm_balcony": number or null,
    "cost_per_sqm_development": number or null,
    "betterment_levy": number or null (היטל השבחה),
    "purchase_tax": number or null,
    "planning_consultants": number or null,
    "permits_fees": number or null,
    "electricity_connection": number or null,
    "bank_supervision": number or null,
    "engineering_management": number or null,
    "tenant_supervision": number or null,
    "management_overhead": number or null,
    "marketing_advertising": number or null,
    "tenant_lawyer": number or null,
    "initiation_fee": number or null,
    "rent_subsidy": number or null,
    "evacuation_cost": number or null,
    "moving_cost": number or null,
    "contingency": number or null (בלת"מ),
    "developer_lawyer": number or null,
    "demolition": number or null,
    "construction_total": number or null,
    "parking_construction": number or null,
    "financing_interest_rate": number or null,
    "vat_rate": number or null
  },
  "revenue": {
    "price_per_sqm_residential": number or null (מחיר מכירה מגורים ₪/מ"ר),
    "price_per_sqm_commercial": number or null,
    "price_per_unit_by_type": {"type_name": price, ...} or null
  },
  "economic": {
    "sales_prices_by_use": {"residential": number, "commercial": number, ...} or null,
    "cost_construction_dev": number or null,
    "cost_planning_mgmt": number or null,
    "levies_fees_taxes": number or null,
    "timeline_months": integer or null,
    "interest_rate": number or null,
    "sales_pace_per_month": number or null,
    "marketing_discount_pct": number or null
  },
  "apartment_mix": [
    {"apartment_type": string, "quantity": integer, "percentage_of_mix": number}
  ] or null
}

Only include fields you can confidently extract. Set others to null.
If you find cost data, prefer placing it in the "cost" section with the specific field names.
If you find revenue/price data, prefer placing it in "revenue" section."""


def _get_llm():
    return ChatAnthropic(
        model="claude-sonnet-4-20250514",
        api_key=settings.ANTHROPIC_API_KEY,
        temperature=0,
        max_tokens=4096,
    )


def _update_extraction_progress(db, sim: Simulation, total_docs: int, completed_docs: int, current_step: str):
    """Update the simulation's extraction_progress JSON field."""
    percentage = round((completed_docs / max(total_docs, 1)) * 100)
    sim.extraction_progress = {
        "total_docs": total_docs,
        "completed_docs": completed_docs,
        "current_step": current_step,
        "percentage": percentage,
    }
    db.commit()


def _find_active_simulation(db, project_id: str) -> Simulation | None:
    """Find the best simulation to merge new extraction data into.

    Priority:
    1. Draft / AI_Extracting / Pending_Review (most recent) — still being worked on
    2. Approved_For_Calc (most recent) — user approved but hasn't calculated yet
    3. None — will create a new one
    """
    pid = uuid.UUID(project_id)
    # First try to find a sim that's still in progress
    sim = (
        db.query(Simulation)
        .filter(
            Simulation.project_id == pid,
            Simulation.status.in_([
                SimulationStatus.DRAFT,
                SimulationStatus.AI_EXTRACTING,
                SimulationStatus.PENDING_REVIEW,
            ])
        )
        .order_by(Simulation.created_at.desc())
        .first()
    )
    if sim:
        return sim
    # Fall back to approved (not yet calculated)
    return (
        db.query(Simulation)
        .filter(
            Simulation.project_id == pid,
            Simulation.status == SimulationStatus.APPROVED_FOR_CALC,
        )
        .order_by(Simulation.created_at.desc())
        .first()
    )


def run_extraction(document_id: str, project_id: str) -> None:
    """Background task: extract parameters from an uploaded PDF document."""
    db = SessionLocal()
    try:
        doc = document_service.get_by_id(db, uuid.UUID(document_id))
        if not doc:
            logger.error(f"Document {document_id} not found")
            return

        # Mark document as Processing
        doc.extraction_status = ExtractionStatus.PROCESSING
        db.commit()

        pdf_text = extract_text(doc.file_path)
        if not pdf_text.strip():
            doc.extraction_status = ExtractionStatus.FAILED
            doc.extraction_error = "No text extracted from PDF"
            db.commit()
            logger.error(f"No text extracted from document {document_id}")
            return

        if doc.document_type == "tabu":
            _extract_tabu(db, doc, pdf_text, project_id)
        else:
            _extract_parameters(db, doc, pdf_text, project_id)

    except Exception as e:
        logger.error(f"Extraction failed for document {document_id}: {e}")
        # Mark document as failed
        try:
            doc = document_service.get_by_id(db, uuid.UUID(document_id))
            if doc:
                doc.extraction_status = ExtractionStatus.FAILED
                doc.extraction_error = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _extract_tabu(db, doc: Document, pdf_text: str, project_id: str) -> None:
    """Extract property data from a Tabu document.

    Persists results to project.tabu_data and document.extracted_data.
    """
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("No ANTHROPIC_API_KEY set, skipping AI extraction")
        doc.extraction_status = ExtractionStatus.FAILED
        doc.extraction_error = "No API key configured"
        db.commit()
        return

    llm = _get_llm()
    structured_llm = llm.with_structured_output(ExtractedTabuData)

    messages = [
        SystemMessage(content=TABU_SYSTEM_PROMPT),
        HumanMessage(content=f"Extract all property data from this Tabu document:\n\n{pdf_text[:8000]}"),
    ]
    extracted: ExtractedTabuData = structured_llm.invoke(messages)
    extracted_dict = extracted.model_dump()

    # Store on document
    doc.extracted_data = extracted_dict
    doc.extraction_status = ExtractionStatus.COMPLETED

    # ALWAYS persist to project.tabu_data
    project = db.query(Project).filter(Project.id == uuid.UUID(project_id)).first()
    if project:
        project.tabu_data = extracted_dict
        logger.info(f"Saved tabu_data to project {project_id}: block={extracted_dict.get('block')}")

    db.commit()
    logger.info(f"Tabu extraction complete for document {doc.id}")

    # AUTO-TRIGGER market research agent in background
    if project and project.tabu_data:
        try:
            from app.api.research import _run_research_background
            import threading
            logger.info(f"Auto-triggering market research for project {project_id}")
            project.market_research_status = "running"
            db.commit()
            t = threading.Thread(
                target=_run_research_background,
                args=(project_id, extracted_dict),
                daemon=True,
            )
            t.start()
        except Exception as e:
            logger.error(f"Failed to trigger market research: {e}")


def _extract_parameters(db, doc: Document, pdf_text: str, project_id: str) -> None:
    """Extract planning/economic parameters from a feasibility document.

    Finds the latest non-completed simulation (or creates one) and MERGES
    extracted data — never overwriting existing non-null/non-zero values.
    """
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("No ANTHROPIC_API_KEY set, skipping AI extraction")
        doc.extraction_status = ExtractionStatus.FAILED
        doc.extraction_error = "No API key configured"
        db.commit()
        return

    llm = _get_llm()

    # Use structured output to get validated extraction
    structured_llm = llm.with_structured_output(ExtractedParameters)

    # Build context from existing tabu data
    project = db.query(Project).filter(Project.id == uuid.UUID(project_id)).first()
    tabu_context = ""
    if project and project.tabu_data:
        td = project.tabu_data
        tabu_context = f"""
Previously extracted property data from Tabu document:
- Block (גוש): {td.get('block', 'N/A')}
- Parcel (חלקה): {td.get('parcel', 'N/A')}
- Area (שטח): {td.get('area_sqm', 'N/A')} sqm
- Address: {td.get('address', 'N/A')}

Use this property context to better understand and extract parameters from the document below.
"""

    messages = [
        SystemMessage(content=PLANNING_SYSTEM_PROMPT),
        HumanMessage(content=f"{tabu_context}Extract all feasibility parameters from this document:\n\n{pdf_text[:12000]}"),
    ]

    extracted: ExtractedParameters = structured_llm.invoke(messages)

    # Store raw AI output on document
    doc.extracted_data = extracted.model_dump()

    # Find ANY non-completed simulation for this project (not just AI_EXTRACTING)
    sim = _find_active_simulation(db, project_id)
    if not sim:
        sim = Simulation(
            project_id=uuid.UUID(project_id),
            version_name="סימולציה ראשונית",
            status=SimulationStatus.AI_EXTRACTING,
        )
        db.add(sim)
        db.flush()
    elif sim.status == SimulationStatus.DRAFT:
        # Move to AI_EXTRACTING while we process
        sim.status = SimulationStatus.AI_EXTRACTING

    # Count total docs for progress tracking
    total_docs = db.query(Document).filter(
        Document.project_id == uuid.UUID(project_id),
        Document.document_type != "tabu",
    ).count()
    completed_docs = db.query(Document).filter(
        Document.project_id == uuid.UUID(project_id),
        Document.document_type != "tabu",
        Document.extraction_status == ExtractionStatus.COMPLETED,
    ).count()

    _update_extraction_progress(db, sim, total_docs, completed_docs, f"מעבד: {doc.document_type}")

    metadata = AIExtractionMetadata(
        source_document_id=str(doc.id),
        confidence_scores={},
        source_quotes={},
    ).model_dump()

    # Save planning parameters — MERGE only non-null extracted values
    if extracted.planning:
        # Get only the fields AI actually extracted (non-null)
        planning_data = {k: v for k, v in extracted.planning.model_dump().items() if v is not None}
        if planning_data:
            metadata["extracted_fields"] = list(planning_data.keys())

            existing = db.query(PlanningParameter).filter(
                PlanningParameter.simulation_id == sim.id
            ).first()
            if existing:
                # MERGE: only overwrite fields that are currently null/0
                for k, v in planning_data.items():
                    current = getattr(existing, k, None)
                    if current is None or current == 0 or current == 0.0:
                        setattr(existing, k, v)
                existing.ai_extraction_metadata = metadata
            else:
                # Create new — fill required NOT NULL columns with 0 for non-extracted fields
                defaults = {
                    "returns_percent": 0, "multiplier_far": 0, "avg_apt_size_sqm": 0,
                    "service_area_sqm": 0, "number_of_floors": 0, "coverage_above_ground": 0,
                    "coverage_underground": 0, "gross_area_per_parking": 0,
                    "parking_standard_ratio": 0, "typ_floor_area_min": 0,
                    "typ_floor_area_max": 0, "apts_per_floor_min": 0, "apts_per_floor_max": 0,
                }
                defaults.update(planning_data)
                defaults["ai_extraction_metadata"] = metadata
                db.add(PlanningParameter(simulation_id=sim.id, **defaults))

    # Save apartment mix — only if AI actually found items
    if extracted.apartment_mix and len(extracted.apartment_mix) > 0:
        # Only replace mix if we have actual data AND no existing mix
        existing_mix_count = db.query(ApartmentMix).filter(
            ApartmentMix.simulation_id == sim.id
        ).count()
        if existing_mix_count == 0:
            for item in extracted.apartment_mix:
                db.add(ApartmentMix(
                    simulation_id=sim.id,
                    apartment_type=item.apartment_type,
                    quantity=item.quantity,
                    percentage_of_mix=item.percentage_of_mix,
                ))

    # Save economic parameters — MERGE only non-null extracted values
    if extracted.economic:
        econ_data = {k: v for k, v in extracted.economic.model_dump().items() if v is not None}
        if econ_data:
            metadata_econ = AIExtractionMetadata(
                source_document_id=str(doc.id),
                confidence_scores={},
                source_quotes={},
            ).model_dump()
            metadata_econ["extracted_fields"] = list(econ_data.keys())

            existing = db.query(EconomicParameter).filter(
                EconomicParameter.simulation_id == sim.id
            ).first()
            if existing:
                # MERGE: only overwrite fields that are currently null/0/empty
                for k, v in econ_data.items():
                    current = getattr(existing, k, None)
                    if k == "sales_prices_by_use":
                        # Merge dict: add new keys, don't overwrite existing non-zero prices
                        if current and isinstance(current, dict) and isinstance(v, dict):
                            merged = {**current}
                            for pk, pv in v.items():
                                if pv and (pk not in merged or not merged[pk]):
                                    merged[pk] = pv
                            setattr(existing, k, merged)
                        elif not current or current == {}:
                            setattr(existing, k, v)
                    elif current is None or current == 0 or current == 0.0:
                        setattr(existing, k, v)
                existing.ai_extraction_metadata = metadata_econ
            else:
                # Create new — fill defaults
                defaults = {
                    "sales_prices_by_use": {}, "cost_construction_dev": 0,
                    "cost_planning_mgmt": 0, "levies_fees_taxes": 0,
                    "timeline_months": 0, "interest_rate": 0,
                    "sales_pace_per_month": 0, "marketing_discount_pct": 0,
                }
                defaults.update(econ_data)
                defaults["ai_extraction_metadata"] = metadata_econ
                db.add(EconomicParameter(simulation_id=sim.id, **defaults))

    # Save cost parameters — MERGE only non-null extracted values
    if extracted.cost:
        cost_data = {k: v for k, v in extracted.cost.model_dump().items() if v is not None}
        if cost_data:
            metadata_cost = AIExtractionMetadata(
                source_document_id=str(doc.id),
                confidence_scores={},
                source_quotes={},
            ).model_dump()
            metadata_cost["extracted_fields"] = list(cost_data.keys())

            existing = db.query(CostParameter).filter(
                CostParameter.simulation_id == sim.id
            ).first()
            if existing:
                for k, v in cost_data.items():
                    current = getattr(existing, k, None)
                    if current is None or current == 0 or current == 0.0:
                        setattr(existing, k, v)
                existing.ai_extraction_metadata = metadata_cost
            else:
                cost_data["ai_extraction_metadata"] = metadata_cost
                db.add(CostParameter(simulation_id=sim.id, **cost_data))

    # Save revenue parameters — MERGE only non-null extracted values
    if extracted.revenue:
        rev_data = {k: v for k, v in extracted.revenue.model_dump().items() if v is not None}
        if rev_data:
            metadata_rev = AIExtractionMetadata(
                source_document_id=str(doc.id),
                confidence_scores={},
                source_quotes={},
            ).model_dump()
            metadata_rev["extracted_fields"] = list(rev_data.keys())

            existing = db.query(RevenueParameter).filter(
                RevenueParameter.simulation_id == sim.id
            ).first()
            if existing:
                for k, v in rev_data.items():
                    if k == "price_per_unit_by_type":
                        current = getattr(existing, k, None)
                        if current and isinstance(current, dict) and isinstance(v, dict):
                            merged = {**current}
                            for pk, pv in v.items():
                                if pv and (pk not in merged or not merged[pk]):
                                    merged[pk] = pv
                            setattr(existing, k, merged)
                        elif not current or current == {}:
                            setattr(existing, k, v)
                    else:
                        current = getattr(existing, k, None)
                        if current is None or current == 0 or current == 0.0:
                            setattr(existing, k, v)
                existing.ai_extraction_metadata = metadata_rev
            else:
                rev_data["ai_extraction_metadata"] = metadata_rev
                db.add(RevenueParameter(simulation_id=sim.id, **rev_data))

    # Mark document completed
    doc.extraction_status = ExtractionStatus.COMPLETED

    # Update progress and transition simulation
    completed_docs += 1
    _update_extraction_progress(db, sim, total_docs, completed_docs, "חילוץ הושלם")

    sim.status = SimulationStatus.PENDING_REVIEW
    db.commit()
    logger.info(f"Parameter extraction complete for simulation {sim.id}")


def smart_extract(pdf_text: str) -> dict:
    """Auto-detect document type and extract all relevant fields.

    Returns:
        Dict with doc_type, extracted_fields, confidence_scores, missing_fields.
    """
    if not settings.ANTHROPIC_API_KEY:
        return {"doc_type": "general", "extracted_fields": {}, "confidence_scores": {}, "missing_fields": []}

    llm = _get_llm()
    messages = [
        SystemMessage(content=SMART_EXTRACTION_SYSTEM_PROMPT + PLANNING_SYSTEM_PROMPT),
        HumanMessage(content=f"Auto-detect the document type and extract all fields:\n\n{pdf_text[:12000]}"),
    ]

    try:
        response = llm.invoke(messages)
        content = response.content

        import json
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            json_str = content.split("```")[1].split("```")[0]
        else:
            json_str = content

        parsed = json.loads(json_str.strip())
        detected_type = parsed.get("detected_doc_type", "general")
        confidence = parsed.get("confidence", 0.5)
        extraction = parsed.get("extraction", {})

        # Determine missing fields based on what was extracted
        all_planning_fields = [
            "returns_percent", "avg_apt_size_sqm", "number_of_floors",
            "coverage_above_ground", "gross_area_per_parking", "parking_standard_ratio",
        ]
        extracted_keys = set()
        for section in ["planning", "cost", "revenue", "economic"]:
            if section in extraction and extraction[section]:
                for k, v in extraction[section].items():
                    if v is not None:
                        extracted_keys.add(k)

        missing = [f for f in all_planning_fields if f not in extracted_keys]

        return {
            "doc_type": detected_type,
            "extracted_fields": extraction,
            "confidence_scores": {"doc_type": confidence},
            "missing_fields": missing,
        }
    except Exception as e:
        logger.error(f"Smart extraction error: {e}")
        return {"doc_type": "general", "extracted_fields": {}, "confidence_scores": {}, "missing_fields": []}


def aggregate_extractions(db, project_id: str) -> dict:
    """Merge extracted data from all completed documents into a unified summary.

    Returns a dict with combined planning, economic, apartment_mix, and tabu data.
    """
    pid = uuid.UUID(project_id)
    docs = db.query(Document).filter(
        Document.project_id == pid,
        Document.extraction_status == ExtractionStatus.COMPLETED,
    ).all()

    merged = {
        "planning": {},
        "economic": {},
        "cost": {},
        "revenue": {},
        "apartment_mix": [],
        "tabu": None,
    }

    for doc in docs:
        if not doc.extracted_data:
            continue

        if doc.document_type == "tabu":
            merged["tabu"] = doc.extracted_data
        else:
            data = doc.extracted_data
            # Merge planning: only fill in missing values
            if data.get("planning"):
                for k, v in data["planning"].items():
                    if v is not None and (k not in merged["planning"] or not merged["planning"][k]):
                        merged["planning"][k] = v
            # Merge economic: only fill in missing values
            if data.get("economic"):
                for k, v in data["economic"].items():
                    if v is not None and (k not in merged["economic"] or not merged["economic"][k]):
                        merged["economic"][k] = v
            # Merge cost: only fill in missing values
            if data.get("cost"):
                for k, v in data["cost"].items():
                    if v is not None and (k not in merged["cost"] or not merged["cost"][k]):
                        merged["cost"][k] = v
            # Merge revenue: only fill in missing values
            if data.get("revenue"):
                for k, v in data["revenue"].items():
                    if v is not None and (k not in merged["revenue"] or not merged["revenue"][k]):
                        merged["revenue"][k] = v
            # Append apartment mix
            if data.get("apartment_mix"):
                merged["apartment_mix"] = data["apartment_mix"]

    return merged
