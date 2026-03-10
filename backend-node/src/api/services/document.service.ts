/**
 * @module document.service
 * Business-logic layer for document upload and retrieval.
 *
 * Extracts PDF text from uploaded buffers at upload time and persists
 * the result via `document.data-access`. No physical files are stored on disk.
 */
import * as documentDA from '../data-access/document.data-access';
import { extractTextFromBuffer } from '../../utils/pdf';
import { HttpError } from '../../lib/HttpError';

/**
 * Process a multipart PDF upload, extract its text, and persist the document record.
 *
 * @param projectId - The UUID of the project this document belongs to.
 * @param file - The Multer file object containing the in-memory PDF buffer.
 * @param documentType - A label describing the document category (e.g. "tabu", "planning").
 * @param simulationId - Optional UUID to associate the document with a specific simulation.
 * @returns A promise resolving to the newly created Document record.
 */
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

/**
 * Retrieve all documents belonging to a project.
 *
 * @param projectId - The UUID of the project.
 * @returns A promise resolving to an array of Document records, newest first.
 */
export async function getByProject(projectId: string) {
  return documentDA.findByProject(projectId);
}

/**
 * Retrieve all documents linked to a specific simulation.
 *
 * @param simulationId - The UUID of the simulation.
 * @returns A promise resolving to an array of Document records, newest first.
 */
export async function getBySimulation(simulationId: string) {
  return documentDA.findBySimulation(simulationId);
}

/**
 * Retrieve a single document by its ID.
 *
 * @param id - The UUID of the document.
 * @returns A promise resolving to the Document record.
 * @throws {HttpError} 404 if no document exists with the given ID.
 */
export async function getById(id: string) {
  const doc = await documentDA.findById(id);
  if (!doc) throw new HttpError(404, 'Document not found');
  return doc;
}
