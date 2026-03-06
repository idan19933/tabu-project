/**
 * @file config/env.ts
 * @description Validates and exports typed environment variables using Zod.
 * The schema is parsed at module load time — missing required variables will
 * throw immediately, preventing the server from starting with a bad config.
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Zod schema that defines all required and optional environment variables.
 * Defaults are applied where appropriate so the server can run locally without
 * a full production environment.
 */
const envSchema = z.object({
  /** PostgreSQL connection string used by Prisma (pooled via PgBouncer in production). */
  DATABASE_URL: z.string(),
  /** Direct (non-pooled) PostgreSQL connection string used for migrations. */
  DIRECT_URL: z.string(),
  /** Anthropic API key for Claude. Defaults to empty string so the app boots without it. */
  ANTHROPIC_API_KEY: z.string().default(''),
  /** HTTP port the server listens on. Defaults to 8000. */
  PORT: z.string().default('8000'),
  /** Allowed CORS origin in production. Optional — not needed for development. */
  CORS_ORIGIN: z.string().optional(),
  /** Node environment (`development`, `production`, `test`). Defaults to `development`. */
  NODE_ENV: z.string().default('development'),
});

/** Validated, typed environment variables parsed from `process.env`. */
export const env = envSchema.parse(process.env);
