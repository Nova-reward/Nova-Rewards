/**
 * Nova Rewards — Request / Response Transformers
 *
 * Centralised transformation layer so every layer above it (hooks, services,
 * components) always receives consistent, camelCase-keyed objects regardless
 * of what the backend sends.
 *
 * Exports:
 *  - camelizeKeys / snakerizeKeys  — recursive case converters
 *  - transformRequest              — applied before a request is sent
 *  - transformResponse             — applied after a response is received
 *  - unwrapEnvelope                — strips the { success, data } wrapper
 *  - paginatedTransform            — builds a consistent PaginatedResult<T>
 */

// ---------------------------------------------------------------------------
// Key-case converters
// ---------------------------------------------------------------------------

/** Convert a single snake_case string to camelCase */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

/** Convert a single camelCase string to snake_case */
export function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, (char: string) => `_${char.toLowerCase()}`);
}

/**
 * Recursively convert all object keys from snake_case → camelCase.
 * Arrays and nested objects are handled transparently.
 * Primitives and Dates are returned unchanged.
 */
export function camelizeKeys<T = unknown>(data: unknown): T {
  if (Array.isArray(data)) {
    return data.map(camelizeKeys) as unknown as T;
  }

  if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([key, value]) => [
        toCamelCase(key),
        camelizeKeys(value),
      ]),
    ) as T;
  }

  return data as T;
}

/**
 * Recursively convert all object keys from camelCase → snake_case.
 * Useful for serialising request bodies to what the backend expects.
 */
export function snakerizeKeys<T = unknown>(data: unknown): T {
  if (Array.isArray(data)) {
    return data.map(snakerizeKeys) as unknown as T;
  }

  if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([key, value]) => [
        toSnakeCase(key),
        snakerizeKeys(value),
      ]),
    ) as T;
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Standard API envelope types
// ---------------------------------------------------------------------------

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

export interface PaginatedEnvelope<T = unknown> extends ApiEnvelope<T[]> {
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
  has_more?: boolean;
  nextCursor?: string;
  next_cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

// ---------------------------------------------------------------------------
// Envelope helpers
// ---------------------------------------------------------------------------

/**
 * Unwrap the standard `{ success, data }` envelope that every Nova backend
 * route returns.  If the response is already a plain value (legacy routes)
 * it is returned as-is after camelization.
 */
export function unwrapEnvelope<T>(raw: unknown): T {
  if (
    raw !== null &&
    typeof raw === 'object' &&
    'success' in (raw as object) &&
    'data' in (raw as object)
  ) {
    const envelope = raw as ApiEnvelope<unknown>;
    return camelizeKeys<T>(envelope.data);
  }
  return camelizeKeys<T>(raw);
}

/**
 * Unwrap a paginated envelope, normalising all the different ways the backend
 * might spell `hasMore`, `nextCursor`, etc.
 */
export function unwrapPaginated<T>(raw: unknown): PaginatedResult<T> {
  const envelope = (
    raw !== null && typeof raw === 'object' ? raw : {}
  ) as PaginatedEnvelope<unknown>;

  const rawItems: unknown[] =
    (envelope.data as unknown[]) ??
    ((raw as Record<string, unknown>)?.['items'] as unknown[]) ??
    ((raw as Record<string, unknown>)?.['campaigns'] as unknown[]) ??
    ((raw as Record<string, unknown>)?.['rewards'] as unknown[]) ??
    ((raw as Record<string, unknown>)?.['transactions'] as unknown[]) ??
    (Array.isArray(raw) ? (raw as unknown[]) : []);

  return {
    items: rawItems.map((item) => camelizeKeys<T>(item)),
    total: envelope.total ?? rawItems.length,
    page: envelope.page ?? 1,
    limit: envelope.limit ?? rawItems.length,
    hasMore: envelope.hasMore ?? envelope.has_more ?? false,
    nextCursor: envelope.nextCursor ?? envelope.next_cursor,
  };
}

// ---------------------------------------------------------------------------
// Axios transform functions
// ---------------------------------------------------------------------------

/**
 * Axios `transformRequest` handler.
 * Serialises outbound request bodies from camelCase → snake_case JSON.
 *
 * Usage:
 *   axios.create({ transformRequest: [transformRequest, ...axios.defaults.transformRequest] })
 *
 * Skips FormData / Blob payloads that should be sent as-is.
 */
export function transformRequest(data: unknown): unknown {
  if (
    data === null ||
    data === undefined ||
    data instanceof FormData ||
    data instanceof Blob ||
    data instanceof ArrayBuffer ||
    typeof data === 'string'
  ) {
    return data;
  }

  try {
    return JSON.stringify(snakerizeKeys(data));
  } catch {
    return data;
  }
}

/**
 * Axios `transformResponse` handler.
 * Parses JSON and converts all keys to camelCase.
 *
 * Usage:
 *   axios.create({ transformResponse: [...axios.defaults.transformResponse, transformResponse] })
 */
export function transformResponse(data: unknown): unknown {
  if (typeof data === 'string') {
    try {
      return camelizeKeys(JSON.parse(data));
    } catch {
      return data;
    }
  }
  return camelizeKeys(data);
}
