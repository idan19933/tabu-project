import { Router } from 'express';
import multer from 'multer';
import * as controller from '../controllers/documents.controller';

const upload = multer({ dest: process.env.UPLOAD_DIR || 'uploads/' });

export const documentsRouter = Router();

documentsRouter.post('/upload', upload.single('file'), controller.uploadDocument);
documentsRouter.get('/by-project/:projectId', controller.getProjectDocuments);
documentsRouter.get('/by-simulation/:simulationId', controller.getSimulationDocuments);
