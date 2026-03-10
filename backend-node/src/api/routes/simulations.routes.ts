/**
 * @file simulations.routes.ts
 * @description Express router for the full simulation lifecycle.
 * Base path: `/api/simulations`
 *
 * Routes:
 *  GET    /:id                        → getSimulation
 *  PUT    /:id                        → updateSimulation
 *  POST   /:id/clone                  → cloneSimulation
 *  GET    /:id/review                 → reviewSimulation
 *  PUT    /:id/approve                → approveSimulation
 *  GET    /:id/validation             → validateSimulation
 *  POST   /:id/calculate              → calculateSimulation
 *  GET    /:id/report/management      → downloadManagementReport (XLSX)
 *  GET    /:id/report/economic        → downloadEconomicReport (XLSX)
 *  GET    /:id/calculation-details    → getCalculationDetails
 *  GET    /:id/delta                  → getDeltaAnalysis
 *  GET    /:id/sensitivity            → getSensitivity
 *  GET    /:id/compare/:otherId       → compareSimulations
 *  POST   /:id/run-pipeline           → triggerPipeline
 *  GET    /:id/agent-stream           → agentStream (SSE)
 *  GET    /:id/missing-fields         → getMissingFields
 *  GET    /:id/alternatives           → getAlternatives
 *  GET    /:id/agent-status           → getAgentStatus
 */

import { Router } from 'express';
import { validate } from '../../middlewares';
import { simulationIdSchema, fullUpdateSchema, compareSchema } from '../schemas/simulation.schema';
import * as controller from '../controllers/simulations.controller';

/** Router exported and mounted at `/api/simulations` in the root API router. */
export const simulationsRouter = Router();

simulationsRouter.get('/:id', validate(simulationIdSchema), controller.getSimulation);
simulationsRouter.put('/:id', validate(fullUpdateSchema), controller.updateSimulation);

simulationsRouter.post('/:id/clone', validate(simulationIdSchema), controller.cloneSimulation);
simulationsRouter.get('/:id/review', validate(simulationIdSchema), controller.reviewSimulation);
simulationsRouter.put('/:id/approve', validate(simulationIdSchema), controller.approveSimulation);
simulationsRouter.get('/:id/validation', validate(simulationIdSchema), controller.validateSimulation);
simulationsRouter.post('/:id/calculate', validate(simulationIdSchema), controller.calculateSimulation);

simulationsRouter.get('/:id/report/management', validate(simulationIdSchema), controller.downloadManagementReport);
simulationsRouter.get('/:id/report/economic', validate(simulationIdSchema), controller.downloadEconomicReport);

simulationsRouter.get('/:id/calculation-details', validate(simulationIdSchema), controller.getCalculationDetails);
simulationsRouter.get('/:id/delta', validate(simulationIdSchema), controller.getDeltaAnalysis);
simulationsRouter.get('/:id/sensitivity', validate(simulationIdSchema), controller.getSensitivity);
simulationsRouter.get('/:id/compare/:otherId', validate(compareSchema), controller.compareSimulations);

simulationsRouter.post('/:id/run-pipeline', validate(simulationIdSchema), controller.triggerPipeline);
simulationsRouter.get('/:id/agent-stream', controller.agentStream);
simulationsRouter.get('/:id/missing-fields', validate(simulationIdSchema), controller.getMissingFields);
simulationsRouter.get('/:id/alternatives', validate(simulationIdSchema), controller.getAlternatives);
simulationsRouter.get('/:id/agent-status', validate(simulationIdSchema), controller.getAgentStatus);
