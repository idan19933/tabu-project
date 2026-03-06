/**
 * @file research.controller.ts
 * @description Express route handlers for the market research pipeline.
 * Research is triggered per-project and can be previewed against a simulation
 * before being applied non-destructively (only fills null/zero fields).
 */

import { Request, Response, NextFunction } from 'express';
import * as researchService from '../services/research.service';
import { param } from '../../utils/params';

/**
 * Handles POST /api/projects/:id/research — triggers the 5-step market research
 * agent pipeline for the given project asynchronously.
 *
 * @param req - Express request; expects route param `id` (project ID).
 * @param res - Express response, sends a status acknowledgement as JSON.
 * @param next - Express next function, called on error.
 */
export async function triggerResearch(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await researchService.triggerResearch(param(req.params.id));
    res.json(result);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/projects/:id/research — returns the latest market research
 * results for a project.
 *
 * @param req - Express request; expects route param `id` (project ID).
 * @param res - Express response, sends the research result object as JSON.
 * @param next - Express next function, called on error.
 */
export async function getResearch(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await researchService.getResearch(param(req.params.id));
    res.json(result);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/projects/:id/research/preview/:simulationId — computes a
 * diff showing which simulation fields would be filled by applying the research
 * results, without modifying the database.
 *
 * @param req - Express request; expects route params `id` (project ID) and `simulationId`.
 * @param res - Express response, sends the preview diff object as JSON.
 * @param next - Express next function, called on error.
 */
export async function previewResearch(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await researchService.previewResearch(
      param(req.params.id),
      param(req.params.simulationId),
    );
    res.json(result);
  } catch (err) { next(err); }
}

/**
 * Handles POST /api/projects/:id/simulations/:simulationId/apply-research —
 * applies market research results to a simulation, filling only null/zero fields
 * (non-destructive merge — existing values are never overwritten).
 *
 * @param req - Express request; expects route params `id` (project ID) and `simulationId`.
 * @param res - Express response, sends the updated simulation as JSON.
 * @param next - Express next function, called on error.
 */
export async function applyResearch(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await researchService.applyResearch(
      param(req.params.id),
      param(req.params.simulationId),
    );
    res.json(result);
  } catch (err) { next(err); }
}
