/**
 * @module project.data-access
 * Prisma data-access layer for the Project model.
 *
 * All queries include the `documents` and `simulations` relations
 * (via `projectWithRelations`) when fetching a single project by ID.
 */
import { prisma } from '../../config/prisma';

/** Shared include shape for `findById` — eagerly loads documents and simulations. */
const projectWithRelations = {
  documents: {
    select: {
      id: true,
      documentType: true,
      filePath: true,
      uploadDate: true,
      extractionStatus: true,
      extractionError: true,
    },
    orderBy: { uploadDate: 'desc' as const },
  },
  simulations: {
    select: {
      id: true,
      versionName: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
};

/**
 * Fetch all projects ordered by creation date (newest first).
 *
 * @returns A promise resolving to an array of all Project records.
 */
export function findAll() {
  return prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Fetch a single project by its ID, including related documents and simulations.
 *
 * @param id - The UUID of the project.
 * @returns A promise resolving to the Project with relations, or `null` if not found.
 */
export function findById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: projectWithRelations,
  });
}

/**
 * Create a new project with the given name.
 *
 * @param name - The display name for the new project.
 * @returns A promise resolving to the newly created Project record.
 */
export function create(name: string) {
  return prisma.project.create({
    data: { name },
  });
}

/**
 * Update mutable fields on an existing project.
 *
 * @param id - The UUID of the project to update.
 * @param data - A partial object of updatable fields (name, tabuData, marketResearchData, marketResearchStatus).
 * @returns A promise resolving to the updated Project record.
 */
export function update(id: string, data: { name?: string; tabuData?: any; marketResearchData?: any; marketResearchStatus?: string }) {
  return prisma.project.update({
    where: { id },
    data,
  });
}

/**
 * Permanently delete a project by ID (cascades to related records per schema).
 *
 * @param id - The UUID of the project to delete.
 * @returns A promise resolving to the deleted Project record.
 */
export function remove(id: string) {
  return prisma.project.delete({
    where: { id },
  });
}
