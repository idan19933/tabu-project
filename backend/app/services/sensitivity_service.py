"""Per-parameter sensitivity analysis.

Varies individual parameters ±10%, ±20% and captures profit/IRR/profit_pct
for each variant, enabling identification of which inputs most affect outcomes.
"""
import copy

from app.models.simulation import Simulation
from app.services.calculation_service import run_calculations, _safe


# Parameters to test with Hebrew labels
SENSITIVITY_PARAMS = [
    ("number_of_floors", "מספר קומות", "planning"),
    ("returns_percent", "% החזר", "planning"),
    ("cost_per_sqm_residential", 'עלות בנייה (₪/מ"ר)', "cost"),
    ("price_per_sqm_residential", 'מחיר מגורים (₪/מ"ר)', "revenue"),
    ("financing_interest_rate", "ריבית מימון (%)", "cost"),
    ("coverage_above_ground", "% כיסוי עילי", "planning"),
    ("avg_apt_size_sqm", 'שטח דירה ממוצע (מ"ר)', "planning"),
    ("parking_standard_ratio", "יחס חנייה", "planning"),
]

CHANGE_PCTS = [-20, -10, 10, 20]


def _clone_param(obj):
    """Shallow-copy an ORM object without touching the DB session."""
    if obj is None:
        return None
    cloned = copy.copy(obj)
    # Detach from SQLAlchemy identity map
    try:
        from sqlalchemy.orm import make_transient
        make_transient(cloned)
    except Exception:
        pass
    return cloned


def run_parameter_sensitivity(sim: Simulation) -> dict:
    """Run sensitivity analysis across key parameters.

    For each parameter, varies ±10% and ±20%, runs the calculation engine
    with patched values, and captures resulting profit/IRR/profit_pct.
    """
    # Run base calculation to get reference values
    base_results = run_calculations(sim)
    base_profit = base_results.get("expected_profit", base_results.get("profit", 0))
    base_irr = base_results.get("irr", 0)
    base_profit_pct = base_results.get("profit_percent", base_results.get("profitability_rate", 0))

    parameters = []

    for field, label, source in SENSITIVITY_PARAMS:
        # Get the base value from the appropriate parameter object
        if source == "planning":
            source_obj = sim.planning_parameters
        elif source == "cost":
            source_obj = sim.cost_parameters
        elif source == "revenue":
            source_obj = sim.revenue_parameters
        else:
            continue

        if source_obj is None:
            continue

        base_value = _safe(getattr(source_obj, field, None))
        if base_value == 0:
            continue

        variants = []
        for pct in CHANGE_PCTS:
            patched_value = base_value * (1 + pct / 100)

            # Create patched copies
            patched_pp = _clone_param(sim.planning_parameters)
            patched_cp = _clone_param(sim.cost_parameters)
            patched_rp = _clone_param(sim.revenue_parameters)

            # Apply the patch to the right parameter
            if source == "planning" and patched_pp:
                setattr(patched_pp, field, patched_value)
            elif source == "cost" and patched_cp:
                setattr(patched_cp, field, patched_value)
            elif source == "revenue" and patched_rp:
                setattr(patched_rp, field, patched_value)

            # Build a mock simulation-like object for the calculation engine
            mock_sim = copy.copy(sim)
            try:
                from sqlalchemy.orm import make_transient
                make_transient(mock_sim)
            except Exception:
                pass
            mock_sim.planning_parameters = patched_pp
            mock_sim.cost_parameters = patched_cp
            mock_sim.revenue_parameters = patched_rp

            try:
                variant_results = run_calculations(mock_sim)
                variant_profit = variant_results.get("expected_profit", variant_results.get("profit", 0))
                variant_irr = variant_results.get("irr", 0)
                variant_profit_pct = variant_results.get("profit_percent", variant_results.get("profitability_rate", 0))
            except Exception:
                variant_profit = 0
                variant_irr = 0
                variant_profit_pct = 0

            variants.append({
                "change_pct": pct,
                "value": round(patched_value, 2),
                "profit": round(variant_profit, 2),
                "irr": round(variant_irr, 2),
                "profit_pct": round(variant_profit_pct, 2),
            })

        parameters.append({
            "field": field,
            "label": label,
            "base_value": round(base_value, 2),
            "variants": variants,
        })

    return {
        "base_profit": round(base_profit, 2),
        "base_irr": round(base_irr, 2),
        "base_profit_pct": round(base_profit_pct, 2),
        "parameters": parameters,
    }
