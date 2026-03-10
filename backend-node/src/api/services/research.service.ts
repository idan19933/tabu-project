/**
 * @module research.service
 * @description Handles the market-research lifecycle for a project: triggering the async
 * research pipeline, polling for results, previewing what would change in a simulation,
 * and non-destructively applying research data to simulation parameters.
 */
import * as projectDA from '../data-access/project.data-access';
import * as simulationDA from '../data-access/simulation.data-access';
import * as paramDA from '../data-access/parameter.data-access';
import { runMarketResearch } from './market-research.service';
import { HttpError } from '../../lib/HttpError';
import { logger } from '../../config/logger';
import { safe } from '../../utils/safe';

/**
 * Triggers the market research pipeline for a project asynchronously.
 * Sets `marketResearchStatus` to `'running'` immediately, then runs
 * {@link runMarketResearch} via `setImmediate` so the HTTP response is returned before work begins.
 * Saves the result or marks `'failed'` when the background task settles.
 *
 * @param projectId - The project to research.
 * @returns `{ status: 'running', project_id }` immediately.
 * @throws {HttpError} 404 if the project does not exist.
 * @throws {HttpError} 400 if the project has no tabu data (required to derive location).
 */
export async function triggerResearch(projectId: string) {
  const project = await projectDA.findById(projectId);
  if (!project) throw new HttpError(404, 'Project not found');
  if (!project.tabuData) throw new HttpError(400, 'No tabu data found. Upload tabu document first.');

  await projectDA.update(project.id, { marketResearchStatus: 'running' });

  setImmediate(() => {
    runMarketResearch(project.tabuData as any, project.id)
      .then((result) =>
        projectDA.update(project.id, {
          marketResearchData: result,
          marketResearchStatus: 'completed',
        })
      )
      .catch((err) => {
        logger.error('Market research failed', err);
        projectDA.update(project.id, { marketResearchStatus: 'failed' });
      });
  });

  return { status: 'running', project_id: project.id };
}

/**
 * Returns the current market research status and data for a project.
 *
 * @param projectId - The project to query.
 * @returns `{ status, data }` where `status` is one of `'running' | 'completed' | 'failed' | null`
 *          and `data` is the full research result payload (or `null` if not yet completed).
 * @throws {HttpError} 404 if the project does not exist.
 */
export async function getResearch(projectId: string) {
  const project = await projectDA.findById(projectId);
  if (!project) throw new HttpError(404, 'Project not found');
  return {
    status: project.marketResearchStatus,
    data: project.marketResearchData,
  };
}

/**
 * Returns a preview of the fields that market research would add to a simulation
 * without modifying any data. Only fields that are currently `null` (planning) or
 * `0` (cost/revenue, via `safe()`) in the simulation are included in the diff.
 *
 * @param projectId - The project that owns the research data.
 * @param simulationId - The simulation to diff against.
 * @returns `{ preview: { planning?, cost?, revenue? } }` — each section contains only
 *          the fields that research would populate.
 * @throws {HttpError} 404 if project, research data, or simulation cannot be found.
 */
export async function previewResearch(projectId: string, simulationId: string) {
  const project = await projectDA.findById(projectId);
  if (!project) throw new HttpError(404, 'Project not found');
  if (!project.marketResearchData) throw new HttpError(404, 'No research data available');

  const sim = await simulationDA.findById(simulationId);
  if (!sim) throw new HttpError(404, 'Simulation not found');

  const research = project.marketResearchData as any;
  const diff: any = {};

  if (research.planning_parameters && sim.planningParameters) {
    diff.planning = {};
    for (const [key, val] of Object.entries(research.planning_parameters)) {
      if (val != null && (sim.planningParameters as any)[key] == null) {
        diff.planning[key] = val;
      }
    }
  }

  if (research.cost_parameters && sim.costParameters) {
    diff.cost = {};
    for (const [key, val] of Object.entries(research.cost_parameters)) {
      if (val != null && safe((sim.costParameters as any)[key]) === 0) {
        diff.cost[key] = val;
      }
    }
  }

  if (research.revenue_parameters && sim.revenueParameters) {
    diff.revenue = {};
    for (const [key, val] of Object.entries(research.revenue_parameters)) {
      if (val != null && safe((sim.revenueParameters as any)[key]) === 0) {
        diff.revenue[key] = val;
      }
    }
  }

  return { preview: diff };
}

/**
 * Non-destructively applies market research parameters to a simulation.
 * Only null / zero fields are filled — existing values are never overwritten.
 * Apartment mix is applied only when the simulation has no mix entries yet.
 *
 * @param projectId - The project that owns the research data.
 * @param simulationId - The simulation to update.
 * @returns `{ applied_count }` — the total number of fields/rows written.
 * @throws {HttpError} 404 if project, research data, or simulation cannot be found.
 */
export async function applyResearch(projectId: string, simulationId: string) {
  const project = await projectDA.findById(projectId);
  if (!project) throw new HttpError(404, 'Project not found');
  if (!project.marketResearchData) throw new HttpError(404, 'No research data available');

  const sim = await simulationDA.findById(simulationId);
  if (!sim) throw new HttpError(404, 'Simulation not found');

  const research = project.marketResearchData as any;
  let appliedCount = 0;

  if (research.planning_parameters) {
    const updates: any = {};
    const current = sim.planningParameters || {};
    for (const [key, val] of Object.entries(research.planning_parameters)) {
      if (val != null && (current as any)[key] == null) {
        updates[key] = val;
        appliedCount++;
      }
    }
    if (Object.keys(updates).length > 0) {
      await paramDA.upsertPlanning(sim.id, updates);
    }
  }

  if (research.cost_parameters) {
    const updates: any = {};
    const current = sim.costParameters || {};
    for (const [key, val] of Object.entries(research.cost_parameters)) {
      if (val != null && safe((current as any)[key]) === 0) {
        updates[key] = val;
        appliedCount++;
      }
    }
    if (Object.keys(updates).length > 0) {
      await paramDA.upsertCost(sim.id, updates);
    }
  }

  if (research.revenue_parameters) {
    const updates: any = {};
    const current = sim.revenueParameters || {};
    for (const [key, val] of Object.entries(research.revenue_parameters)) {
      if (val != null && safe((current as any)[key]) === 0) {
        updates[key] = val;
        appliedCount++;
      }
    }
    if (Object.keys(updates).length > 0) {
      await paramDA.upsertRevenue(sim.id, updates);
    }
  }

  if (research.apartment_mix && sim.apartmentMix.length === 0) {
    await paramDA.replaceApartmentMix(sim.id, research.apartment_mix);
    appliedCount += research.apartment_mix.length;
  }

  return { applied_count: appliedCount };
}
