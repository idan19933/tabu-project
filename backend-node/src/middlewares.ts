import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, z } from 'zod';
import { HttpError } from './lib/HttpError';
import { logger } from './config/logger';

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

export const notFound = (_req: Request, _res: Response, next: NextFunction) => {
  next(new HttpError(404, 'Not Found'));
};

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
