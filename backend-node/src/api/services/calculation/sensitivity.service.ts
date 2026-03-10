/**
 * @module sensitivity.service
 * Per-parameter sensitivity analysis for urban-renewal simulations.
 *
 * Varies each of the eight key input parameters by ±10% and ±20% relative to
 * its base value, re-runs the full calculation engine for each variant, and
 * captures the resulting profit, IRR, and profit percentage.
 *
 * The output drives the sensitivity tornado chart on the frontend.
 */
import { runCalculations } from './calculation.service';
import { safe } from '../../../utils/safe';

const SENSITIVITY_PARAMS: Array<[string, string, string]> = [
  ['numberOfFloors', 'מספר קומות', 'planning'],
  ['returnsPercent', '% החזר', 'planning'],
  ['costPerSqmResidential', 'עלות בנייה (₪/מ"ר)', 'cost'],
  ['pricePerSqmResidential', 'מחיר מגורים (₪/מ"ר)', 'revenue'],
  ['financingInterestRate', 'ריבית מימון (%)', 'cost'],
  ['coverageAboveGround', '% כיסוי עילי', 'planning'],
  ['avgAptSizeSqm', 'שטח דירה ממוצע (מ"ר)', 'planning'],
  ['parkingStandardRatio', 'יחס חנייה', 'planning'],
];

const CHANGE_PCTS = [-20, -10, 10, 20];

/**
 * Shallow-clone a parameter object so the original simulation is never mutated during analysis.
 *
 * @param obj - Any parameter record (planning, cost, or revenue).
 * @returns A shallow copy of `obj`, or `null` if the input is falsy.
 */
function cloneParam(obj: any): any {
  if (!obj) return null;
  return { ...obj };
}

/**
 * Run per-parameter sensitivity analysis across eight key simulation inputs.
 *
 * For each parameter in `SENSITIVITY_PARAMS`, the function:
 *  1. Records the base value.
 *  2. Creates four variants (−20%, −10%, +10%, +20% of base).
 *  3. Runs the full calculation engine for each variant.
 *  4. Collects `profit`, `irr`, and `profit_pct` for each variant.
 *
 * Parameters with a base value of 0 are skipped to avoid division-by-zero artefacts.
 * If the calculation engine throws for a variant, zeros are recorded for that entry.
 *
 * @param sim - A full Prisma simulation record with all parameter relations loaded.
 * @returns An object with `base_profit`, `base_irr`, `base_profit_pct`, and a `parameters`
 *   array — one entry per input, each containing the base value and four variant results.
 */
export function runParameterSensitivity(sim: any): any {
  const baseResults = runCalculations(sim);
  const baseProfit = baseResults.expectedProfit ?? baseResults.profit ?? 0;
  const baseIrr = baseResults.irr ?? 0;
  const baseProfitPct = baseResults.profitPercent ?? baseResults.profitabilityRate ?? 0;

  const parameters: any[] = [];

  for (const [field, label, source] of SENSITIVITY_PARAMS) {
    let sourceObj: any;
    if (source === 'planning') sourceObj = sim.planningParameters;
    else if (source === 'cost') sourceObj = sim.costParameters;
    else if (source === 'revenue') sourceObj = sim.revenueParameters;
    else continue;

    if (!sourceObj) continue;

    const baseValue = safe(sourceObj[field]);
    if (baseValue === 0) continue;

    const variants: any[] = [];
    for (const pct of CHANGE_PCTS) {
      const patchedValue = baseValue * (1 + pct / 100);

      const patchedPp = cloneParam(sim.planningParameters);
      const patchedCp = cloneParam(sim.costParameters);
      const patchedRp = cloneParam(sim.revenueParameters);

      if (source === 'planning' && patchedPp) patchedPp[field] = patchedValue;
      else if (source === 'cost' && patchedCp) patchedCp[field] = patchedValue;
      else if (source === 'revenue' && patchedRp) patchedRp[field] = patchedValue;

      const mockSim = {
        ...sim,
        planningParameters: patchedPp,
        costParameters: patchedCp,
        revenueParameters: patchedRp,
      };

      try {
        const vr = runCalculations(mockSim);
        variants.push({
          change_pct: pct,
          value: Math.round(patchedValue * 100) / 100,
          profit: Math.round((vr.expectedProfit ?? vr.profit ?? 0) * 100) / 100,
          irr: Math.round((vr.irr ?? 0) * 100) / 100,
          profit_pct: Math.round((vr.profitPercent ?? vr.profitabilityRate ?? 0) * 100) / 100,
        });
      } catch {
        variants.push({ change_pct: pct, value: Math.round(patchedValue * 100) / 100, profit: 0, irr: 0, profit_pct: 0 });
      }
    }

    parameters.push({
      field,
      label,
      base_value: Math.round(baseValue * 100) / 100,
      variants,
    });
  }

  return {
    base_profit: Math.round(baseProfit * 100) / 100,
    base_irr: Math.round(baseIrr * 100) / 100,
    base_profit_pct: Math.round(baseProfitPct * 100) / 100,
    parameters,
  };
}
