/**
 * Agent 1: PDF Data Extraction using Anthropic SDK + forced tool use.
 * Supports tabu documents and planning/economic/general documents.
 */
import { anthropic } from '../../../config/anthropic';
import { logger } from '../../../config/logger';
import { ExtractionStatus } from '../../../../prisma/generated/prisma/client';
import { extractText } from '../../../utils/pdf';
import { extractedParametersSchema, extractedTabuDataSchema } from '../../schemas/extraction.schema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as documentDA from '../../data-access/document.data-access';
import * as projectDA from '../../data-access/project.data-access';

const TABU_SYSTEM_PROMPT = `You are an expert at extracting data from Israeli Tabu (נסח טאבו) land registry documents.
Extract all relevant property information including: block (גוש), parcel (חלקה), sub-parcel (תת-חלקה),
owners, rights, liens, mortgages, warnings (הערות אזהרה), area in sqm, and address.
Return structured JSON matching the schema provided.`;

const SMART_EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting real estate feasibility parameters from Hebrew documents.
You are also an expert at automatically detecting the document type.

STEP 1: Detect the document type:
- "tabu" — נסח טאבו / land registry document (contains block/parcel/owners/rights)
- "planning" — תב"ע / building plan (contains zoning, floors, coverage, building rights)
- "economic" — דוח כלכלי / economic report or appraisal (contains costs, prices, revenue)
- "general" — general feasibility document (may contain mixed data)

STEP 2: Extract ALL relevant fields based on detected type.`;

const PLANNING_SYSTEM_PROMPT = `You are an expert at extracting real estate feasibility parameters from Hebrew documents.
Extract planning parameters, cost parameters, revenue parameters, and apartment mix.

You must return a JSON object matching the schema provided via the tool.
Only include fields you can confidently extract. Set others to null.
If you find cost data, prefer placing it in the "cost" section with the specific field names.
If you find revenue/price data, prefer placing it in "revenue" section.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabuJsonSchema: any = zodToJsonSchema(extractedTabuDataSchema as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const paramsJsonSchema: any = zodToJsonSchema(extractedParametersSchema as any);

const TABU_TOOL = {
  name: 'extract_tabu_data' as const,
  description: 'Extract tabu (land registry) data from document',
  input_schema: tabuJsonSchema,
};

const PARAMS_TOOL = {
  name: 'extract_parameters' as const,
  description: 'Extract planning, cost, revenue parameters and apartment mix',
  input_schema: paramsJsonSchema,
};

async function extractTabu(text: string): Promise<any> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0,
    system: TABU_SYSTEM_PROMPT,
    tools: [TABU_TOOL],
    tool_choice: { type: 'tool', name: 'extract_tabu_data' },
    messages: [{ role: 'user', content: `Extract data from this Tabu document:\n\n${text}` }],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') throw new Error('No tool use in response');
  return toolUse.input;
}

async function extractParameters(text: string): Promise<any> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0,
    system: PLANNING_SYSTEM_PROMPT,
    tools: [PARAMS_TOOL],
    tool_choice: { type: 'tool', name: 'extract_parameters' },
    messages: [{ role: 'user', content: `Extract parameters from this document:\n\n${text}` }],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') throw new Error('No tool use in response');
  return toolUse.input;
}

async function detectDocType(text: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    temperature: 0,
    system: SMART_EXTRACTION_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Detect the document type. Reply ONLY with one of: tabu, planning, economic, general.\n\nDocument:\n${text.slice(0, 3000)}`,
    }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  const docType = textBlock && textBlock.type === 'text' ? textBlock.text.trim().toLowerCase() : 'general';
  return ['tabu', 'planning', 'economic', 'general'].includes(docType) ? docType : 'general';
}

export async function runDocumentExtraction(docId: string, projectId: string): Promise<any> {
  try {
    await documentDA.updateExtraction(docId, { extractionStatus: ExtractionStatus.Processing });

    const doc = await documentDA.findById(docId);
    if (!doc) throw new Error('Document not found');

    const text = await extractText(doc.filePath);
    if (!text.trim()) {
      await documentDA.updateExtraction(docId, {
        extractionStatus: ExtractionStatus.Failed,
        extractionError: 'Empty document — no text extracted',
      });
      return { success: false, error: 'Empty document' };
    }

    // Detect document type
    const docType = await detectDocType(text);
    await documentDA.updateExtraction(docId, { docType });

    let extractedData: any;

    if (docType === 'tabu') {
      const tabuData = await extractTabu(text);
      extractedData = { tabu: tabuData };

      // Save to project.tabu_data
      await projectDA.update(projectId, { tabuData });
    } else {
      const params = await extractParameters(text);
      extractedData = params;
    }

    await documentDA.updateExtraction(docId, {
      extractionStatus: ExtractionStatus.Completed,
      extractedData,
    });

    return { success: true, doc_type: docType, data: extractedData };
  } catch (err) {
    logger.error(`Extraction failed for doc ${docId}`, err);
    await documentDA.updateExtraction(docId, {
      extractionStatus: ExtractionStatus.Failed,
      extractionError: (err as Error).message,
    });
    return { success: false, error: (err as Error).message };
  }
}
