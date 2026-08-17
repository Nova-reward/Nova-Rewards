'use strict';

/**
 * Unit tests for searchService.js — Elasticsearch graceful degradation (#1235).
 *
 * Strategy: use the service's exported `_setClient` helper to inject a mock
 * ES client directly into the singleton, bypassing the need to intercept the
 * `@elastic/elasticsearch` CJS module (which is unreliable in this vitest/Vite
 * hybrid environment because third-party CJS packages are not inlined through
 * Vite's transform pipeline by default, so vi.mock hoisting cannot intercept
 * their require() calls from within the service).
 *
 * Covers:
 *   1. search() returns { hits: [], total: 0 } when ES throws ConnectionError
 *   2. search() returns { hits: [], total: 0 } when ES throws NoLivingConnectionsError
 *   3. error is NOT thrown (degraded path) for connectivity errors
 *   4. ResponseError (bad query) is still propagated — not swallowed
 *   5. suggest() returns [] when ES is unreachable
 *   6. search() returns real data when ES is reachable (happy path)
 *   7. indexReward() silently continues when ES is unreachable
 *   8. deleteDocument() silently continues when ES is unreachable
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Error class stubs — named to trigger the name-based fallback in
// isConnectivityError() since instanceof checks across mock boundaries may
// fail depending on how vitest loads the module.
// ---------------------------------------------------------------------------

class ConnectionError extends Error {
  constructor(msg) { super(msg); this.name = 'ConnectionError'; }
}
class NoLivingConnectionsError extends Error {
  constructor(msg) { super(msg); this.name = 'NoLivingConnectionsError'; }
}
class ResponseError extends Error {
  constructor(msg) { super(msg); this.name = 'ResponseError'; this.statusCode = 400; }
}

// ---------------------------------------------------------------------------
// Mock ES client methods as module-level fns so we can configure them per-test
// ---------------------------------------------------------------------------

const mockSearch = vi.fn();
const mockIndex  = vi.fn();
const mockDelete = vi.fn();

// The mock client object injected via _setClient()
const mockEsClient = {
  search:  mockSearch,
  index:   mockIndex,
  delete:  mockDelete,
  bulk:    vi.fn(),
  indices: {
    exists: vi.fn().mockResolvedValue(false),
    create: vi.fn().mockResolvedValue({}),
  },
};

// ---------------------------------------------------------------------------
// Import the service module.
// We use _setClient() to inject mockEsClient so that internal calls to
// getClient() inside search(), suggest(), indexReward(), etc. return our mock.
// ---------------------------------------------------------------------------

import {
  search,
  suggest,
  indexReward,
  deleteDocument,
  _setClient,
  _resetClient,
} from '../services/searchService.js';

// ---------------------------------------------------------------------------
// Helper: minimal ES search response
// ---------------------------------------------------------------------------

function fakeSearchResponse(hits = [], total = 0) {
  return {
    hits: {
      hits:  hits.map((src) => ({ _index: 'nova_rewards', _score: 1, _source: src, highlight: {} })),
      total: { value: total },
    },
    aggregations: {
      by_type:     { buckets: [] },
      active_count: { doc_count: 0 },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('searchService — graceful degradation (#1235)', () => {
  beforeEach(() => {
    // Inject the mock client so all internal getClient() calls return mockEsClient.
    // This avoids unreliable vi.mock hoisting for third-party CJS modules.
    _setClient(mockEsClient);
    mockSearch.mockReset();
    mockIndex.mockReset();
    mockDelete.mockReset();
  });

  afterEach(() => {
    // Reset the singleton so tests don't bleed into each other
    _resetClient();
  });

  // -------------------------------------------------------------------------
  // 1. ConnectionError → degraded result { hits: [], total: 0 }
  // -------------------------------------------------------------------------
  test('search() returns { hits: [], total: 0 } when ES throws ConnectionError', async () => {
    mockSearch.mockRejectedValueOnce(new ConnectionError('ECONNREFUSED'));

    const result = await search({ q: 'coffee' });

    expect(result.hits).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.facets).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 2. NoLivingConnectionsError → degraded result
  // -------------------------------------------------------------------------
  test('search() returns { hits: [], total: 0 } when ES throws NoLivingConnectionsError', async () => {
    mockSearch.mockRejectedValueOnce(new NoLivingConnectionsError('No living connections'));

    const result = await search({ q: 'rewards' });

    expect(result.hits).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  // -------------------------------------------------------------------------
  // 3. Connectivity errors do NOT throw — they return the degraded shape
  // -------------------------------------------------------------------------
  test('search() does not throw on ConnectionError (returns degraded result)', async () => {
    mockSearch.mockRejectedValueOnce(new ConnectionError('ECONNREFUSED'));

    await expect(search({ q: 'test' })).resolves.toMatchObject({ hits: [], total: 0 });
  });

  // -------------------------------------------------------------------------
  // 4. ResponseError (bad query) still propagates
  // -------------------------------------------------------------------------
  test('search() propagates ResponseError (bad query) without swallowing it', async () => {
    mockSearch.mockRejectedValueOnce(new ResponseError('index_not_found_exception'));

    await expect(search({ q: 'rewards' })).rejects.toThrow('index_not_found_exception');
  });

  // -------------------------------------------------------------------------
  // 5. suggest() returns [] when ES is unreachable
  // -------------------------------------------------------------------------
  test('suggest() returns [] when ES throws ConnectionError', async () => {
    mockSearch.mockRejectedValueOnce(new ConnectionError('ECONNREFUSED'));

    const result = await suggest({ prefix: 'cof' });

    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 6. Happy path — real data returned when ES is healthy
  // -------------------------------------------------------------------------
  test('search() returns hits when ES responds normally', async () => {
    const fakeHits = [{ id: 1, name: 'Coffee reward', is_active: true }];
    mockSearch.mockResolvedValueOnce(fakeSearchResponse(fakeHits, 1));

    const result = await search({ q: 'coffee' });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].name).toBe('Coffee reward');
    expect(result.total).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 7. indexReward() degrades gracefully — resolves without throwing
  // -------------------------------------------------------------------------
  test('indexReward() resolves without throwing when ES is unreachable', async () => {
    mockIndex.mockRejectedValueOnce(new ConnectionError('ECONNREFUSED'));

    await expect(
      indexReward({ id: 1, name: 'Test', description: '', cost: 10, stock: 5, is_active: true, created_at: new Date() })
    ).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 8. deleteDocument() degrades gracefully — resolves without throwing
  // -------------------------------------------------------------------------
  test('deleteDocument() resolves without throwing when ES is unreachable', async () => {
    mockDelete.mockRejectedValueOnce(new ConnectionError('ECONNREFUSED'));

    await expect(deleteDocument('rewards', 1)).resolves.toBeUndefined();
  });
});
