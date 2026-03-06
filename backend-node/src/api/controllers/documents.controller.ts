/**
 * @file documents.controller.ts
 * @description Express route handlers for document upload and retrieval.
 * After a successful upload the extraction pipeline is triggered asynchronously
 * via `setImmediate` so the HTTP response is returned immediately.
 */

import { Request, Response, NextFunction } from 'express';
import * as documentService from '../services/document.service';
import { runDocumentExtraction } from '../services/document-extraction.service';
import { logger } from '../../config/logger';
import { param } from '../../utils/params';

/**
 * Handles POST /api/documents/upload — accepts a multipart file upload and
 * saves the document record, then fires off text extraction in the background.
 *
 * @param req - Express request with a `file` attached by multer and body fields
 *   `project_id`, `document_type`, and optional `simulation_id`.
 * @param res - Express response, sends the saved document record with HTTP 201.
 * @param next - Express next function, called on error.
 */
export async function uploadDocument(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const { project_id, document_type, simulation_id } = req.body;
    const doc = await documentService.saveUpload(
      project_id,
      req.file,
      document_type,
      simulation_id
    );

    // Fire-and-forget extraction — pass document_type as a hint so the
    // extraction service skips AI auto-detection for explicitly-typed docs.
    setImmediate(() => {
      runDocumentExtraction(doc.id, project_id, document_type).catch((err) =>
        logger.error('Extraction failed', err)
      );
    });

    res.status(201).json(doc);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/documents/by-project/:projectId — lists all documents
 * belonging to a given project.
 *
 * @param req - Express request; expects route param `projectId`.
 * @param res - Express response, sends array of document records as JSON.
 * @param next - Express next function, called on error.
 */
export async function getProjectDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const docs = await documentService.getByProject(param(req.params.projectId));
    res.json(docs);
  } catch (err) { next(err); }
}

/**
 * Handles GET /api/documents/by-simulation/:simulationId — lists all documents
 * associated with a given simulation.
 *
 * @param req - Express request; expects route param `simulationId`.
 * @param res - Express response, sends array of document records as JSON.
 * @param next - Express next function, called on error.
 */
export async function getSimulationDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const docs = await documentService.getBySimulation(param(req.params.simulationId));
    res.json(docs);
  } catch (err) { next(err); }
}
