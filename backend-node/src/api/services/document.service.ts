import path from 'path';
import fs from 'fs/promises';
import { env } from '../../config/env';
import * as documentDA from '../data-access/document.data-access';
import { HttpError } from '../../lib/HttpError';

export async function saveUpload(
  projectId: string,
  file: Express.Multer.File,
  documentType: string,
  simulationId?: string
) {
  // Ensure upload directory exists
  await fs.mkdir(env.UPLOAD_DIR, { recursive: true });

  const filename = `${projectId}_${Date.now()}_${file.originalname}`;
  const filePath = path.join(env.UPLOAD_DIR, filename);

  // Move file from multer temp to upload dir
  await fs.rename(file.path, filePath);

  return documentDA.create({
    projectId,
    documentType,
    filePath,
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
