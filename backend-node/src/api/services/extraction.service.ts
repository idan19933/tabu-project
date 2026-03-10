/**
 * @module extraction.service
 * @description Computes and returns the extraction status for a project, including
 * per-document extraction states, overall progress percentage, and the active simulation.
 */
import * as projectDA from '../data-access/project.data-access';
import * as documentDA from '../data-access/document.data-access';
import { HttpError } from '../../lib/HttpError';

/**
 * Retrieves the current document-extraction status for a project.
 *
 * Aggregates document states (Pending / Processing / Completed / Failed) into a
 * human-readable progress object with a Hebrew `current_step` string.
 * Also surfaces the latest simulation ID and status for the calling client.
 *
 * @param projectId - The project whose extraction status is requested.
 * @returns Status payload containing:
 *   - `project_id` — the project ID.
 *   - `documents` — array of per-document status snapshots.
 *   - `tabu_data` — parsed tabu data stored on the project (may be null).
 *   - `extraction_progress` — `{ total_docs, completed_docs, current_step, percentage }`, or `null` when no documents exist.
 *   - `active_simulation_id` — ID of the most recent simulation, or `null`.
 *   - `active_simulation_status` — status of the most recent simulation, or `null`.
 * @throws {HttpError} 404 if the project does not exist.
 */
export async function getExtractionStatus(projectId: string) {
  const project = await projectDA.findById(projectId);
  if (!project) throw new HttpError(404, 'Project not found');

  const documents = await documentDA.findByProject(projectId);

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

  return {
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
  };
}
