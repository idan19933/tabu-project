import { Request, Response, NextFunction } from 'express';
import * as projectDA from '../data-access/project.data-access';
import * as documentDA from '../data-access/document.data-access';
import { HttpError } from '../../lib/HttpError';
import { param } from '../../utils/params';

export async function getExtractionStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req.params.id);
    const project = await projectDA.findById(id);
    if (!project) throw new HttpError(404, 'Project not found');

    const documents = await documentDA.findByProject(id);

    let activeSimulationId: string | null = null;
    let activeSimulationStatus: string | null = null;
    if (project.simulations.length > 0) {
      const latest = project.simulations[0];
      activeSimulationId = latest.id;
      activeSimulationStatus = latest.status;
    }

    const extractionProgress: Record<string, string> = {};
    for (const doc of documents) {
      extractionProgress[doc.id] = doc.extractionStatus;
    }

    res.json({
      project_id: project.id,
      documents: documents.map((d: any) => ({
        id: d.id,
        document_type: d.documentType,
        extraction_status: d.extractionStatus,
        extraction_error: d.extractionError,
      })),
      tabu_data: project.tabuData,
      extraction_progress: extractionProgress,
      active_simulation_id: activeSimulationId,
      active_simulation_status: activeSimulationStatus,
    });
  } catch (err) { next(err); }
}
