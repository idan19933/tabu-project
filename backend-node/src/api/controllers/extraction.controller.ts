/**
 * @file extraction.controller.ts
 * @description Express route handler for querying the document extraction status
 * of a project's uploaded documents.
 */

import { Request, Response, NextFunction } from 'express';
import * as extractionService from '../services/extraction.service';
import { param } from '../../utils/params';

/**
 * Handles GET /api/projects/:id/extraction-status — returns the extraction
 * status for all documents belonging to the given project.
 *
 * @param req - Express request; expects route param `id` (project ID).
 * @param res - Express response, sends the extraction status summary as JSON.
 * @param next - Express next function, called on error.
 */
export async function getExtractionStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await extractionService.getExtractionStatus(param(req.params.id));
    res.json(result);
  } catch (err) { next(err); }
}
