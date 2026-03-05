import * as documentDA from '../data-access/document.data-access';
import { extractTextFromBuffer } from '../../utils/pdf';
import { HttpError } from '../../lib/HttpError';

export async function saveUpload(
  projectId: string,
  file: Express.Multer.File,
  documentType: string,
  simulationId?: string
) {
  const extractedText = await extractTextFromBuffer(file.buffer);

  return documentDA.create({
    projectId,
    documentType,
    extractedText,
    simulationId,
  });
}

export async function getByProject(projectId: string) {
  return documentDA.findByProject(projectId);
}

export async function getBySimulation(simulationId: string) {
  return documentDA.findBySimulation(simulationId);
}

export async function getById(id: string) {
  const doc = await documentDA.findById(id);
  if (!doc) throw new HttpError(404, 'Document not found');
  return doc;
}
