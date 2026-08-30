import {
  classifyErrorType,
  createStructuredError,
  getErrorSeverity,
  getUserErrorMessage,
  isErrorRetryable,
  wrapApiError,
  wrapBlockchainError,
} from '@/lib/errorService';
import { ErrorType, ErrorSeverity } from '@/lib/errorService';

describe('Error Handling Service', () => {
  describe('classifyErrorType', () => {
    it('should classify 404 as not_found', () => {
      expect(classifyErrorType(new Error('Not found'), 404)).toBe('not_found');
    });

    it('should classify 401 as unauthorized', () => {
      expect(classifyErrorType(new Error('Unauthorized'), 401)).toBe(
        'unauthorized'
      );
    });

    it('should classify 403 as forbidden', () => {
      expect(classifyErrorType(new Error('Forbidden'), 403)).toBe('forbidden');
    });

    it('should classify 5xx as server', () => {
      expect(classifyErrorType(new Error('Server error'), 500)).toBe('server');
    });

    it('should classify network errors', () => {
      const error = new Error('Network request failed');
      expect(classifyErrorType(error)).toBe('network');
    });

    it('should classify timeout errors', () => {
      const error = new Error('Request timeout');
      expect(classifyErrorType(error)).toBe('timeout');
    });

    it('should classify blockchain errors', () => {
      const error = new Error('Stellar contract error');
      expect(classifyErrorType(error)).toBe('blockchain');
    });

    it('should classify wallet errors', () => {
      const error = new Error('Wallet connection failed');
      expect(classifyErrorType(error)).toBe('wallet');
    });

    it('should default to unknown for unrecognized errors', () => {
      const error = new Error('Some random error');
      expect(classifyErrorType(error)).toBe('unknown');
    });
  });

  describe('getErrorSeverity', () => {
    it('should return warning for not_found', () => {
      expect(getErrorSeverity('not_found')).toBe('warning');
    });

    it('should return error for blockchain errors', () => {
      expect(getErrorSeverity('blockchain')).toBe('error');
    });

    it('should return critical for server errors', () => {
      expect(getErrorSeverity('server')).toBe('critical');
    });

    it('should return warning for timeout', () => {
      expect(getErrorSeverity('timeout')).toBe('warning');
    });
  });

  describe('isErrorRetryable', () => {
    it('should mark network errors as retryable', () => {
      expect(isErrorRetryable('network')).toBe(true);
    });

    it('should mark timeout errors as retryable', () => {
      expect(isErrorRetryable('timeout')).toBe(true);
    });

    it('should mark server errors as retryable', () => {
      expect(isErrorRetryable('server')).toBe(true);
    });

    it('should not mark validation errors as retryable', () => {
      expect(isErrorRetryable('validation')).toBe(false);
    });

    it('should not mark not_found errors as retryable', () => {
      expect(isErrorRetryable('not_found')).toBe(false);
    });
  });

  describe('getUserErrorMessage', () => {
    it('should return appropriate message for each error type', () => {
      const errorTypes: ErrorType[] = [
        'not_found',
        'unauthorized',
        'forbidden',
        'validation',
        'network',
        'timeout',
        'server',
        'blockchain',
        'wallet',
        'unknown',
      ];

      errorTypes.forEach((type) => {
        const message = getUserErrorMessage(type);
        expect(message).toBeTruthy();
        expect(message.length > 0).toBe(true);
      });
    });

    it('should return user-friendly messages', () => {
      const message = getUserErrorMessage('network');
      expect(message).toContain('network');
      expect(message).toContain('connection');
    });
  });

  describe('createStructuredError', () => {
    it('should create a structured error from Error object', () => {
      const error = new Error('Test error');
      const structured = createStructuredError(error);

      expect(structured).toHaveProperty('type');
      expect(structured).toHaveProperty('severity');
      expect(structured).toHaveProperty('message');
      expect(structured).toHaveProperty('userMessage');
      expect(structured).toHaveProperty('retryable');
      expect(structured).toHaveProperty('timestamp');
    });

    it('should use provided options', () => {
      const error = new Error('Test error');
      const structured = createStructuredError(error, {
        type: 'validation',
        userMessage: 'Custom message',
        details: { field: 'email' },
      });

      expect(structured.type).toBe('validation');
      expect(structured.userMessage).toBe('Custom message');
      expect(structured.details).toEqual({ field: 'email' });
    });

    it('should set retryable based on error type', () => {
      const networkError = createStructuredError(
        new Error('Network error'),
        { type: 'network' }
      );
      expect(networkError.retryable).toBe(true);

      const notFoundError = createStructuredError(
        new Error('Not found'),
        { type: 'not_found' }
      );
      expect(notFoundError.retryable).toBe(false);
    });

    it('should include timestamp', () => {
      const beforeTime = Date.now();
      const structured = createStructuredError(new Error('Test'));
      const afterTime = Date.now();

      expect(structured.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(structured.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('wrapApiError', () => {
    it('should extract status code from API error', () => {
      const error = new Error('API error') as any;
      error.response = { status: 404, data: { message: 'Not found' } };
      error.config = { url: '/api/test', method: 'GET' };

      const wrapped = wrapApiError(error);

      expect(wrapped.statusCode).toBe(404);
      expect(wrapped.type).toBe('not_found');
      expect(wrapped.details).toHaveProperty('endpoint');
      expect(wrapped.details).toHaveProperty('method');
      expect(wrapped.details).toHaveProperty('responseData');
    });

    it('should handle 500 errors as server errors', () => {
      const error = new Error('Server error') as any;
      error.response = { status: 500 };
      error.config = { url: '/api/test' };

      const wrapped = wrapApiError(error);

      expect(wrapped.type).toBe('server');
      expect(wrapped.severity).toBe('critical');
    });

    it('should handle validation errors', () => {
      const error = new Error('Validation failed') as any;
      error.response = {
        status: 422,
        data: { errors: { email: 'Invalid email' } },
      };
      error.config = { url: '/api/test', method: 'POST' };

      const wrapped = wrapApiError(error);

      expect(wrapped.type).toBe('validation');
      expect(wrapped.retryable).toBe(false);
    });
  });

  describe('wrapBlockchainError', () => {
    it('should classify blockchain errors', () => {
      const error = new Error('Stellar contract error');
      const wrapped = wrapBlockchainError(error, 'contract_call');

      expect(wrapped.type).toBe('blockchain');
      expect(wrapped.details).toHaveProperty('context');
      expect(wrapped.details?.context).toBe('contract_call');
    });

    it('should classify wallet errors', () => {
      const error = new Error('Wallet connection failed');
      const wrapped = wrapBlockchainError(error, 'wallet_connect');

      expect(wrapped.type).toBe('wallet');
    });

    it('should preserve original error message', () => {
      const originalMessage = 'Custom blockchain error';
      const error = new Error(originalMessage);
      const wrapped = wrapBlockchainError(error);

      expect(wrapped.details?.originalMessage).toBe(originalMessage);
    });
  });

  describe('Error Type Coverage', () => {
    it('should have all error types covered', () => {
      const errorTypes: ErrorType[] = [
        'not_found',
        'unauthorized',
        'forbidden',
        'validation',
        'network',
        'timeout',
        'server',
        'blockchain',
        'wallet',
        'unknown',
      ];

      errorTypes.forEach((type) => {
        const structured = createStructuredError(new Error('Test'), {
          type,
        });

        expect(structured.type).toBe(type);
        expect(structured.userMessage).toBeTruthy();
        expect(
          ['info', 'warning', 'error', 'critical'].includes(
            structured.severity
          )
        ).toBe(true);
      });
    });
  });

  describe('Structured Error Properties', () => {
    it('should have all required properties', () => {
      const structured = createStructuredError(new Error('Test'));

      expect(structured).toHaveProperty('type');
      expect(structured).toHaveProperty('severity');
      expect(structured).toHaveProperty('message');
      expect(structured).toHaveProperty('userMessage');
      expect(structured).toHaveProperty('retryable');
      expect(structured).toHaveProperty('timestamp');
      expect(structured).toHaveProperty('originalError');
    });

    it('should allow optional properties', () => {
      const structured = createStructuredError(new Error('Test'), {
        statusCode: 404,
        retryAfter: 5000,
        requestId: 'req-123',
      });

      expect(structured.statusCode).toBe(404);
      expect(structured.retryAfter).toBe(5000);
      expect(structured.requestId).toBe('req-123');
    });
  });

  describe('Error Type Auto-Detection', () => {
    const testCases = [
      { error: new Error('404 Not Found'), expectedType: 'not_found' },
      {
        error: new Error('Unauthorized access'),
        expectedType: 'unauthorized',
      },
      { error: new Error('Network timeout'), expectedType: 'timeout' },
      { error: new Error('Connection refused'), expectedType: 'network' },
      { error: new Error('Contract execution failed'), expectedType: 'blockchain' },
      { error: new Error('Wallet rejected'), expectedType: 'wallet' },
    ];

    testCases.forEach(({ error, expectedType }) => {
      it(`should detect ${expectedType} from error message`, () => {
        const structured = createStructuredError(error);
        expect(structured.type).toBe(expectedType);
      });
    });
  });
});
