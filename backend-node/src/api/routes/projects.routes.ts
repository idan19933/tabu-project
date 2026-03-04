import { Router } from 'express';
import { validate } from '../../middlewares';
import { createProjectSchema, updateProjectSchema, projectIdSchema } from '../schemas/project.schema';
import { createSimulationSchema } from '../schemas/simulation.schema';
import * as controller from '../controllers/projects.controller';

export const projectsRouter = Router();

projectsRouter.get('/', controller.listProjects);
projectsRouter.post('/', validate(createProjectSchema), controller.createProject);
projectsRouter.get('/:id', validate(projectIdSchema), controller.getProject);
projectsRouter.put('/:id', validate(updateProjectSchema), controller.updateProject);
projectsRouter.delete('/:id', validate(projectIdSchema), controller.deleteProject);

// Simulations under project
projectsRouter.get('/:id/simulations', validate(projectIdSchema), controller.listSimulations);
projectsRouter.post('/:id/simulations', validate(createSimulationSchema), controller.createSimulation);
