import { Request, Response, NextFunction } from 'express';
import * as projectService from '../services/project.service';
import * as simulationService from '../services/simulation.service';
import { param } from '../../utils/params';

export async function listProjects(_req: Request, res: Response, next: NextFunction) {
  try {
    const projects = await projectService.getAll();
    res.json(projects);
  } catch (err) { next(err); }
}

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.create(req.body.name);
    res.status(201).json(project);
  } catch (err) { next(err); }
}

export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.getById(param(req.params.id));
    res.json(project);
  } catch (err) { next(err); }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.update(param(req.params.id), req.body.name);
    res.json(project);
  } catch (err) { next(err); }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    await projectService.remove(param(req.params.id));
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function listSimulations(req: Request, res: Response, next: NextFunction) {
  try {
    const simulations = await simulationService.listByProject(param(req.params.id));
    res.json(simulations);
  } catch (err) { next(err); }
}

export async function createSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const simulation = await simulationService.create(param(req.params.id), req.body.version_name);
    res.status(201).json(simulation);
  } catch (err) { next(err); }
}
