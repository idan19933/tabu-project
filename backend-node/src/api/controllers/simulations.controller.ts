import { Request, Response, NextFunction } from 'express';
import { SimulationStatus } from '../../../prisma/generated/prisma/client';
import * as simulationService from '../services/simulation.service';
import * as calculationService from '../services/calculation.service';
import * as sensitivityService from '../services/sensitivity.service';
import * as reportService from '../services/report.service';
import { HttpError } from '../../lib/HttpError';
import { logger } from '../../config/logger';
import { runSimulationPipeline, getPipelineEvents } from '../services/pipeline.service';
import { param } from '../../utils/params';

export async function getSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    res.json(sim);
  } catch (err) { next(err); }
}

export async function updateSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.updateFull(param(req.params.id), req.body);
    res.json(sim);
  } catch (err) { next(err); }
}

export async function cloneSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.clone(param(req.params.id));
    res.status(201).json(sim);
  } catch (err) { next(err); }
}

export async function reviewSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    res.json(sim);
  } catch (err) { next(err); }
}

export async function approveSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.setStatus(param(req.params.id), SimulationStatus.Approved_For_Calc);
    res.json(sim);
  } catch (err) { next(err); }
}

export async function validateSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    const validation = calculationService.validateSimulationReady(sim);
    res.json(validation);
  } catch (err) { next(err); }
}

export async function calculateSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req.params.id);
    const sim = await simulationService.getById(id);
    const results = calculationService.runCalculations(sim);
    const updated = await simulationService.saveResults(id, results);
    await simulationService.setStatus(id, SimulationStatus.Completed);
    res.json(updated);
  } catch (err) { next(err); }
}

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

export async function getCalculationDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    if (!sim.simulationResults) throw new HttpError(404, 'No calculation results found');
    res.json(sim.simulationResults);
  } catch (err) { next(err); }
}

export async function getDeltaAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    if (!sim.simulationResults) throw new HttpError(404, 'No results for delta analysis');

    const current = sim.simulationResults;
    const previous = current.previousResultsSnapshot as any;
    if (!previous) {
      res.json({ message: 'No previous results to compare', delta: null });
      return;
    }

    const delta: any = {};
    const keys = ['profit', 'irr', 'npv', 'totalRevenue', 'totalCosts', 'profitabilityRate'];
    for (const key of keys) {
      const cur = Number((current as any)[key]) || 0;
      const prev = Number(previous[key]) || 0;
      delta[key] = {
        current: cur,
        previous: prev,
        change_absolute: cur - prev,
        change_pct: prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : 0,
      };
    }
    res.json({ delta });
  } catch (err) { next(err); }
}

export async function getSensitivity(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    const result = sensitivityService.runParameterSensitivity(sim);
    res.json(result);
  } catch (err) { next(err); }
}

export async function compareSimulations(req: Request, res: Response, next: NextFunction) {
  try {
    const simA = await simulationService.getById(param(req.params.id));
    const simB = await simulationService.getById(param(req.params.otherId));
    res.json({ simulation_a: simA, simulation_b: simB });
  } catch (err) { next(err); }
}

export async function triggerPipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const simId = param(req.params.id);
    await simulationService.getById(simId);

    setImmediate(() => {
      runSimulationPipeline(simId).catch((err) => logger.error('Pipeline failed', err));
    });

    res.json({ status: 'pipeline_started', simulation_id: simId });
  } catch (err) { next(err); }
}

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
      if (lastEvent?.status === 'completed' || lastEvent?.status === 'failed') {
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

export async function getMissingFields(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    const validation = calculationService.validateSimulationReady(sim);
    res.json(validation);
  } catch (err) { next(err); }
}

export async function getAlternatives(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    if (!sim.simulationResults) throw new HttpError(404, 'No results found');
    res.json({
      scenarios: sim.simulationResults.scenarios,
      optimizations: sim.simulationResults.optimizations,
    });
  } catch (err) { next(err); }
}

export async function getAgentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const sim = await simulationService.getById(param(req.params.id));
    res.json({ agent_status: sim.agentStatus });
  } catch (err) { next(err); }
}
