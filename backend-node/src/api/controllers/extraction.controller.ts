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

    const totalDocs = documents.length;
    const completedDocs = documents.filter(
      (d: any) => d.extractionStatus === 'Completed' || d.extractionStatus === 'Failed',
    ).length;
    const processingDoc = documents.find((d: any) => d.extractionStatus === 'Processing');
    const pendingDoc = documents.find((d: any) => d.extractionStatus === 'Pending');

    let currentStep = 'מחכה למסמכים';
    if (processingDoc) currentStep = `מחלץ נתונים מ-${processingDoc.documentType || 'מסמך'}...`;
    else if (pendingDoc) currentStep = 'ממתין לחילוץ...';
    else if (completedDocs === totalDocs && totalDocs > 0) currentStep = 'חילוץ הושלם';

    const percentage = totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0;

    res.json({
      project_id: project.id,
      documents: documents.map((d: any) => ({
        id: d.id,
        document_type: d.documentType,
        extraction_status: d.extractionStatus,
        extraction_error: d.extractionError,
      })),
      tabu_data: project.tabuData,
      extraction_progress: totalDocs > 0
        ? { total_docs: totalDocs, completed_docs: completedDocs, current_step: currentStep, percentage }
        : null,
      active_simulation_id: activeSimulationId,
      active_simulation_status: activeSimulationStatus,
    });
  } catch (err) { next(err); }
}
