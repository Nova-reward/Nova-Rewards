import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException } from '@nestjs/common';
import { Response } from 'express';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    const formattedResponse = {
      error: 'Validation failed',
      statusCode: status,
      timestamp: new Date().toISOString(),
      details: exceptionResponse.details || exceptionResponse.message || 'Invalid request data',
    };

    response.status(status).json(formattedResponse);
  }
}
