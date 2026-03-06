/**
 * @module document.data-access
 * Prisma data-access layer for the Document model.
 *
 * Documents are associated with a Project and optionally with a Simulation.
 * Text extraction happens at upload time and is stored in `extractedText`.
 */
import { prisma } from '../../config/prisma';
import { ExtractionStatus } from '../../../prisma/generated/prisma/client';

/**
 * Fetch all documents belonging to a project, ordered by upload date (newest first).
 *
 * @param projectId - The UUID of the owning project.
 * @returns A promise resolving to an array of Document records.
 */
export function findByProject(projectId: string) {
  return prisma.document.findMany({
    where: { projectId },
    orderBy: { uploadDate: 'desc' },
  });
}

/**
 * Fetch all documents linked to a specific simulation, ordered by upload date (newest first).
 *
 * @param simulationId - The UUID of the owning simulation.
 * @returns A promise resolving to an array of Document records.
 */
export function findBySimulation(simulationId: string) {
  return prisma.document.findMany({
    where: { simulationId },
    orderBy: { uploadDate: 'desc' },
  });
}

/**
 * Fetch a single document by its ID.
 *
 * @param id - The UUID of the document.
 * @returns A promise resolving to the Document record, or `null` if not found.
 */
export function findById(id: string) {
  return prisma.document.findUnique({
    where: { id },
  });
}

/**
 * Create a new document record (without a physical file path — text is pre-extracted).
 *
 * @param data - The document fields to persist.
 * @param data.projectId - UUID of the owning project.
 * @param data.documentType - Free-form document type label (e.g. "tabu", "planning").
 * @param data.extractedText - Plain text content extracted from the uploaded PDF.
 * @param data.simulationId - Optional UUID to associate the document with a simulation.
 * @returns A promise resolving to the newly created Document record.
 */
export function create(data: {
  projectId: string;
  documentType: string;
  extractedText?: string;
  simulationId?: string;
}) {
  return prisma.document.create({ data });
}

/**
 * Update extraction-related fields on an existing document record.
 *
 * @param id - The UUID of the document to update.
 * @param data - Partial extraction fields to patch.
 * @param data.extractionStatus - The new extraction status enum value.
 * @param data.extractionError - An error message string, or `null` to clear a previous error.
 * @param data.extractedData - Structured JSON data parsed from the document.
 * @param data.docType - A refined document type determined during extraction.
 * @returns A promise resolving to the updated Document record.
 */
export function updateExtraction(
  id: string,
  data: {
    extractionStatus?: ExtractionStatus;
    extractionError?: string | null;
    extractedData?: any;
    docType?: string;
  }
) {
  return prisma.document.update({
    where: { id },
    data,
  });
}
