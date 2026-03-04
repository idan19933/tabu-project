/**
 * Agent: Financial Agent — direct calculation wrapper.
 */
import { logger } from '../../../config/logger';
import { runCalculations } from '../calculation.service';

export function runFinancialCalculation(sim: any): any {
  const results = runCalculations(sim);

  logger.info('Agentic calculation results', {
    profit: results.profit,
    profitabilityRate: results.profitabilityRate,
    irr: results.irr,
    npv: results.npv,
  });

  return results;
}
