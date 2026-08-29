/**
 * Nova Rewards — Axios API Client
 *
 * Centralised HTTP client with:
 *  - Auth token injection + automatic token refresh
 *  - Correlation-ID header for distributed tracing
 *  - Configurable exponential-backoff retry (network/5xx errors)
 *  - Request cancellation via AbortController / CancelToken helpers
 *  - Request / response transformation hooks
 *  - Structured error normalisation (ApiError)
 *  - Offline detection + GET response caching
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
  CancelTokenSource,
} from 'axios';
import { saveToOfflineCache, getFromOfflineCache } from './offlineStorage';
import { syncInBackground } from './pwa';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRY_ATTEMPTS = 3;
/** Initial delay in ms; doubles on each retry (jitter added) */
const RETRY_BASE_DELAY_MS = 300;

// HTTP status codes that are safe to retry
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiClientConfig extends AxiosRequestConfig {
  /** Override per-request retry count (default: MAX_RETRY_ATTEMPTS) */
  retries?: number;
  /** Skip retry logic entirely for this request */
  noRetry?: boolean;
}

/** Extended request config stored on axios internally */
interface ExtendedInternalConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
  _retry?: boolean;
  retries?: number;
  noRetry?: boolean;
}

// ---------------------------------------------------------------------------
// Structured error class
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  /** Backend error code, e.g. "VALIDATION_ERROR" */
  readonly code: string;
  /** HTTP status code (0 for network errors) */
  readonly status: number;
  /** Raw Axios response, if available */
  readonly response?: AxiosResponse;
  /** Correlation ID from the server response header */
  readonly correlationId?: string;

  constructor(
    code: string,
    message: string,
    status: number,
    response?: AxiosResponse,
    correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.response = response;
    this.correlationId = correlationId;
  }

  get isNetworkError() {
    return this.status === 0;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isServerError() {
    return this.status >= 500;
  }

  get isRetryable() {
    return RETRYABLE_STATUS_CODES.has(this.status) || this.isNetworkError;
  }
}

