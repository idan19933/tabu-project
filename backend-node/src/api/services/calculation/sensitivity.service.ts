/**
 * Per-parameter sensitivity analysis.
 * Varies individual parameters ±10%, ±20% and captures profit/IRR/profit_pct.
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

function cloneParam(obj: any): any {
  if (!obj) return null;
  return { ...obj };
}

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
