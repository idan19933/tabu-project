"""Agent 4: Alternatives Agent — generates 3 scenarios + optimization recommendations.

Takes base simulation parameters and results, generates conservative/base/optimistic
scenarios by varying key parameters, runs calculations for each, and provides
AI-powered optimization recommendations.
"""
import copy
import logging
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import settings
from app.models.simulation import Simulation
from app.services.calculation_service import (
    SimParams,
    extract_params,
    calc_proposed_state,
    calc_building_program,
    calc_costs,
    calc_revenue,
    calc_cashflow_irr_npv,
    _safe,
)

logger = logging.getLogger(__name__)

OPTIMIZATION_SYSTEM_PROMPT = """You are a senior real estate investment advisor in Israel specializing in urban renewal (התחדשות עירונית).

You are given 3 scenarios for a feasibility study:
- Conservative (שמרני): +10% costs, -5% prices, slower sales
- Base (בסיס): original parameters
- Optimistic (אופטימי): -5% costs, +10% prices, faster sales

Analyze the results and provide specific, actionable optimization recommendations.

Return a JSON object:
{
  "optimizations": [
    {
      "description": "הגדלת מספר הקומות מ-8 ל-10 — רווח גדל ב-15%",
      "impact_estimate": "15% increase in profit",
      "confidence": 0.75,
      "parameter": "number_of_floors",
      "suggested_value": 10
    }
  ],
  "analysis_summary": "brief Hebrew analysis of the 3 scenarios"
}

Provide 3-5 recommendations. Focus on parameters that have the highest impact.
Write descriptions in Hebrew."""


def _get_llm():
    return ChatAnthropic(
        model="claude-sonnet-4-20250514",
        api_key=settings.ANTHROPIC_API_KEY,
        temperature=0.3,
        max_tokens=3000,
    )


def _run_scenario_calculations(params: SimParams, rp=None) -> dict:
    """Run full calculation pipeline with modified params."""
    proposed = calc_proposed_state(params)
    program = calc_building_program(params, proposed)
    costs = calc_costs(params, proposed, program)
    rev = calc_revenue(params, proposed, program, costs)

    # Handle parking/storage revenue if rp is available
    if rp:
        if _safe(rp.price_per_sqm_parking) > 0:
            rev.parking_revenue = program.total_parking_spots * _safe(rp.price_per_sqm_parking)
        if _safe(rp.price_per_sqm_storage) > 0:
            rev.storage_revenue = proposed.developer_units * 5 * _safe(rp.price_per_sqm_storage)
        # Recalculate totals
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

    return {
        "profit": round(rev.expected_profit, 2),
        "profitability_rate": round(rev.profit_percent, 2),
        "irr": round(financial.irr, 2),
        "npv": round(financial.npv, 2),
        "total_revenue": round(rev.total_revenue, 2),
        "net_revenue": round(rev.net_revenue, 2),
        "total_costs": round(costs.total_costs, 2),
        "developer_units": proposed.developer_units,
        "total_units": proposed.total_units,
    }


