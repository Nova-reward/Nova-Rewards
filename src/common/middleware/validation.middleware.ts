import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedError = fromZodError(error, {
          prefix: 'Validation failed',
          includePath: true,
        });
        
        return res.status(400).json({
          error: 'Validation failed',
          details: formattedError.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
          statusCode: 400,
        });
      }
      next(error);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedError = fromZodError(error, {
          prefix: 'Validation failed',
          includePath: true,
        });
        
        return res.status(400).json({
          error: 'Validation failed',
          details: formattedError.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
          statusCode: 400,
        });
      }
      next(error);
    }
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedError = fromZodError(error, {
          prefix: 'Validation failed',
          includePath: true,
        });
        
        return res.status(400).json({
          error: 'Validation failed',
          details: formattedError.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
          statusCode: 400,
        });
      }
      next(error);
    }
  };
}
