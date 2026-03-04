import { Router } from 'express';
import { validate } from '../../middlewares';
import { researchProjectSchema, previewResearchSchema, applyResearchSchema } from '../schemas/research.schema';
import * as controller from '../controllers/research.controller';

export const researchRouter = Router();

researchRouter.post('/:id/research', validate(researchProjectSchema), controller.triggerResearch);
researchRouter.get('/:id/research', validate(researchProjectSchema), controller.getResearch);
researchRouter.get('/:id/research/preview/:simulationId', validate(previewResearchSchema), controller.previewResearch);
researchRouter.post('/:id/simulations/:simulationId/apply-research', validate(applyResearchSchema), controller.applyResearch);
