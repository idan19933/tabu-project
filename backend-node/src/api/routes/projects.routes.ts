/**
 * @file projects.routes.ts
 * @description Express router for project CRUD and project-scoped simulation creation.
 * Base path: `/api/projects`
 *
 * Routes:
 *  GET    /                     → listProjects
 *  POST   /                     → createProject
 *  GET    /:id                  → getProject
 *  PUT    /:id                  → updateProject
 *  DELETE /:id                  → deleteProject
 *  GET    /:id/simulations      → listSimulations
 *  POST   /:id/simulations      → createSimulation
 */

import { Router } from 'express';
import { validate } from '../../middlewares';
import { createProjectSchema, updateProjectSchema, projectIdSchema } from '../schemas/project.schema';
import { createSimulationSchema } from '../schemas/simulation.schema';
import * as controller from '../controllers/projects.controller';

/** Router exported and mounted at `/api/projects` in the root API router. */
export const projectsRouter = Router();

projectsRouter.get('/', controller.listProjects);
projectsRouter.post('/', validate(createProjectSchema), controller.createProject);
projectsRouter.get('/:id', validate(projectIdSchema), controller.getProject);
projectsRouter.put('/:id', validate(updateProjectSchema), controller.updateProject);
projectsRouter.delete('/:id', validate(projectIdSchema), controller.deleteProject);

// Simulations under project
projectsRouter.get('/:id/simulations', validate(projectIdSchema), controller.listSimulations);
projectsRouter.post('/:id/simulations', validate(createSimulationSchema), controller.createSimulation);
