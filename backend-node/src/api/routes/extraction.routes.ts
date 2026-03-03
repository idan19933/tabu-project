import { Router } from 'express';
import { validate } from '../../middlewares';
import { projectIdSchema } from '../schemas/project.schema';
import * as controller from '../controllers/extraction.controller';

export const extractionRouter = Router();

extractionRouter.get('/:id/extraction-status', validate(projectIdSchema), controller.getExtractionStatus);
