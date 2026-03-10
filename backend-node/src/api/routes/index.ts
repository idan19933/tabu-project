/**
 * @file routes/index.ts
 * @description Root API router that aggregates all feature sub-routers under `/api`.
 *
 * Mounted paths:
 *  - `/api/projects`     → projectsRouter  (project CRUD + nested simulations)
 *  - `/api/simulations`  → simulationsRouter (simulation lifecycle endpoints)
 *  - `/api/documents`    → documentsRouter  (file upload + listing)
 *  - `/api/projects`     → researchRouter   (market research pipeline)
 *  - `/api/projects`     → extractionRouter (document extraction status)
 *
 * Note: researchRouter and extractionRouter both mount under `/api/projects`
 * because their routes are project-scoped (e.g. `/api/projects/:id/research`).
 */

import { Router } from 'express';
import { projectsRouter } from './projects.routes';
import { simulationsRouter } from './simulations.routes';
import { documentsRouter } from './documents.routes';
import { researchRouter } from './research.routes';
import { extractionRouter } from './extraction.routes';

/** Aggregated API router — mounted at `/api` in `app.ts`. */
export const apiRouter = Router();

apiRouter.use('/projects', projectsRouter);
apiRouter.use('/simulations', simulationsRouter);
apiRouter.use('/documents', documentsRouter);
apiRouter.use('/projects', researchRouter);
apiRouter.use('/projects', extractionRouter);
