/**
 * Agent 2: Research Agent — searches uploaded documents for missing field values.
 */
import { anthropic } from '../../../config/anthropic';
import { logger } from '../../../config/logger';

const RESEARCH_SYSTEM_PROMPT = `You are a research expert specialized in Israeli real estate feasibility documents.

You are given a list of MISSING fields that were not found during initial extraction,
along with all document texts from the simulation.

Your job is to carefully re-read ALL documents looking specifically for these missing values.
Look for:
- Direct mentions (e.g., "עלות בנייה: 8,500 ₪/מ"ר")
- Indirect references (values in tables, footnotes, appendices)
- Implied values (e.g., total cost / area = cost per sqm)
- Related data that can help derive the missing value

Return a JSON object with exactly this structure:
{
  "found_fields": {
    "field_name": value,
    ...
  },
  "still_missing": ["field_name1", "field_name2"],
  "sources": [
    {"field": "field_name", "quote": "exact text from document", "confidence": 0.85}
  ]
}

Only include fields you can confidently extract. Use the exact field names provided.`;

export async function researchMissingFields(
  missingFields: string[],
  documentTexts: Array<{ filename: string; text: string }>
): Promise<any> {
  if (missingFields.length === 0) {
    return { found_fields: {}, still_missing: [], sources: [] };
  }

  const docsText = documentTexts
    .map((d) => `=== ${d.filename} ===\n${d.text}`)
    .join('\n\n');

  const userMessage = `Missing fields to find:\n${missingFields.join('\n')}\n\nDocuments:\n${docsText}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0,
      system: RESEARCH_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return { found_fields: {}, still_missing: missingFields, sources: [] };
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonText = textBlock.text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonText = jsonMatch[1].trim();

    return JSON.parse(jsonText);
  } catch (err) {
    logger.error('Research agent failed', err);
    return { found_fields: {}, still_missing: missingFields, sources: [] };
  }
}
