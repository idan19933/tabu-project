/**
 * @file extraction.routes.ts
 * @description Express router for document extraction status (project-scoped).
 * Mounted under `/api/projects` in the root API router.
 *
 * Routes:
 *  GET /:id/extraction-status → getExtractionStatus
 */

import { Router } from 'express';
import { validate } from '../../middlewares';
import { projectIdSchema } from '../schemas/project.schema';
import * as controller from '../controllers/extraction.controller';

/** Router exported and mounted at `/api/projects` in the root API router. */
export const extractionRouter = Router();

extractionRouter.get('/:id/extraction-status', validate(projectIdSchema), controller.getExtractionStatus);
