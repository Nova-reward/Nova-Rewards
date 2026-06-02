import { PipeTransform, Injectable, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(
    private schema: ZodSchema,
    private options?: {
      stripUnknown?: boolean;
      type?: 'body' | 'query' | 'param';
    }
  ) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (this.options?.type && metadata.type !== this.options.type) {
      return value;
    }

    try {
      const parsed = this.schema.parse(value);
      if (this.options?.stripUnknown) {
        return parsed;
      }
      return parsed;
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedError = fromZodError(error, {
          prefix: 'Validation failed',
          includePath: true,
        });
        
        throw new BadRequestException({
          error: 'Validation failed',
          details: formattedError.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
          statusCode: 400,
        });
      }
      throw error;
    }
  }
}
