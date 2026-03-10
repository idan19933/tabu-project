/**
 * @file documents.routes.ts
 * @description Express router for document upload and retrieval.
 * Base path: `/api/documents`
 *
 * Routes:
 *  POST /upload                        → uploadDocument (multipart/form-data)
 *  GET  /by-project/:projectId         → getProjectDocuments
 *  GET  /by-simulation/:simulationId   → getSimulationDocuments
 *
 * File uploads are handled by multer configured with in-memory storage;
 * the raw buffer is then passed to the document service for Supabase storage.
 */

import { Router } from 'express';
import multer from 'multer';
import * as controller from '../controllers/documents.controller';

/** Multer instance using in-memory storage — files are kept as Buffer objects. */
const upload = multer({ storage: multer.memoryStorage() });

/** Router exported and mounted at `/api/documents` in the root API router. */
export const documentsRouter = Router();

documentsRouter.post('/upload', upload.single('file'), controller.uploadDocument);
documentsRouter.get('/by-project/:projectId', controller.getProjectDocuments);
documentsRouter.get('/by-simulation/:simulationId', controller.getSimulationDocuments);
