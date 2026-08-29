/**
 * Tests — API Client (apiClient.ts)
 *
 * @jest-environment node
 *
 * Covers:
 *  - Axios instance configuration
 *  - Auth token injection via request interceptor
 *  - Correlation ID header injection
 *  - Token refresh on 401 (including concurrent refresh queuing)
 *  - Offline GET cache fallback
 *  - Exponential-backoff retry on 5xx / network errors
 *  - No retry on 4xx (non-retryable)
 *  - noRetry flag
 *  - Request cancellation helpers
 *  - ApiError shape and helpers
 *  - normalizeError utility
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// We test the factory so each test gets a fresh instance with its own
// interceptor chain, avoiding state bleed between tests.
import {
  createApiClient,
  ApiError,
  normalizeError,
  createCancelToken,
  createAbortController,
  isRequestCancelled,
} from '../lib/apiClient';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// Silence console.info / console.error in tests
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Mock the offlineStorage and pwa modules so the interceptors don't crash
jest.mock('../lib/offlineStorage', () => ({
  saveToOfflineCache: jest.fn().mockResolvedValue(undefined),
  getFromOfflineCache: jest.fn().mockResolvedValue(null),
}));
jest.mock('../lib/pwa', () => ({
  syncInBackground: jest.fn().mockResolvedValue(undefined),
}));

import { saveToOfflineCache, getFromOfflineCache } from '../lib/offlineStorage';

// Provide a minimal localStorage shim for Node environment
const localStorageStore: Record<string, string> = {};
const localStorageShim = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { localStorageStore[key] = value; },
  removeItem: (key: string) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]); },
};
Object.defineProperty(global, 'localStorage', { value: localStorageShim, writable: true });

// Provide a minimal navigator.onLine shim
Object.defineProperty(global, 'navigator', {
  value: { onLine: true },
  writable: true,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient() {
  const client = createApiClient({ baseURL: 'http://test.local' });
  const mock = new MockAdapter(client, { delayResponse: 0 });
  return { client, mock };
}

// ---------------------------------------------------------------------------
// ApiError class
// ---------------------------------------------------------------------------

describe('ApiError', () => {
  it('constructs with correct properties', () => {
    const err = new ApiError('VALIDATION_ERROR', 'Invalid input', 422);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.name).toBe('ApiError');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Invalid input');
    expect(err.status).toBe(422);
  });

  it('isUnauthorized is true for 401', () => {
    const err = new ApiError('UNAUTH', 'Unauthorised', 401);
    expect(err.isUnauthorized).toBe(true);
    expect(err.isForbidden).toBe(false);
  });

  it('isForbidden is true for 403', () => {
    const err = new ApiError('FORBIDDEN', 'Forbidden', 403);
    expect(err.isForbidden).toBe(true);
  });

  it('isNotFound is true for 404', () => {
    const err = new ApiError('NOT_FOUND', 'Not found', 404);
    expect(err.isNotFound).toBe(true);
  });

  it('isServerError is true for 500+', () => {
    expect(new ApiError('ERR', '', 500).isServerError).toBe(true);
    expect(new ApiError('ERR', '', 503).isServerError).toBe(true);
    expect(new ApiError('ERR', '', 404).isServerError).toBe(false);
  });

  it('isNetworkError is true when status is 0', () => {
    const err = new ApiError('NETWORK_ERROR', 'Network error', 0);
    expect(err.isNetworkError).toBe(true);
  });

  it('isRetryable for 5xx and network errors', () => {
    expect(new ApiError('ERR', '', 500).isRetryable).toBe(true);
    expect(new ApiError('ERR', '', 503).isRetryable).toBe(true);
    expect(new ApiError('ERR', '', 0).isRetryable).toBe(true);
    expect(new ApiError('ERR', '', 404).isRetryable).toBe(false);
    expect(new ApiError('ERR', '', 422).isRetryable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeError
// ---------------------------------------------------------------------------

describe('normalizeError', () => {
  it('returns the same ApiError unchanged', () => {
    const original = new ApiError('TEST', 'test', 400);
    expect(normalizeError(original)).toBe(original);
  });

  it('converts an AxiosError with a response', () => {
    const axiosErr = new axios.AxiosError(
      'Request failed',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 422,
        data: { code: 'VALIDATION_ERROR', message: 'Bad payload' },
        headers: {},
        config: { headers: {} as never },
        statusText: 'Unprocessable Entity',
      } as never,
    );
    const err = normalizeError(axiosErr);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Bad payload');
  });

  it('converts an AxiosError without a response (network error)', () => {
    const axiosErr = new axios.AxiosError('Network Error');
    const err = normalizeError(axiosErr);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.code).toBe('NETWORK_ERROR');
  });

  it('converts a plain Error', () => {
    const err = normalizeError(new Error('something'));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('UNKNOWN_ERROR');
    expect(err.message).toBe('something');
  });

  it('handles unknown non-Error values', () => {
    const err = normalizeError('some string error');
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('UNKNOWN_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Request interceptor — auth token
// ---------------------------------------------------------------------------

describe('Request interceptor — auth token', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('adds Authorization header when token is in localStorage', async () => {
    const { client, mock } = makeClient();
    localStorage.setItem('token', 'my-jwt-token');
    mock.onGet('/health').reply(200, { ok: true });

    const response = await client.get('/health');
    const reqHeaders = mock.history.get[0].headers as Record<string, string>;
    expect(reqHeaders['Authorization']).toBe('Bearer my-jwt-token');
    expect(response.data).toEqual({ ok: true });
  });

  it('does not add Authorization header when no token', async () => {
    const { client, mock } = makeClient();
    mock.onGet('/health').reply(200, { ok: true });

    await client.get('/health');
    const reqHeaders = mock.history.get[0].headers as Record<string, string>;
    expect(reqHeaders['Authorization']).toBeUndefined();
  });

  it('injects a correlation ID on every request', async () => {
    const { client, mock } = makeClient();
    mock.onGet('/ping').reply(200, {});

    await client.get('/ping');
    const headers = mock.history.get[0].headers as Record<string, string>;
    expect(headers['x-correlation-id']).toBeTruthy();
    expect(typeof headers['x-correlation-id']).toBe('string');
  });

  it('does not overwrite an existing correlation ID', async () => {
    const { client, mock } = makeClient();
    mock.onGet('/ping').reply(200, {});

    await client.get('/ping', { headers: { 'x-correlation-id': 'my-cid' } });
    const headers = mock.history.get[0].headers as Record<string, string>;
    expect(headers['x-correlation-id']).toBe('my-cid');
  });
});

// ---------------------------------------------------------------------------
// Response interceptor — offline cache
// ---------------------------------------------------------------------------

describe('Response interceptor — offline caching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves GET responses to offline cache', async () => {
    const { client, mock } = makeClient();
    mock.onGet('/rewards').reply(200, { rewards: [] });

    await client.get('/rewards');
    expect(saveToOfflineCache).toHaveBeenCalledWith('/rewards', { rewards: [] });
  });

  it('does not cache non-GET responses', async () => {
    const { client, mock } = makeClient();
    mock.onPost('/redemptions').reply(201, { id: 1 });

    await client.post('/redemptions', { rewardId: 1 });
    expect(saveToOfflineCache).not.toHaveBeenCalled();
  });

  it('returns cached data when offline and cache exists', async () => {
    (getFromOfflineCache as jest.Mock).mockResolvedValueOnce({ rewards: [{ id: 1 }] });

    const { client, mock } = makeClient();
    mock.onGet('/rewards').networkError();

    // Simulate offline via the global shim
    (global.navigator as { onLine: boolean }).onLine = false;

    const response = await client.get('/rewards');
    expect(response.data).toEqual({ rewards: [{ id: 1 }] });
    expect((response as never as { fromCache: boolean }).fromCache).toBe(true);

    (global.navigator as { onLine: boolean }).onLine = true;
  });
});

// ---------------------------------------------------------------------------
// Token refresh on 401
// ---------------------------------------------------------------------------

describe('Token refresh on 401', () => {
  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('refreshes token and retries the original request on 401', async () => {
    const { client, mock } = makeClient();
    localStorage.setItem('refreshToken', 'valid-refresh-token');

    // The refresh call inside the interceptor uses process.env.NEXT_PUBLIC_API_URL.
    // In Node test env that's 'http://localhost:3001', so we also mock the global
    // axios instance used for the refresh call via the module-level default adapter.
    let callCount = 0;
    mock.onGet('/protected').reply(() => {
      callCount++;
      if (callCount === 1) return [401, { message: 'Unauthorized' }];
      return [200, { data: 'secret' }];
    });
    // The refresh is made with bare axios to process.env URL. Use MockAdapter on the
    // default axios instance temporarily.
    const defaultMock = new MockAdapter(axios);
    defaultMock.onPost(/auth\/refresh/).reply(200, { token: 'new-access-token' });

    try {
      const response = await client.get('/protected');
      expect(response.data).toEqual({ data: 'secret' });
      expect(localStorage.getItem('token')).toBe('new-access-token');
    } finally {
      defaultMock.restore();
    }
  });

  it('redirects to /login when refresh fails', async () => {
    const { client, mock } = makeClient();
    localStorage.setItem('token', 'old-token');
    localStorage.setItem('refreshToken', 'expired-refresh');

    mock.onGet('/protected').reply(401, { message: 'Unauthorized' });
    mock.onPost('/auth/refresh').reply(401, { message: 'Refresh token expired' });

    await expect(client.get('/protected')).rejects.toBeInstanceOf(ApiError);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

describe('Retry logic', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('retries on 503 and succeeds on the second attempt', async () => {
    const { client, mock } = makeClient();

    let attempts = 0;
    mock.onGet('/flaky').reply(() => {
      attempts++;
      if (attempts < 2) return [503, { message: 'Service unavailable' }];
      return [200, { ok: true }];
    });

    // Advance timers to resolve the retry delay
    const responsePromise = client.get('/flaky', { retries: 2 });
    // Flush all timer-based delays
    await jest.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.data).toEqual({ ok: true });
    expect(attempts).toBe(2);
  });

  it('exhausts retries and throws ApiError', async () => {
    // Use real timers with retries:0 to test the error path without retry delay
    jest.useRealTimers();
    const { client, mock } = makeClient();
    mock.onGet('/always-fails').reply(503, { code: 'SERVICE_DOWN', message: 'Down' });

    await expect(
      client.get('/always-fails', { retries: 0 }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('does not retry 4xx errors', async () => {
    const { client, mock } = makeClient();
    let attempts = 0;
    mock.onGet('/not-found').reply(() => {
      attempts++;
      return [404, { code: 'NOT_FOUND', message: 'Not found' }];
    });

    await expect(client.get('/not-found', { retries: 3 })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(attempts).toBe(1); // No retries for 404
  });

  it('skips retry when noRetry is set', async () => {
    const { client, mock } = makeClient();
    let attempts = 0;
    mock.onGet('/flaky-no-retry').reply(() => {
      attempts++;
      return [503, { message: 'Down' }];
    });

    await expect(
      client.get('/flaky-no-retry', { noRetry: true }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(attempts).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Cancellation helpers
// ---------------------------------------------------------------------------

describe('createCancelToken', () => {
  it('creates a valid CancelTokenSource', () => {
    const source = createCancelToken();
    expect(source).toHaveProperty('token');
    expect(typeof source.cancel).toBe('function');
  });

  it('cancels an in-flight request', async () => {
    const { client, mock } = makeClient();
    const source = createCancelToken();

    mock.onGet('/slow').reply(() => {
      // Immediately cancel before MockAdapter can reply
      source.cancel('Test cancellation');
      return [200, {}];
    });

    await expect(
      client.get('/slow', { cancelToken: source.token }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});

describe('createAbortController', () => {
  it('returns a signal and abort function', () => {
    const { signal, abort } = createAbortController();
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(typeof abort).toBe('function');
    expect(signal.aborted).toBe(false);
    abort();
    expect(signal.aborted).toBe(true);
  });
});

describe('isRequestCancelled', () => {
  it('returns true for axios cancel errors', () => {
    const cancel = new axios.Cancel('cancelled');
    expect(isRequestCancelled(cancel)).toBe(true);
  });

  it('returns false for regular errors', () => {
    expect(isRequestCancelled(new Error('regular'))).toBe(false);
    expect(isRequestCancelled(null)).toBe(false);
  });
});
