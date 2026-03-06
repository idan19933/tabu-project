/**
 * @file middlewares.ts
 * @description Shared Express middleware: Zod request validation, 404 not-found
 * handler, and the centralised error handler.
 */

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, z } from 'zod';
import { HttpError } from './lib/HttpError';
import { logger } from './config/logger';

/**
 * Returns an Express middleware that validates `req.body`, `req.query`, and
 * `req.params` against the provided Zod schema.  On failure it calls `next`
 * with an `HttpError(400)` containing the concatenated Zod error messages.
 *
 * @param schema - A Zod object schema that should have `body`, `query`, and `params` keys.
 * @returns Express middleware function.
 */
export const validate = (schema: AnyZodObject) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((e) => e.message);
        next(new HttpError(400, errorMessages.join(', ')));
      } else {
        next(error);
      }
    }
  };
};

/**
 * Catch-all handler for unmatched routes — passes a 404 `HttpError` to the
 * next error handler.
 *
 * @param _req - Express request (unused).
 * @param _res - Express response (unused).
 * @param next - Express next function.
 */
export const notFound = (_req: Request, _res: Response, next: NextFunction) => {
  next(new HttpError(404, 'Not Found'));
};

/**
 * Centralised Express error handler.  Logs the error and responds with a JSON
 * body containing `message` (and `stack` in non-production environments).
 *
 * @param err - The `HttpError` (or any error cast to it) thrown upstream.
 * @param _req - Express request (unused).
 * @param res - Express response used to send the error JSON.
 * @param _next - Express next function (required by Express error-handler signature, unused).
 */
export const errorHandler = (
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  logger.error(`${err.message} - ${err.stack}`);
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
