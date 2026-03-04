import { prisma } from '../../config/prisma';
import { SimulationStatus } from '../../../prisma/generated/prisma/client';

const simulationFullInclude = {
  planningParameters: true,
  apartmentMix: true,
  economicParameters: true,
  costParameters: true,
  revenueParameters: true,
  simulationResults: true,
  documents: {
    select: {
      id: true,
      documentType: true,
      extractionStatus: true,
      extractionError: true,
    },
  },
};

export function findByProject(projectId: string) {
  return prisma.simulation.findMany({
    where: { projectId },
    select: {
      id: true,
      versionName: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export function findById(id: string) {
  return prisma.simulation.findUnique({
    where: { id },
    include: simulationFullInclude,
  });
}

export function create(projectId: string, versionName: string) {
  return prisma.simulation.create({
    data: { projectId, versionName },
    include: simulationFullInclude,
  });
}

export function updateStatus(id: string, status: SimulationStatus) {
  return prisma.simulation.update({
    where: { id },
    data: { status },
    include: simulationFullInclude,
  });
}

export function updateAgentStatus(id: string, agentStatus: any) {
  return prisma.simulation.update({
    where: { id },
    data: { agentStatus },
  });
}

export function updateExtractionProgress(id: string, extractionProgress: any) {
  return prisma.simulation.update({
    where: { id },
    data: { extractionProgress },
  });
}

export function remove(id: string) {
  return prisma.simulation.delete({
    where: { id },
  });
}
