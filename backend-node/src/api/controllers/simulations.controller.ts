/**
 * @file simulations.controller.ts
 * @description Express route handlers for the full simulation lifecycle:
 * CRUD, AI pipeline orchestration, SSE streaming, financial calculation,
 * sensitivity analysis, delta analysis, scenario comparison, and report downloads.
 */

import { Request, Response, NextFunction } from 'express';
import * as simulationService from '../services/simulation.service';
import * as calculationService from '../services/calculation/calculation.service';
import * as sensitivityService from '../services/calculation/sensitivity.service';
import * as reportService from '../services/calculation/report.service';
import { getPipelineEvents } from '../services/pipeline.service';
import { param } from '../../utils/params';

/**
 * Handles GET /api/simulations/:id — returns a simulation with all relations loaded.
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends the full simulation detail as JSON.
 * @param next - Express next function, called on error (including 404).
 */
export async function getSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    res.json(sim);
  } catch (err) { next(err); }
}

/**
 * Handles PUT /api/simulations/:id — performs a full update of all simulation
 * parameter sections (planning, cost, revenue, economic, apartment mix).
 *
 * @param req - Express request; expects route param `id` and the full parameter payload in body.
 * @param res - Express response, sends the updated simulation as JSON.
 * @param next - Express next function, called on error.
 */
export async function updateSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.updateFull(param(req.params.id), req.body);
    res.json(sim);
  } catch (err) { next(err); }
}

/**
 * Handles POST /api/simulations/:id/clone — creates a deep copy of a simulation
 * including all parameter sections and apartment mix entries.
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends the cloned simulation with HTTP 201.
 * @param next - Express next function, called on error.
 */
export async function cloneSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.clone(param(req.params.id));
    res.status(201).json(sim);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/simulations/:id/review — returns the simulation for the
 * AI-extraction review step (same payload as getSimulation, semantic alias).
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends the full simulation detail as JSON.
 * @param next - Express next function, called on error.
 */
export async function reviewSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    res.json(sim);
  } catch (err) { next(err); }
}

/**
 * Handles PUT /api/simulations/:id/approve — transitions the simulation status
 * from `Pending_Review` to `Approved_For_Calc`.
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends the updated simulation as JSON.
 * @param next - Express next function, called on error.
 */
export async function approveSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.approve(param(req.params.id));
    res.json(sim);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/simulations/:id/validation — checks whether all required
 * fields are populated and returns a structured missing-fields report.
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends a `{ valid: boolean, missingFields: ... }` object.
 * @param next - Express next function, called on error.
 */
export async function validateSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    const validation = calculationService.validateSimulationReady(sim);
    res.json(validation);
  } catch (err) { next(err); }
}

/**
 * Handles POST /api/simulations/:id/calculate — runs the Shikun & Binui
 * financial engine and persists the results, transitioning status to `Completed`.
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends the updated simulation (with results) as JSON.
 * @param next - Express next function, called on error.
 */
export async function calculateSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.calculate(param(req.params.id));
    res.json(sim);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/simulations/:id/report/management — generates and streams
 * the Hebrew management summary XLSX report as a file download.
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends the XLSX buffer as an attachment.
 * @param next - Express next function, called on error.
 */
export async function downloadManagementReport(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req.params.id);
    const sim = await simulationService.getById(id);
    const buffer = await reportService.generateManagementReport(sim);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=management_report_${id}.xlsx`);
    res.send(buffer);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/simulations/:id/report/economic — generates and streams
 * the detailed economic feasibility XLSX report (includes sensitivity matrix).
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends the XLSX buffer as an attachment.
 * @param next - Express next function, called on error.
 */
export async function downloadEconomicReport(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req.params.id);
    const sim = await simulationService.getById(id);
    const buffer = await reportService.generateEconomicReport(sim);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=economic_report_${id}.xlsx`);
    res.send(buffer);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/simulations/:id/calculation-details — returns the intermediate
 * calculation breakdown (cost, revenue, and financial sections).
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends the calculation detail object as JSON.
 * @param next - Express next function, called on error.
 */
