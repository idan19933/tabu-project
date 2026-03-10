/**
 * @module project.service
 * Business-logic layer for project management.
 *
 * Thin orchestration over `project.data-access`: validates existence,
 * throws typed `HttpError` on 404, and delegates to Prisma queries.
 */
import * as projectDA from '../data-access/project.data-access';
import { HttpError } from '../../lib/HttpError';

/**
 * Retrieve all projects, newest first.
 *
 * @returns A promise resolving to an array of all Project records.
 */
export async function getAll() {
  return projectDA.findAll();
}

/**
 * Retrieve a single project by ID, including its documents and simulations.
 *
 * @param id - The UUID of the project.
 * @returns A promise resolving to the Project with relations.
 * @throws {HttpError} 404 if no project exists with the given ID.
 */
export async function getById(id: string) {
  const project = await projectDA.findById(id);
  if (!project) throw new HttpError(404, 'Project not found');
  return project;
}

/**
 * Create a new project with the given display name.
 *
 * @param name - The name for the new project.
 * @returns A promise resolving to the newly created Project record.
 */
export async function create(name: string) {
  return projectDA.create(name);
}

/**
 * Rename an existing project.
 *
 * @param id - The UUID of the project to update.
 * @param name - The new display name.
 * @returns A promise resolving to the updated Project record.
 * @throws {HttpError} 404 if no project exists with the given ID.
 */
export async function update(id: string, name: string) {
  const project = await projectDA.findById(id);
  if (!project) throw new HttpError(404, 'Project not found');
  return projectDA.update(id, { name });
}

/**
 * Permanently delete a project and all its associated records.
 *
 * @param id - The UUID of the project to delete.
 * @returns A promise that resolves when deletion is complete.
 * @throws {HttpError} 404 if no project exists with the given ID.
 */
export async function remove(id: string) {
  const project = await projectDA.findById(id);
  if (!project) throw new HttpError(404, 'Project not found');
  await projectDA.remove(id);
}
