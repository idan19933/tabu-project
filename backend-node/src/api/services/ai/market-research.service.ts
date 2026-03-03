/**
 * Agent: Market Research — 5-step location-based research using Anthropic web_search tool.
 *
 * Pipeline:
 * 1. Identify location from tabu data (gush/chelka → address → neighborhood)
 * 2. Look up zoning and applicable plans
 * 3. Search construction costs in the area
 * 4. Search sales prices in the area
 * 5. Calculate feasible parameters (pure math + validation)
 */
import { anthropic } from '../../../config/anthropic';
import { logger } from '../../../config/logger';
import { safe } from '../../../utils/safe';

// Locked fields from tabu — never overwritten
const LOCKED_FIELDS = ['blue_line_area', 'existing_units', 'existing_area', 'floors_existing'];

async function searchWithClaude(query: string, systemPrompt: string): Promise<any> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0,
      system: systemPrompt,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 3,
      }],
      messages: [{ role: 'user', content: query }],
    });

    // Extract text from response
    const textBlocks = response.content.filter((b) => b.type === 'text');
    const fullText = textBlocks.map((b) => b.type === 'text' ? b.text : '').join('\n');

    // Try to parse JSON
    let jsonText = fullText.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonText = jsonMatch[1].trim();

    try {
      return JSON.parse(jsonText);
    } catch {
      return { raw_text: fullText };
    }
  } catch (err) {
    logger.error('Web search failed', err);
    return null;
  }
}

async function step1IdentifyLocation(tabuData: any): Promise<any> {
  const gush = tabuData.block || '';
  const chelka = tabuData.parcel || '';
  const address = tabuData.address || '';

  const query = `חפש את הכתובת והשכונה עבור גוש ${gush} חלקה ${chelka}${address ? ` (כתובת: ${address})` : ''}.
החזר JSON: {"address": "...", "neighborhood": "...", "city": "...", "district": "..."}`;

  const result = await searchWithClaude(query,
    'You are a location expert for Israeli real estate. Find the exact address and neighborhood for the given property. Return JSON.');

  return result || { address, neighborhood: '', city: '', district: '' };
}

async function step2LookupZoning(location: any): Promise<any> {
  const query = `חפש תוכניות בנין עיר (תב"ע) עבור ${location.address || location.neighborhood || ''}, ${location.city || ''}.
מה זכויות הבנייה? FAR? מספר קומות מותר? שימור?
החזר JSON: {"plans": [...], "max_floors": null, "far": null, "conservation": false}`;

  return await searchWithClaude(query,
    'You are an Israeli urban planning expert. Search for applicable building plans and zoning. Return JSON.');
}

async function step3SearchCosts(location: any): Promise<any> {
  const query = `חפש עלויות בנייה עדכניות באזור ${location.neighborhood || location.city || 'ישראל'}.
כמה עולה בנייה למ"ר? היטל השבחה? ריבית מימון נהוגה?
החזר JSON: {"cost_per_sqm_residential": null, "betterment_levy_per_unit": null, "financing_rate": null}`;

  return await searchWithClaude(query,
    'You are an Israeli construction cost expert. Search for current construction costs. Return JSON with numbers.');
}

async function step4SearchPrices(location: any): Promise<any> {
  const query = `חפש מחירי מכירה עדכניים עבור דירות חדשות באזור ${location.neighborhood || location.city || 'ישראל'}.
כמה עולה מ"ר מגורים? מסחרי? חנייה? מחסן?
החזר JSON: {"price_per_sqm_residential": null, "price_per_sqm_commercial": null, "price_per_sqm_parking": null, "price_per_sqm_storage": null}`;

  return await searchWithClaude(query,
    'You are an Israeli real estate pricing expert. Search for current sale prices for new construction. Return JSON with numbers.');
}

