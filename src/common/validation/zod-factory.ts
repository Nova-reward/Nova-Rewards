import { ZodSchema, ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { BadRequestException } from '@nestjs/common';

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export function formatZodError(error: ZodError): ValidationErrorDetail[] {
  const formattedError = fromZodError(error, {
    prefix: '',
    includePath: true,
  });
  
  return formattedError.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message,
  }));
}

export function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = formatZodError(error);
      throw new BadRequestException({
        error: 'Validation failed',
        details,
        statusCode: 400,
      });
    }
    throw error;
  }
}

export function createValidator<T>(schema: ZodSchema<T>) {
  return (data: unknown): T => validateOrThrow(schema, data);
}
