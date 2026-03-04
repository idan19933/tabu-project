import { Router } from 'express';
import { projectsRouter } from './projects.routes';
import { simulationsRouter } from './simulations.routes';
import { documentsRouter } from './documents.routes';
import { researchRouter } from './research.routes';
import { extractionRouter } from './extraction.routes';

export const apiRouter = Router();

apiRouter.use('/projects', projectsRouter);
apiRouter.use('/simulations', simulationsRouter);
apiRouter.use('/documents', documentsRouter);
apiRouter.use('/projects', researchRouter);
apiRouter.use('/projects', extractionRouter);
