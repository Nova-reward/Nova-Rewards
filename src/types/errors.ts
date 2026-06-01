export type ErrorType = 'network' | 'server' | 'client' | 'unknown';

export interface AppError {
  type: ErrorType;
  message: string;
  statusCode?: number;
  originalError?: Error;
  retryable: boolean;
}

export class NetworkError extends Error {
  constructor(message: string = 'Network connection failed. Please check your internet connection.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ServerError extends Error {
  public readonly statusCode: number;
  
  constructor(statusCode: number, message?: string) {
    super(message || `Server error (${statusCode}). Please try again later.`);
    this.name = 'ServerError';
    this.statusCode = statusCode;
  }
}

export class ClientError extends Error {
  public readonly statusCode: number;
  
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ClientError';
    this.statusCode = statusCode;
  }
}

export function getErrorType(error: unknown): AppError {
  if (error instanceof NetworkError) {
    return {
      type: 'network',
      message: error.message,
      retryable: true,
    };
  }
  
  if (error instanceof ServerError) {
    return {
      type: 'server',
      message: error.message,
      statusCode: error.statusCode,
      retryable: error.statusCode >= 500,
    };
  }
  
  if (error instanceof ClientError) {
    return {
      type: 'client',
      message: error.message,
      statusCode: error.statusCode,
      retryable: false,
    };
  }
  
  if (error instanceof Error) {
    return {
      type: 'unknown',
      message: error.message || 'An unexpected error occurred',
      originalError: error,
      retryable: true,
    };
  }
  
  return {
    type: 'unknown',
    message: 'An unexpected error occurred',
    retryable: true,
  };
}
