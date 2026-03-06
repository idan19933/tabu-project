/**
 * @file research.routes.ts
 * @description Express router for the market research pipeline (project-scoped).
 * Mounted under `/api/projects` in the root API router.
 *
 * Routes:
 *  POST /:id/research                                  → triggerResearch
 *  GET  /:id/research                                  → getResearch
 *  GET  /:id/research/preview/:simulationId            → previewResearch
 *  POST /:id/simulations/:simulationId/apply-research  → applyResearch
 */

import { Router } from 'express';
import { validate } from '../../middlewares';
import { researchProjectSchema, previewResearchSchema, applyResearchSchema } from '../schemas/research.schema';
import * as controller from '../controllers/research.controller';

/** Router exported and mounted at `/api/projects` in the root API router. */
export const researchRouter = Router();

researchRouter.post('/:id/research', validate(researchProjectSchema), controller.triggerResearch);
researchRouter.get('/:id/research', validate(researchProjectSchema), controller.getResearch);
researchRouter.get('/:id/research/preview/:simulationId', validate(previewResearchSchema), controller.previewResearch);
researchRouter.post('/:id/simulations/:simulationId/apply-research', validate(applyResearchSchema), controller.applyResearch);
