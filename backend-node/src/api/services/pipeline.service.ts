/**
 * @module pipeline.service
 * @description Orchestrates the 4-step agent pipeline (Extract → Research → Calculate → Alternatives)
 * with SSE event streaming. Maintains an in-memory event store keyed by simulation ID.
 */
import { logger } from '../../config/logger';
import { prisma } from '../../config/prisma';
import { SimulationStatus } from '../../../prisma/generated/prisma/client';
import { runDocumentExtraction } from './document-extraction.service';
import { researchMissingFields } from './missing-field-research.service';
import { runCalculationReview } from './calculation-review.service';
import { generateAlternativeScenarios } from './scenario-analysis.service';
import { validateSimulationReady } from './calculation/calculation.service';
import * as paramDA from '../data-access/parameter.data-access';
import * as simulationDA from '../data-access/simulation.data-access';
import type { AgentEvent, AgentStatus } from '../../types/agent';

// In-memory SSE event store
const agentStreams = new Map<string, AgentEvent[]>();

/**
 * Returns pipeline SSE events for a simulation that occurred after the given index.
 * Used by the SSE endpoint to stream only new events to connected clients.
 *
 * @param simId - The simulation ID.
 * @param after - Return only events with an index greater than this value (default 0).
 * @returns Array of {@link AgentEvent} objects emitted after the specified index.
 */
export function getPipelineEvents(simId: string, after = 0): AgentEvent[] {
  const events = agentStreams.get(simId) || [];
  return events.filter((e) => e.index > after);
}

/**
 * Persists an agent step status update to the database and appends a new SSE event
 * to the in-memory event store for the simulation.
 *
 * @param simId - The simulation ID.
 * @param step - The pipeline step name (e.g. 'extraction', 'research').
 * @param status - Current status of the step.
 * @param details - Optional arbitrary metadata to attach to the event.
 */
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

/**
 * Pipeline step 1: Runs document extraction for all unprocessed documents
 * belonging to the simulation's project.
 *
 * @param simId - The simulation ID.
 * @throws If the simulation cannot be found.
 */
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

/**
 * Pipeline step 2: Identifies missing simulation fields and attempts to fill them
 * by re-reading the uploaded document texts via the research agent.
 *
 * @param simId - The simulation ID.
 * @throws If the simulation cannot be found.
 */
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
    if (doc.extractedText) {
      documentTexts.push({ filename: doc.id, text: doc.extractedText });
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

/**
 * Routes AI-discovered field values to the correct parameter table
 * (planning, cost, or revenue) and persists them via upsert.
 *
 * @param simId - The simulation ID.
 * @param foundFields - Map of field names to their discovered values.
 */
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

/**
 * Pipeline step 3: Runs the financial calculation engine, then passes the results
 * through AI validation. Saves results and transitions simulation to Completed on success.
 *
 * @param simId - The simulation ID.
 * @throws If the simulation cannot be found.
 */
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

/**
 * Pipeline step 4: Generates Conservative/Base/Optimistic scenarios and
 * AI optimization recommendations, then persists them to the simulation results.
 *
 * @param simId - The simulation ID.
 * @throws If the simulation cannot be found.
 */
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

/**
 * Runs the full 4-step agent pipeline for a simulation.
 * Initialises the in-memory SSE event store, transitions the simulation status
 * to AI_Extracting, then executes each step sequentially.
 * On failure, a pipeline-level error event is pushed to the event store.
 *
 * @param simId - The ID of the simulation to process.
 * @returns An object containing `{ status: 'completed', simulation_id }` on success.
 * @throws Re-throws any unhandled pipeline error after recording it in the event store.
 */
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
