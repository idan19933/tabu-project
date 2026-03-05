import { Request, Response, NextFunction } from 'express';
import * as projectDA from '../data-access/project.data-access';
import * as simulationDA from '../data-access/simulation.data-access';
import * as paramDA from '../data-access/parameter.data-access';
import { runMarketResearch } from '../services/market-research.service';
import { HttpError } from '../../lib/HttpError';
import { logger } from '../../config/logger';
import { safe } from '../../utils/safe';
import { param } from '../../utils/params';

export async function triggerResearch(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req.params.id);
    const project = await projectDA.findById(id);
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

    res.json({ status: 'running', project_id: project.id });
  } catch (err) { next(err); }
}

export async function getResearch(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectDA.findById(param(req.params.id));
    if (!project) throw new HttpError(404, 'Project not found');
    res.json({
      status: project.marketResearchStatus,
      data: project.marketResearchData,
    });
  } catch (err) { next(err); }
}

export async function previewResearch(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectDA.findById(param(req.params.id));
    if (!project) throw new HttpError(404, 'Project not found');
    if (!project.marketResearchData) throw new HttpError(404, 'No research data available');

    const sim = await simulationDA.findById(param(req.params.simulationId));
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

    res.json({ preview: diff });
  } catch (err) { next(err); }
}

export async function applyResearch(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectDA.findById(param(req.params.id));
    if (!project) throw new HttpError(404, 'Project not found');
    if (!project.marketResearchData) throw new HttpError(404, 'No research data available');

    const sim = await simulationDA.findById(param(req.params.simulationId));
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

    res.json({ applied_count: appliedCount });
  } catch (err) { next(err); }
}
