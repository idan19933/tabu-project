import { prisma } from '../../config/prisma';
import { ExtractionStatus } from '../../../prisma/generated/prisma/client';

export function findByProject(projectId: string) {
  return prisma.document.findMany({
    where: { projectId },
    orderBy: { uploadDate: 'desc' },
  });
}

export function findBySimulation(simulationId: string) {
  return prisma.document.findMany({
    where: { simulationId },
    orderBy: { uploadDate: 'desc' },
  });
}

export function findById(id: string) {
  return prisma.document.findUnique({
    where: { id },
  });
}

export function create(data: {
  projectId: string;
  documentType: string;
  filePath: string;
  simulationId?: string;
}) {
  return prisma.document.create({ data });
}

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
