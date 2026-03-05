/**
 * Agent 3: Calculation Agent — runs financial calculations + AI validation.
 */
import { anthropic } from '../../config/anthropic';
import { logger } from '../../config/logger';
import { runCalculations, validateSimulationReady } from './calculation/calculation.service';

const VALIDATION_SYSTEM_PROMPT = `You are a senior real estate financial analyst in Israel.

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
}`;

async function validateResultsWithAI(results: any): Promise<any> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      temperature: 0,
      system: VALIDATION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Review these calculation results:\n${JSON.stringify({
          profit: results.profit,
          profitability_rate: results.profitabilityRate,
          irr: results.irr,
          npv: results.npv,
          total_revenue: results.totalRevenue,
          total_costs: results.totalCosts,
          total_units: results.totalUnits,
          developer_units: results.developerUnits,
        }, null, 2)}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return null;

    let jsonText = textBlock.text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonText = jsonMatch[1].trim();

    return JSON.parse(jsonText);
  } catch (err) {
    logger.error('AI validation failed', err);
    return null;
  }
}

export async function runCalculationReview(sim: any): Promise<any> {
  // Step 1: Validate inputs
  const validation = validateSimulationReady(sim);
  if (!validation.ready) {
    return {
      success: false,
      error: 'Simulation not ready for calculation',
      validation,
    };
  }

  // Step 2: Run calculations
  try {
    const results = runCalculations(sim);

    // Step 3: AI validation
    const aiValidation = await validateResultsWithAI(results);

    const validationNotes = aiValidation
      ? `${aiValidation.summary || ''}\n${(aiValidation.concerns || []).join('\n')}`
      : '';

    return {
      success: true,
      results,
      ai_validation_notes: validationNotes,
      ai_validation: aiValidation,
    };
  } catch (err) {
    logger.error('Calculation agent failed', err);
    return { success: false, error: (err as Error).message };
  }
}
