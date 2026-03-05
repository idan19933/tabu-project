"""Agent 3: Calculation Agent — AI + formulas as tool, with validation.

Uses the existing calculation_service functions as tools (not replacement).
Runs calculations, then has AI review results for sanity and flag concerns.
"""
import logging
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import settings
from app.models.simulation import Simulation
from app.services.calculation_service import (
    run_calculations,
    validate_simulation_ready,
)

logger = logging.getLogger(__name__)

VALIDATION_SYSTEM_PROMPT = """You are a senior real estate financial analyst in Israel.

You have been given the results of a feasibility calculation for an urban renewal (התחדשות עירונית) project.

Review the results and provide:
1. A brief sanity check — do the numbers make sense?
2. Any concerns or red flags (e.g., IRR > 50% is unrealistic, profit < 0 means unprofitable)
3. Suggestions for improvement

Keep your response concise (3-5 bullet points). Write in Hebrew.

Return a JSON object:
{
  "is_sane": true/false,
  "concerns": ["concern1", "concern2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "summary": "brief one-line summary in Hebrew"
}"""


def _get_llm():
    return ChatAnthropic(
        model="claude-sonnet-4-20250514",
        api_key=settings.ANTHROPIC_API_KEY,
        temperature=0,
        max_tokens=2048,
    )


def run_calculation_agent(sim: Simulation) -> dict[str, Any]:
    """Run calculations using existing formulas, then validate with AI.

    Args:
        sim: Simulation ORM object with all parameters loaded.

    Returns:
        Dict with calculation results + AI validation notes.
    """
    # Step 1: Validate inputs
    validation = validate_simulation_ready(sim)
    if not validation["ready"]:
        return {
            "success": False,
            "error": "missing_fields",
            "validation": validation,
            "results": None,
            "ai_validation_notes": None,
        }

    # Step 2: Run calculations using existing formulas
    try:
        results = run_calculations(sim)
    except Exception as e:
        logger.error(f"Calculation failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "results": None,
            "ai_validation_notes": None,
        }

    # Step 3: AI validates results
    ai_notes = _validate_results_with_ai(results)

    return {
        "success": True,
        "results": results,
        "ai_validation_notes": ai_notes,
    }


def _validate_results_with_ai(results: dict) -> str | None:
    """Have AI review calculation results for sanity."""
    if not settings.ANTHROPIC_API_KEY:
        return None

    # Prepare key metrics for review
    key_metrics = {
        "profit": results.get("profit"),
        "profitability_rate": results.get("profitability_rate"),
        "irr": results.get("irr"),
        "npv": results.get("npv"),
        "total_revenue": results.get("total_revenue"),
        "net_revenue": results.get("net_revenue"),
        "total_costs": results.get("total_costs"),
        "total_units": results.get("total_units"),
        "developer_units": results.get("developer_units"),
        "construction_cost": results.get("construction_cost"),
        "financing_cost": results.get("financing_cost"),
        "profit_percent": results.get("profit_percent"),
        "profit_percent_standard21": results.get("profit_percent_standard21"),
    }

    assumptions = results.get("calculation_details", {}).get("assumptions", {})

    llm = _get_llm()
    messages = [
        SystemMessage(content=VALIDATION_SYSTEM_PROMPT),
        HumanMessage(content=(
            f"Calculation Results:\n{key_metrics}\n\n"
            f"Assumptions:\n{assumptions}"
        )),
    ]

    try:
        response = llm.invoke(messages)
        content = response.content

        # Parse JSON from response
        import json
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            json_str = content.split("```")[1].split("```")[0]
        else:
            json_str = content

        parsed = json.loads(json_str.strip())
        # Format as readable notes
        notes_parts = []
        if parsed.get("summary"):
            notes_parts.append(parsed["summary"])
        if parsed.get("concerns"):
            notes_parts.append("חששות: " + "; ".join(parsed["concerns"]))
        if parsed.get("suggestions"):
            notes_parts.append("המלצות: " + "; ".join(parsed["suggestions"]))
        return "\n".join(notes_parts)
    except Exception as e:
        logger.error(f"AI validation error: {e}")
        return None