// ---------------------------------------------------------------------------
// Error normalisation
// ---------------------------------------------------------------------------

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{
      code?: string;
      message?: string;
      error?: string;
    }>;
    const status = axiosErr.response?.status ?? 0;
    const data = axiosErr.response?.data;
    const correlationId =
      (axiosErr.response?.headers?.['x-correlation-id'] as string | undefined) ??
      (axiosErr.config?.headers?.['x-correlation-id'] as string | undefined);

    const code = data?.code ?? (status === 0 ? 'NETWORK_ERROR' : 'API_ERROR');
    const message =
      data?.message ?? data?.error ?? axiosErr.message ?? 'An unexpected error occurred';

    return new ApiError(code, message, status, axiosErr.response, correlationId);
  }

  if (error instanceof Error) {
    return new ApiError('UNKNOWN_ERROR', error.message, 0);
  }

  return new ApiError('UNKNOWN_ERROR', 'An unexpected error occurred', 0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a v4-like UUID for correlation IDs */
function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Exponential backoff delay with ±20 % jitter */
function retryDelay(attempt: number): number {
  const base = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = base * 0.2 * (Math.random() * 2 - 1); // ±20%
  return Math.max(0, base + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Token refresh state (shared across all retries)
// ---------------------------------------------------------------------------

let isRefreshingToken = false;
let pendingRefreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function flushRefreshQueue(token: string) {
  pendingRefreshQueue.forEach(({ resolve }) => resolve(token));
  pendingRefreshQueue = [];
}

function rejectRefreshQueue(err: unknown) {
  pendingRefreshQueue.forEach(({ reject }) => reject(err));
  pendingRefreshQueue = [];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createApiClient(overrides: AxiosRequestConfig = {}): AxiosInstance {
  const instance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
    timeout: DEFAULT_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...overrides,
  });

  // ── Request interceptor ──────────────────────────────────────────────────

  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // 1. Auth token
      if (typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      // 2. Correlation ID for distributed tracing
      const existing =
        config.headers['x-correlation-id'] ?? config.headers['X-Correlation-Id'];
      if (!existing) {
        config.headers['x-correlation-id'] = generateCorrelationId();
      }

      return config;
    },
    (error: unknown) => Promise.reject(error),
  );

  // ── Response interceptor ─────────────────────────────────────────────────

  instance.interceptors.response.use(
    // ── Success path ──
    async (response: AxiosResponse) => {
      // Cache successful GET responses for offline use
      if (response.config.method?.toLowerCase() === 'get' && response.config.url) {
        await saveToOfflineCache(response.config.url, response.data).catch(() => {
          // Non-fatal — never break the response path due to cache failure
        });
      }
      return response;
    },

    // ── Error path ──
    async (error: unknown) => {
      if (!axios.isAxiosError(error)) {
        return Promise.reject(normalizeError(error));
      }

      const originalConfig = error.config as ExtendedInternalConfig | undefined;
      const status = error.response?.status;

      // ── 401: Token refresh ──────────────────────────────────────────────
      if (status === 401 && originalConfig && !originalConfig._retry) {
        originalConfig._retry = true;

        if (isRefreshingToken) {
          // Queue the request until the ongoing refresh completes
          return new Promise<AxiosResponse>((resolve, reject) => {
            pendingRefreshQueue.push({
              resolve: (newToken) => {
                if (originalConfig.headers) {
                  originalConfig.headers.Authorization = `Bearer ${newToken}`;
                }
                resolve(instance(originalConfig));
              },
              reject,
            });
          });
        }

        isRefreshingToken = true;

        try {
          const refreshToken =
            typeof localStorage !== 'undefined'
              ? localStorage.getItem('refreshToken')
              : null;

          if (!refreshToken) throw new Error('No refresh token available');

          const refreshResponse = await axios.post<{ token: string }>(
            `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/refresh`,
            { refreshToken },
          );

          const { token: newToken } = refreshResponse.data;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('token', newToken);
          }
          instance.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          flushRefreshQueue(newToken);

          if (originalConfig.headers) {
            originalConfig.headers.Authorization = `Bearer ${newToken}`;
          }
          return instance(originalConfig);
        } catch (refreshError) {
          rejectRefreshQueue(refreshError);
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
          }
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return Promise.reject(normalizeError(refreshError));
        } finally {
          isRefreshingToken = false;
        }
      }

      // ── Offline fallback ────────────────────────────────────────────────
      const isOffline =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        error.message === 'Network Error';

      if (isOffline && originalConfig) {
        const url = originalConfig.url ?? '';
        const method = originalConfig.method?.toLowerCase() ?? '';

        if (method === 'get' && url) {
          const cached = await getFromOfflineCache(url).catch(() => null);
          if (cached) {
            // Return a synthetic response so callers don't need to special-case this
            return {
              data: cached,
              status: 200,
              statusText: 'OK (cached)',
              headers: {},
              config: originalConfig,
              fromCache: true,
            } as AxiosResponse;
          }
        }

        if (['post', 'put', 'delete', 'patch'].includes(method)) {
          await syncInBackground('sync-transactions').catch(() => {});
        }
      }

      // ── Retry logic ─────────────────────────────────────────────────────
      if (originalConfig && !originalConfig.noRetry) {
        const maxRetries = originalConfig.retries ?? MAX_RETRY_ATTEMPTS;
        const currentAttempt = originalConfig._retryCount ?? 0;
        const isRetryableStatus =
          !status || RETRYABLE_STATUS_CODES.has(status) || isOffline;

        if (isRetryableStatus && currentAttempt < maxRetries) {
          originalConfig._retryCount = currentAttempt + 1;
          const delay = retryDelay(currentAttempt);
          await sleep(delay);
          return instance(originalConfig);
        }
      }

      return Promise.reject(normalizeError(error));
    },
  );

  return instance;
}

// ---------------------------------------------------------------------------
// Default singleton instance
// ---------------------------------------------------------------------------

/** Pre-configured singleton — use this throughout the app */
const apiClient = createApiClient();

export default apiClient;

// ---------------------------------------------------------------------------
// Request cancellation helpers
// ---------------------------------------------------------------------------

/**
 * Creates a CancelToken source compatible with Axios.
 * Use `source.token` in the request config and `source.cancel()` to abort.
 *
 * @example
 * const source = createCancelToken();
 * api.get('/endpoint', { cancelToken: source.token });
 * // later…
 * source.cancel('User navigated away');
 */
export function createCancelToken(): CancelTokenSource {
  return axios.CancelToken.source();
}

/**
 * Returns true if the given error was caused by an explicit cancellation.
 */
export function isRequestCancelled(error: unknown): boolean {
  return axios.isCancel(error);
}

/**
 * Manages AbortController-based cancellation (native fetch / newer Axios).
 * Useful in React hooks where you want to cancel on unmount.
 *
 * @example
 * const { signal, abort } = createAbortController();
 * api.get('/endpoint', { signal });
 * return () => abort(); // cleanup
 */
export function createAbortController(): { signal: AbortSignal; abort: () => void } {
  const controller = new AbortController();
  return { signal: controller.signal, abort: () => controller.abort() };
}