export async function getCalculationDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await simulationService.getCalculationDetails(param(req.params.id));
    res.json(result);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/simulations/:id/delta — returns the delta analysis comparing
 * AI-extracted values to the current user-edited parameter values.
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends the delta report as JSON.
 * @param next - Express next function, called on error.
 */
export async function getDeltaAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await simulationService.getDeltaAnalysis(param(req.params.id));
    res.json(result);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/simulations/:id/sensitivity — runs a 5×5 parameter sensitivity
 * matrix varying revenue and cost assumptions around the base case.
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends the sensitivity matrix as JSON.
 * @param next - Express next function, called on error.
 */
export async function getSensitivity(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    const result = sensitivityService.runParameterSensitivity(sim);
    res.json(result);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/simulations/:id/compare/:otherId — returns two simulations
 * side-by-side for scenario comparison.
 *
 * @param req - Express request; expects route params `id` and `otherId`.
 * @param res - Express response, sends `{ simulation_a, simulation_b }` as JSON.
 * @param next - Express next function, called on error.
 */
export async function compareSimulations(req: Request, res: Response, next: NextFunction) {
  try {
    const simA = await simulationService.getById(param(req.params.id));
    const simB = await simulationService.getById(param(req.params.otherId));
    res.json({ simulation_a: simA, simulation_b: simB });
  } catch (err) { next(err); }
}

/**
 * Handles POST /api/simulations/:id/run-pipeline — kicks off the 4-step AI agent
 * pipeline (Extract → Research → Calculate → Alternatives) asynchronously.
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends a `{ status, message }` acknowledgement as JSON.
 * @param next - Express next function, called on error.
 */
export async function triggerPipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await simulationService.triggerPipeline(param(req.params.id));
    res.json(result);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/simulations/:id/agent-stream — opens a Server-Sent Events
 * connection and polls in-memory pipeline events every 500 ms, writing
 * `agent_update` events and a final `pipeline_complete` event when done.
 *
 * @param req - Express request; expects route param `id` and optional query param `after`
 *   (event index to resume from, defaults to 0).
 * @param res - Express response configured as an SSE stream (Content-Type: text/event-stream).
 * @param next - Express next function, called on setup error.
 */
export async function agentStream(req: Request, res: Response, next: NextFunction) {
  try {
    const simId = param(req.params.id);
    const after = parseInt(String(req.query.after || '0')) || 0;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const interval = setInterval(() => {
      const events = getPipelineEvents(simId, after);
      for (const event of events) {
        res.write(`event: agent_update\ndata: ${JSON.stringify(event)}\n\n`);
      }

      const lastEvent = events[events.length - 1];
      const isFinalStep = lastEvent?.step === 'alternatives' || lastEvent?.step === 'pipeline';
      if (isFinalStep && (lastEvent?.status === 'completed' || lastEvent?.status === 'failed')) {
        res.write(`event: pipeline_complete\ndata: ${JSON.stringify(lastEvent)}\n\n`);
        clearInterval(interval);
        res.end();
      }
    }, 500);

    req.on('close', () => {
      clearInterval(interval);
    });
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/simulations/:id/missing-fields — alias for the validation
 * endpoint; returns the structured missing-fields report used by the UI.
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends a `{ valid: boolean, missingFields: ... }` object.
 * @param next - Express next function, called on error.
 */
export async function getMissingFields(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    const validation = calculationService.validateSimulationReady(sim);
    res.json(validation);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/simulations/:id/alternatives — returns the Conservative,
 * Base, and Optimistic scenario alternatives generated by the AI alternatives agent.
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends the alternatives array as JSON.
 * @param next - Express next function, called on error.
 */
export async function getAlternatives(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await simulationService.getAlternatives(param(req.params.id));
    res.json(result);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/simulations/:id/agent-status — returns the current per-step
 * agent status object (extraction, research, calculation, alternatives).
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends `{ agent_status: AgentStatus }` as JSON.
 * @param next - Express next function, called on error.
 */
export async function getAgentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    res.json({ agent_status: sim.agentStatus });
  } catch (err) { next(err); }
}
