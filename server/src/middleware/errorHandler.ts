import type { Request, Response, NextFunction } from 'express';
import { NODE_ENV } from '../config/env.js';

export interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
}

/**
 * 404 Handler for undefined routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Global Error Handler middleware.
 * - Prevents leaking stack traces and database schema in production.
 * - Formats standard JSON errors consistently across the entire API.
 *
 * Direct bridge to NestJS:
 * In NestJS, this maps directly to a global ExceptionFilter (@Catch(HttpException)).
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  // Always log full error on the server for telemetry & debugging
  console.error(`[Error] ${req.method} ${req.originalUrl} (${req.traceId || 'no-trace'}):`, err);

  const isProd = NODE_ENV === 'production';

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : err.name || 'Error',
    message: isProd && statusCode >= 500 ? 'An unexpected error occurred. Please try again later.' : err.message,
    ...(err.details ? { details: err.details } : {}),
    ...(!isProd && err.stack ? { stack: err.stack } : {}),
  });
}

