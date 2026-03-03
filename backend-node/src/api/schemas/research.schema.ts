import { z } from 'zod';

export const researchProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const previewResearchSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    simulationId: z.string().uuid(),
  }),
});

export const applyResearchSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    simulationId: z.string().uuid(),
  }),
});
