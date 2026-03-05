import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string(),
  DIRECT_URL: z.string(),
  ANTHROPIC_API_KEY: z.string().default(''),
  PORT: z.string().default('8000'),
  CORS_ORIGIN: z.string().optional(),
  NODE_ENV: z.string().default('development'),
});

export const env = envSchema.parse(process.env);
