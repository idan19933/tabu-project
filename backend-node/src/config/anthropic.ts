/**
 * @file config/anthropic.ts
 * @description Initialises and exports the shared Anthropic SDK client instance.
 * The API key is sourced from the validated environment configuration.
 * All AI agents in the pipeline import this singleton to make Claude API calls.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

/** Singleton Anthropic client used throughout the AI agent pipeline. */
export const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});
