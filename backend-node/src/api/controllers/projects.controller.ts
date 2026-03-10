/**
 * @file projects.controller.ts
 * @description Express route handlers for project CRUD operations and project-scoped simulation management.
 * All handlers follow the pattern: validate params → call service → send JSON response.
 */

import { Request, Response, NextFunction } from 'express';
import * as projectService from '../services/project.service';
import * as simulationService from '../services/simulation.service';
import { param } from '../../utils/params';

/**
 * Handles GET /api/projects — returns all projects in the database.
 *
 * @param _req - Express request (unused).
 * @param res - Express response, sends array of projects as JSON.
 * @param next - Express next function, called on error.
 */
export async function listProjects(_req: Request, res: Response, next: NextFunction) {
  try {
    const projects = await projectService.getAll();
    res.json(projects);
  } catch (err) { next(err); }
}

/**
 * Handles POST /api/projects — creates a new project with the given name.
 *
 * @param req - Express request; expects `{ name: string }` in body.
 * @param res - Express response, sends the created project with HTTP 201.
 * @param next - Express next function, called on error.
 */
export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.create(req.body.name);
    res.status(201).json(project);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/projects/:id — returns a single project by ID.
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends the project as JSON.
 * @param next - Express next function, called on error (including 404 if not found).
 */
export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.getById(param(req.params.id));
    res.json(project);
  } catch (err) { next(err); }
}

/**
 * Handles PUT /api/projects/:id — updates a project's name.
 *
 * @param req - Express request; expects route param `id` and `{ name: string }` in body.
 * @param res - Express response, sends the updated project as JSON.
 * @param next - Express next function, called on error.
 */
export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.update(param(req.params.id), req.body.name);
    res.json(project);
  } catch (err) { next(err); }
}

/**
 * Handles DELETE /api/projects/:id — deletes a project and its related data.
 *
 * @param req - Express request; expects route param `id`.
 * @param res - Express response, sends HTTP 204 No Content on success.
 * @param next - Express next function, called on error.
 */
export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    await projectService.remove(param(req.params.id));
    res.status(204).send();
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/projects/:id/simulations — lists all simulations for a project.
 *
 * @param req - Express request; expects route param `id` (project ID).
 * @param res - Express response, sends array of simulations as JSON.
 * @param next - Express next function, called on error.
 */
export async function listSimulations(req: Request, res: Response, next: NextFunction) {
  try {
    const simulations = await simulationService.listByProject(param(req.params.id));
    res.json(simulations);
  } catch (err) { next(err); }
}

/**
 * Handles POST /api/projects/:id/simulations — creates a new simulation under a project.
 *
 * @param req - Express request; expects route param `id` (project ID) and `{ version_name: string }` in body.
 * @param res - Express response, sends the created simulation with HTTP 201.
 * @param next - Express next function, called on error.
 */
export async function createSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const simulation = await simulationService.create(param(req.params.id), req.body.version_name);
    res.status(201).json(simulation);
  } catch (err) { next(err); }
}
