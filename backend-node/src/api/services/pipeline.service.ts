/**
 * Orchestrator: Coordinates the 4-step agent pipeline with SSE streaming.
 * Extract → Research → Calculate → Alternatives
 */
import { logger } from '../../config/logger';
import { prisma } from '../../config/prisma';
import { SimulationStatus } from '../../../prisma/generated/prisma/client';
import { runDocumentExtraction } from './document-extraction.service';
import { researchMissingFields } from './missing-field-research.service';
import { runCalculationReview } from './calculation-review.service';
import { generateAlternativeScenarios } from './scenario-analysis.service';
import { validateSimulationReady } from './calculation/calculation.service';
import { extractText } from '../../utils/pdf';
import * as paramDA from '../data-access/parameter.data-access';
import * as simulationDA from '../data-access/simulation.data-access';
import type { AgentEvent, AgentStatus } from '../../types/agent';

// In-memory SSE event store
const agentStreams = new Map<string, AgentEvent[]>();

export function getPipelineEvents(simId: string, after = 0): AgentEvent[] {
  const events = agentStreams.get(simId) || [];
  return events.filter((e) => e.index > after);
}

async function updateAgentStatus(
  simId: string,
  step: string,
  status: 'running' | 'completed' | 'failed',
  details?: any
) {
  // Update DB
  const sim = await prisma.simulation.findUnique({ where: { id: simId } });
  if (!sim) return;

  const agentStatus = (sim.agentStatus as AgentStatus) || {};
  (agentStatus as any)[step] = { status, details };

  await prisma.simulation.update({
    where: { id: simId },
    data: { agentStatus: agentStatus as any },
  });

  // Push SSE event
  const events = agentStreams.get(simId) || [];
  events.push({
    step,
    status,
    details,
    timestamp: Date.now(),
    index: events.length + 1,
  });
  agentStreams.set(simId, events);
}

async function runExtractionStep(simId: string) {
  await updateAgentStatus(simId, 'extraction', 'running');

  const sim = await simulationDA.findById(simId);
  if (!sim) throw new Error('Simulation not found');

  const docs = await prisma.document.findMany({
    where: { projectId: sim.projectId },
  });

  for (const doc of docs) {
    if (doc.extractionStatus === 'Completed' && doc.extractedData) continue;
    try {
      await runDocumentExtraction(doc.id, sim.projectId);
    } catch (err) {
      logger.error(`Extraction failed for doc ${doc.id}`, err);
    }
  }

  await updateAgentStatus(simId, 'extraction', 'completed', {
    documents_processed: docs.length,
  });
}

async function runResearchStep(simId: string) {
  await updateAgentStatus(simId, 'research', 'running');

  const sim = await simulationDA.findById(simId);
  if (!sim) throw new Error('Simulation not found');

  const validation = validateSimulationReady(sim);
  const missingFields = [
    ...validation.missing_planning,
    ...validation.missing_cost,
    ...validation.missing_revenue,
  ];

  if (missingFields.length === 0) {
    await updateAgentStatus(simId, 'research', 'completed', { message: 'No missing fields' });
    return;
  }

  // Get document texts
  const docs = await prisma.document.findMany({
    where: { projectId: sim.projectId },
  });

  const documentTexts: Array<{ filename: string; text: string }> = [];
  for (const doc of docs) {
    try {
      const text = await extractText(doc.filePath);
      documentTexts.push({ filename: doc.filePath, text });
    } catch {
      logger.warn(`Could not extract text from ${doc.filePath}`);
    }
  }

  if (documentTexts.length === 0) {
    await updateAgentStatus(simId, 'research', 'completed', { message: 'No documents to search' });
    return;
  }

  const result = await researchMissingFields(missingFields, documentTexts);

  // Apply found fields
  if (result.found_fields && Object.keys(result.found_fields).length > 0) {
    await applyFoundFields(simId, result.found_fields);
  }

  await updateAgentStatus(simId, 'research', 'completed', {
    found: Object.keys(result.found_fields || {}).length,
    still_missing: result.still_missing?.length || 0,
  });
}

async function applyFoundFields(simId: string, foundFields: Record<string, any>) {
  const planningFields: any = {};
  const costFields: any = {};
  const revenueFields: any = {};

  for (const [field, value] of Object.entries(foundFields)) {
    if (value == null) continue;
    // Route to correct parameter table based on field name
    if (['returnsPercent', 'multiplierFar', 'avgAptSizeSqm', 'numberOfFloors', 'coverageAboveGround',
         'grossAreaPerParking', 'parkingStandardRatio', 'blueLineArea'].includes(field)) {
      planningFields[field] = value;
    } else if (['costPerSqmResidential', 'constructionDurationMonths', 'financingInterestRate'].includes(field)) {
      costFields[field] = value;
    } else if (['pricePerSqmResidential', 'pricePerSqmCommercial'].includes(field)) {
      revenueFields[field] = value;
    }
  }

  if (Object.keys(planningFields).length > 0) await paramDA.upsertPlanning(simId, planningFields);
  if (Object.keys(costFields).length > 0) await paramDA.upsertCost(simId, costFields);
  if (Object.keys(revenueFields).length > 0) await paramDA.upsertRevenue(simId, revenueFields);
}

async function runCalculationStep(simId: string) {
  await updateAgentStatus(simId, 'calculation', 'running');

  const sim = await simulationDA.findById(simId);
  if (!sim) throw new Error('Simulation not found');

  const result = await runCalculationReview(sim);

  if (result.success && result.results) {
    await paramDA.upsertResults(simId, {
      ...result.results,
      aiValidationNotes: result.ai_validation_notes,
    });
    await simulationDA.updateStatus(simId, SimulationStatus.Completed);
  }

  await updateAgentStatus(simId, 'calculation', result.success ? 'completed' : 'failed', {
    profit: result.results?.profit,
    irr: result.results?.irr,
  });
}

async function runAlternativesStep(simId: string) {
  await updateAgentStatus(simId, 'alternatives', 'running');

  const sim = await simulationDA.findById(simId);
  if (!sim) throw new Error('Simulation not found');

  const result = await generateAlternativeScenarios(sim);

  if (result.scenarios) {
    await paramDA.upsertResults(simId, {
      scenarios: result.scenarios,
      optimizations: result.optimizations,
    });
  }

  await updateAgentStatus(simId, 'alternatives', 'completed', {
    scenarios_count: result.scenarios?.length || 0,
    optimizations_count: result.optimizations?.length || 0,
  });
}

export async function runSimulationPipeline(simId: string): Promise<any> {
  agentStreams.set(simId, []);

  try {
    await simulationDA.updateStatus(simId, SimulationStatus.AI_Extracting);

    // Step 1: Extraction
    await runExtractionStep(simId);

    // Step 2: Research
    await runResearchStep(simId);

    // Step 3: Calculation
    await runCalculationStep(simId);

    // Step 4: Alternatives
    await runAlternativesStep(simId);

    return { status: 'completed', simulation_id: simId };
  } catch (err) {
    logger.error('Pipeline failed', err);
    const events = agentStreams.get(simId) || [];
    events.push({
      step: 'pipeline',
      status: 'failed',
      details: { error: (err as Error).message },
      timestamp: Date.now(),
      index: events.length + 1,
    });
    agentStreams.set(simId, events);
    throw err;
  }
}
