/**
 * @module simulation.data-access
 * Prisma data-access layer for the Simulation model.
 *
 * All single-record queries use `simulationFullInclude`, which eagerly loads
 * all six parameter relations plus associated documents.
 */
import { prisma } from '../../config/prisma';
import { SimulationStatus } from '../../../prisma/generated/prisma/client';

/**
 * Shared Prisma `include` object that loads all relations required for a
 * complete simulation detail view: planning, cost, revenue, economic parameters,
 * apartment mix, simulation results, and linked documents.
 */
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

/**
 * Fetch a lightweight list of simulations belonging to a project.
 *
 * Returns only `id`, `versionName`, `status`, and `createdAt` — not the full include.
 *
 * @param projectId - The UUID of the parent project.
 * @returns A promise resolving to an array of partial Simulation records, newest first.
 */
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

/**
 * Fetch a complete simulation by ID, including all parameter relations.
 *
 * @param id - The UUID of the simulation.
 * @returns A promise resolving to the full Simulation record with all includes, or `null` if not found.
 */
export function findById(id: string) {
  return prisma.simulation.findUnique({
    where: { id },
    include: simulationFullInclude,
  });
}

/**
 * Create a new simulation in `Draft` status for the given project.
 *
 * @param projectId - The UUID of the parent project.
 * @param versionName - A human-readable label for this simulation version.
 * @returns A promise resolving to the newly created Simulation with all relations included.
 */
export function create(projectId: string, versionName: string) {
  return prisma.simulation.create({
    data: { projectId, versionName },
    include: simulationFullInclude,
  });
}

/**
 * Update the status of a simulation and return the updated record with all relations.
 *
 * @param id - The UUID of the simulation.
 * @param status - The new `SimulationStatus` enum value to set.
 * @returns A promise resolving to the updated Simulation with all relations included.
 */
export function updateStatus(id: string, status: SimulationStatus) {
  return prisma.simulation.update({
    where: { id },
    data: { status },
    include: simulationFullInclude,
  });
}

/**
 * Patch the `agentStatus` JSON field of a simulation (used by the AI pipeline orchestrator).
 *
 * @param id - The UUID of the simulation.
 * @param agentStatus - Arbitrary JSON describing the current agent pipeline state.
 * @returns A promise resolving to the updated Simulation record (no full include).
 */
export function updateAgentStatus(id: string, agentStatus: any) {
  return prisma.simulation.update({
    where: { id },
    data: { agentStatus },
  });
}

/**
 * Patch the `extractionProgress` JSON field of a simulation (used during document extraction).
 *
 * @param id - The UUID of the simulation.
 * @param extractionProgress - Arbitrary JSON describing per-document extraction progress.
 * @returns A promise resolving to the updated Simulation record (no full include).
 */
export function updateExtractionProgress(id: string, extractionProgress: any) {
  return prisma.simulation.update({
    where: { id },
    data: { extractionProgress },
  });
}

/**
 * Permanently delete a simulation by ID (cascades to all parameter records per schema).
 *
 * @param id - The UUID of the simulation to delete.
 * @returns A promise resolving to the deleted Simulation record.
 */
export function remove(id: string) {
  return prisma.simulation.delete({
    where: { id },
  });
}
