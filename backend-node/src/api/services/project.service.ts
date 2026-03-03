import * as projectDA from '../data-access/project.data-access';
import { HttpError } from '../../lib/HttpError';

export async function getAll() {
  return projectDA.findAll();
}

export async function getById(id: string) {
  const project = await projectDA.findById(id);
  if (!project) throw new HttpError(404, 'Project not found');
  return project;
}

export async function create(name: string) {
  return projectDA.create(name);
}

export async function update(id: string, name: string) {
  const project = await projectDA.findById(id);
  if (!project) throw new HttpError(404, 'Project not found');
  return projectDA.update(id, { name });
}

export async function remove(id: string) {
  const project = await projectDA.findById(id);
  if (!project) throw new HttpError(404, 'Project not found');
  await projectDA.remove(id);
}
