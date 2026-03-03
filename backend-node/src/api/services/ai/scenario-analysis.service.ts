/**
 * Agent 4: Alternatives Agent — generates 3 scenarios + optimization recommendations.
 */
import { anthropic } from '../../../config/anthropic';
import { logger } from '../../../config/logger';
import {
  extractParams,
  calcProposedState,
  calcBuildingProgram,
  calcCosts,
  calcRevenue,
  calcCashflowIrrNpv,
} from '../calculation.service';
import { safe } from '../../../utils/safe';
import type { SimParams } from '../../../types/simulation';

const OPTIMIZATION_SYSTEM_PROMPT = `You are a senior real estate investment advisor in Israel specializing in urban renewal (התחדשות עירונית).

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
Write descriptions in Hebrew.`;

function runScenarioCalc(params: SimParams) {
  const proposed = calcProposedState(params);
  const program = calcBuildingProgram(params, proposed);
  const costs = calcCosts(params, proposed, program);
  const rev = calcRevenue(params, proposed, program, costs);
  const financial = calcCashflowIrrNpv(params, proposed, costs, rev);

  return {
    profit: Math.round(rev.expectedProfit * 100) / 100,
    profitability_rate: Math.round(rev.profitPercent * 100) / 100,
    irr: Math.round(financial.irr * 100) / 100,
    npv: Math.round(financial.npv * 100) / 100,
    total_revenue: Math.round(rev.totalRevenue * 100) / 100,
    total_costs: Math.round(costs.totalCosts * 100) / 100,
  };
}

export async function generateAlternativeScenarios(sim: any): Promise<any> {
  try {
    const baseParams = extractParams(sim);

    // Base scenario
    const baseResults = runScenarioCalc(baseParams);

    // Conservative: +10% costs, -5% prices, -20% sales pace
    const conservativeParams: SimParams = {
      ...baseParams,
      costSqmRes: baseParams.costSqmRes * 1.1,
      costSqmService: baseParams.costSqmService * 1.1,
      costSqmCommercial: baseParams.costSqmCommercial * 1.1,
      costSqmBalcony: baseParams.costSqmBalcony * 1.1,
      costSqmDevelopment: baseParams.costSqmDevelopment * 1.1,
      priceSqmRes: baseParams.priceSqmRes * 0.95,
      priceSqmComm: baseParams.priceSqmComm * 0.95,
      salesPace: baseParams.salesPace > 0 ? baseParams.salesPace * 0.8 : 0,
    };
    const conservativeResults = runScenarioCalc(conservativeParams);

    // Optimistic: -5% costs, +10% prices, +20% sales pace
    const optimisticParams: SimParams = {
      ...baseParams,
      costSqmRes: baseParams.costSqmRes * 0.95,
      costSqmService: baseParams.costSqmService * 0.95,
      costSqmCommercial: baseParams.costSqmCommercial * 0.95,
      costSqmBalcony: baseParams.costSqmBalcony * 0.95,
      costSqmDevelopment: baseParams.costSqmDevelopment * 0.95,
      priceSqmRes: baseParams.priceSqmRes * 1.1,
      priceSqmComm: baseParams.priceSqmComm * 1.1,
      salesPace: baseParams.salesPace > 0 ? baseParams.salesPace * 1.2 : 0,
    };
    const optimisticResults = runScenarioCalc(optimisticParams);

    const scenarios = [
      { name: 'שמרני', name_en: 'Conservative', ...conservativeResults },
      { name: 'בסיס', name_en: 'Base', ...baseResults },
      { name: 'אופטימי', name_en: 'Optimistic', ...optimisticResults },
    ];

    // Get AI optimizations
    let optimizations: any[] = [];
    let analysisSummary = '';

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        temperature: 0.3,
        system: OPTIMIZATION_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Scenarios:\n${JSON.stringify(scenarios, null, 2)}\n\nBase parameters:\n${JSON.stringify({
            num_floors: baseParams.numFloors,
            returns_pct: baseParams.returnsPct * 100,
            avg_apt_size: baseParams.avgAptSize,
            cost_per_sqm: baseParams.costSqmRes,
            price_per_sqm: baseParams.priceSqmRes,
            financing_rate: baseParams.financingRate * 100,
            parking_ratio: baseParams.parkingRatio,
          }, null, 2)}`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        let jsonText = textBlock.text.trim();
        const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonText = jsonMatch[1].trim();

        const parsed = JSON.parse(jsonText);
        optimizations = parsed.optimizations || [];
        analysisSummary = parsed.analysis_summary || '';
      }
    } catch (err) {
      logger.error('AI optimization failed', err);
    }

    return {
      scenarios,
      optimizations,
      analysis_summary: analysisSummary,
    };
  } catch (err) {
    logger.error('Alternatives agent failed', err);
    return { scenarios: [], optimizations: [], error: (err as Error).message };
  }
}
