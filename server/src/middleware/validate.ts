import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';

/**
 * Express middleware that validates req.body against a Zod schema.
 * - Strips unrecognized keys (mass assignment protection).
 * - Converts input strings to numbers/dates if schema specifies coercion.
 * - Returns structured 400 Bad Request with field-level issues if validation fails.
 *
 * Direct bridge to NestJS:
 * In NestJS, this is handled globally by ValidationPipe and class-validator DTOs.
 */
export function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Extract clean, readable field errors
      const details = result.error.issues.map((err) => ({
        field: err.path.join('.') || 'body',
        message: err.message,
      }));

      res.status(400).json({
        error: 'Validation failed',
        message: details[0]?.message || 'Invalid input data',
        details,
      });
      return;
    }

    // Replace req.body with the sanitized and coerced data
    req.body = result.data;
    next();
  };
}
