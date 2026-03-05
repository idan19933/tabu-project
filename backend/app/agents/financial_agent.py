"""Agent 2: Financial Calculations.

Wraps the comprehensive calculation engine.  The direct calculation path now
handles the full Shikun & Binui feasibility model, so we use it directly
rather than going through a multi-step agentic loop.
"""
import logging

from app.models.simulation import Simulation
from app.services.calculation_service import run_calculations

logger = logging.getLogger(__name__)


def run_agentic_calculation(sim: Simulation) -> dict:
    """Run financial calculations for a simulation.

    Uses the direct calculation engine which implements all formulas
    from the Shikun & Binui pilot Excel spec.
    """
    logger.info(f"Running calculations for simulation {sim.id}")
    results = run_calculations(sim)
    logger.info(
        f"Calculation complete: profit={results.get('profit')}, "
        f"profitability={results.get('profitability_rate')}%, "
        f"IRR={results.get('irr')}%, NPV={results.get('npv')}"
    )
    return results