function step5GenerateParameters(
  tabuData: any,
  location: any,
  zoning: any,
  costs: any,
  prices: any
): any {
  const blueLineArea = safe(tabuData.area_sqm);

  // Planning parameters
  const planningParameters: any = {
    returns_percent: 35,
    avg_apt_size_sqm: 100,
    number_of_floors: safe(zoning?.max_floors) || 8,
    coverage_above_ground: 40,
    coverage_underground: 60,
    gross_area_per_parking: 35,
    parking_standard_ratio: 1.5,
    service_area_percent: 15,
    balcony_area_per_unit: 12,
  };

  if (blueLineArea > 0) {
    planningParameters.blue_line_area = blueLineArea;
  }

  // Cost parameters
  const costParameters: any = {
    cost_per_sqm_residential: safe(costs?.cost_per_sqm_residential) || 8500,
    construction_duration_months: 36,
    financing_interest_rate: safe(costs?.financing_rate) || 5.5,
    vat_rate: 17,
  };

  if (safe(costs?.betterment_levy_per_unit) > 0) {
    costParameters.betterment_levy = costs.betterment_levy_per_unit;
  }

  // Revenue parameters
  const revenueParameters: any = {
    price_per_sqm_residential: safe(prices?.price_per_sqm_residential) || 25000,
    price_per_sqm_commercial: safe(prices?.price_per_sqm_commercial) || 15000,
  };

  if (safe(prices?.price_per_sqm_parking) > 0) {
    revenueParameters.price_per_sqm_parking = prices.price_per_sqm_parking;
  }
  if (safe(prices?.price_per_sqm_storage) > 0) {
    revenueParameters.price_per_sqm_storage = prices.price_per_sqm_storage;
  }

  // Default apartment mix
  const apartmentMix = [
    { apartment_type: '3_rooms', quantity: 20, percentage_of_mix: 25 },
    { apartment_type: '4_rooms', quantity: 30, percentage_of_mix: 37.5 },
    { apartment_type: '5_rooms', quantity: 20, percentage_of_mix: 25 },
    { apartment_type: 'penthouse', quantity: 10, percentage_of_mix: 12.5 },
  ];

  // Validate and fix
  if (revenueParameters.price_per_sqm_residential < revenueParameters.price_per_sqm_commercial) {
    revenueParameters.price_per_sqm_commercial = revenueParameters.price_per_sqm_residential * 0.6;
  }

  if (planningParameters.returns_percent < 20) planningParameters.returns_percent = 20;
  if (planningParameters.returns_percent > 45) planningParameters.returns_percent = 45;

  return {
    planning_parameters: planningParameters,
    cost_parameters: costParameters,
    revenue_parameters: revenueParameters,
    apartment_mix: apartmentMix,
    research_summary: { location, zoning, costs, prices },
    data_sources: {
      location: 'web_search',
      zoning: 'web_search',
      costs: 'web_search',
      prices: 'web_search',
    },
    _metadata: {
      confidence: {
        location: location?.address ? 0.8 : 0.3,
        costs: safe(costs?.cost_per_sqm_residential) > 0 ? 0.7 : 0.4,
        prices: safe(prices?.price_per_sqm_residential) > 0 ? 0.7 : 0.4,
      },
    },
  };
}

export async function runMarketResearch(tabuData: any, projectId: string): Promise<any> {
  logger.info(`Starting market research for project ${projectId}`);

  try {
    // Step 1: Identify location
    const location = await step1IdentifyLocation(tabuData);
    logger.info('Step 1 complete: location identified', location);

    // Step 2: Lookup zoning
    const zoning = await step2LookupZoning(location);
    logger.info('Step 2 complete: zoning looked up');

    // Step 3: Search costs
    const costs = await step3SearchCosts(location);
    logger.info('Step 3 complete: costs searched');

    // Step 4: Search prices
    const prices = await step4SearchPrices(location);
    logger.info('Step 4 complete: prices searched');

    // Step 5: Generate parameters
    const result = step5GenerateParameters(tabuData, location, zoning, costs, prices);
    logger.info('Step 5 complete: parameters generated');

    return result;
  } catch (err) {
    logger.error('Market research failed', err);
    // Return defaults on failure
    return step5GenerateParameters(tabuData, {}, null, null, null);
  }
}