def run_alternatives_agent(sim: Simulation, base_results: dict) -> dict[str, Any]:
    """Generate 3 scenarios and optimization recommendations.

    Args:
        sim: Simulation ORM object with all parameters loaded.
        base_results: Results from the base calculation.

    Returns:
        Dict with scenarios list and optimizations list.
    """
    base_params = extract_params(sim)
    rp = sim.revenue_parameters

    # --- Conservative scenario: +10% costs, -5% prices, slower sales ---
    conservative_params = copy.deepcopy(base_params)
    conservative_params.cost_sqm_res *= 1.10
    conservative_params.cost_sqm_service *= 1.10
    conservative_params.cost_sqm_commercial *= 1.10
    conservative_params.cost_sqm_balcony *= 1.10
    conservative_params.cost_sqm_development *= 1.10
    conservative_params.price_sqm_res *= 0.95
    conservative_params.price_sqm_comm *= 0.95
    if conservative_params.sales_pace > 0:
        conservative_params.sales_pace *= 0.8

    # --- Optimistic scenario: -5% costs, +10% prices, faster sales ---
    optimistic_params = copy.deepcopy(base_params)
    optimistic_params.cost_sqm_res *= 0.95
    optimistic_params.cost_sqm_service *= 0.95
    optimistic_params.cost_sqm_commercial *= 0.95
    optimistic_params.cost_sqm_balcony *= 0.95
    optimistic_params.cost_sqm_development *= 0.95
    optimistic_params.price_sqm_res *= 1.10
    optimistic_params.price_sqm_comm *= 1.10
    if optimistic_params.sales_pace > 0:
        optimistic_params.sales_pace *= 1.2

    # Run calculations for each scenario
    try:
        conservative_results = _run_scenario_calculations(conservative_params, rp)
        optimistic_results = _run_scenario_calculations(optimistic_params, rp)
    except Exception as e:
        logger.error(f"Scenario calculation failed: {e}")
        conservative_results = {}
        optimistic_results = {}

    scenarios = [
        {
            "name": "שמרני",
            "name_en": "conservative",
            "description": "+10% עלויות, -5% מחירים, קצב מכירות איטי",
            "params_adjustments": {
                "costs": "+10%",
                "prices": "-5%",
                "sales_pace": "-20%",
            },
            "results": conservative_results,
        },
        {
            "name": "בסיס",
            "name_en": "base",
            "description": "פרמטרים מקוריים",
            "params_adjustments": {},
            "results": {
                "profit": base_results.get("profit"),
                "profitability_rate": base_results.get("profitability_rate"),
                "irr": base_results.get("irr"),
                "npv": base_results.get("npv"),
                "total_revenue": base_results.get("total_revenue"),
                "net_revenue": base_results.get("net_revenue"),
                "total_costs": base_results.get("total_costs"),
                "developer_units": base_results.get("developer_units"),
                "total_units": base_results.get("total_units"),
            },
        },
        {
            "name": "אופטימי",
            "name_en": "optimistic",
            "description": "-5% עלויות, +10% מחירים, קצב מכירות מהיר",
            "params_adjustments": {
                "costs": "-5%",
                "prices": "+10%",
                "sales_pace": "+20%",
            },
            "results": optimistic_results,
        },
    ]

    # Get AI optimization recommendations
    optimizations = _get_ai_optimizations(scenarios, base_params)

    return {
        "scenarios": scenarios,
        "optimizations": optimizations,
    }


def _get_ai_optimizations(scenarios: list, base_params: SimParams) -> list[dict]:
    """Use AI to analyze scenarios and suggest optimizations."""
    if not settings.ANTHROPIC_API_KEY:
        return []

    # Build scenario summary for AI
    scenario_summary = ""
    for s in scenarios:
        r = s.get("results", {})
        scenario_summary += f"\n{s['name']} ({s['name_en']}):\n"
        scenario_summary += f"  רווח: {r.get('profit', 'N/A')}\n"
        scenario_summary += f"  רווחיות: {r.get('profitability_rate', 'N/A')}%\n"
        scenario_summary += f"  IRR: {r.get('irr', 'N/A')}%\n"
        scenario_summary += f"  הכנסות: {r.get('total_revenue', 'N/A')}\n"
        scenario_summary += f"  עלויות: {r.get('total_costs', 'N/A')}\n"

    current_params = {
        "number_of_floors": base_params.num_floors,
        "avg_apt_size_sqm": base_params.avg_apt_size,
        "returns_percent": base_params.returns_pct * 100,
        "coverage_above_ground": base_params.coverage_above * 100,
        "cost_per_sqm_residential": base_params.cost_sqm_res,
        "price_per_sqm_residential": base_params.price_sqm_res,
        "parking_ratio": base_params.parking_ratio,
        "construction_duration_months": base_params.construction_duration,
    }

    llm = _get_llm()
    messages = [
        SystemMessage(content=OPTIMIZATION_SYSTEM_PROMPT),
        HumanMessage(content=(
            f"Scenario Analysis:\n{scenario_summary}\n\n"
            f"Current Parameters:\n{current_params}"
        )),
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
        return parsed.get("optimizations", [])
    except Exception as e:
        logger.error(f"AI optimization error: {e}")
        return []
