import { z } from 'zod';

export const uploadDocumentSchema = z.object({
  body: z.object({
    project_id: z.string().uuid(),
    document_type: z.string().min(1),
    simulation_id: z.string().uuid().optional(),
  }),
});

export const projectDocumentsSchema = z.object({
  params: z.object({
    projectId: z.string().uuid(),
  }),
});

export const simulationDocumentsSchema = z.object({
  params: z.object({
    simulationId: z.string().uuid(),
  }),
});
