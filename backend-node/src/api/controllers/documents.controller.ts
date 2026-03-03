import { Request, Response, NextFunction } from 'express';
import * as documentService from '../services/document.service';
import { runDocumentExtraction } from '../services/ai/document-extraction.service';
import { logger } from '../../config/logger';
import { param } from '../../utils/params';

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

    // Fire-and-forget extraction
    setImmediate(() => {
      runDocumentExtraction(doc.id, project_id).catch((err) =>
        logger.error('Extraction failed', err)
      );
    });

    res.status(201).json(doc);
  } catch (err) { next(err); }
}

export async function getProjectDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const docs = await documentService.getByProject(param(req.params.projectId));
    res.json(docs);
  } catch (err) { next(err); }
}

export async function getSimulationDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const docs = await documentService.getBySimulation(param(req.params.simulationId));
    res.json(docs);
  } catch (err) { next(err); }
}
