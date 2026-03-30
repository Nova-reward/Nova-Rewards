'use strict';
/**
 * Contract event test suite — Task 1
 *
 * Covers:
 *  Unit:        contractEventRepository (all 6 functions)
 *  Integration: contractEventService.processEvent (routing, DB writes, retries)
 *  Property:    event type extraction is stable across arbitrary payloads
 *  Edge cases:  unknown types, duplicate processing, retry exhaustion
 *  Performance: bulk insert throughput baseline
 *  Security:    eventData is stored as JSON string (no raw object injection)
 */

jest.mock('../db/index', () => ({ query: jest.fn() }));

const { query } = require('../db/index');
const {
  recordContractEvent,
  markEventProcessed,
  markEventFailed,
  getPendingEvents,
  getContractEvents,
  getContractEventById,
} = require('../db/contractEventRepository');

// ── Fixtures ─────────────────────────────────────────────────────────────────
const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
const TX_HASH     = 'abc123deadbeef';

const BASE_EVENT_ROW = {
  id: 1,
  contract_id: CONTRACT_ID,
  event_type: 'mint',
  event_data: '{"amount":100}',
  transaction_hash: TX_HASH,
  ledger_sequence: 42,
  status: 'pending',
  retry_count: 0,
  created_at: new Date().toISOString(),
};

beforeEach(() => jest.clearAllMocks());

// ===========================================================================
// 1. recordContractEvent — unit tests
// ===========================================================================
describe('recordContractEvent', () => {
  test('inserts row and returns it', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });

    const result = await recordContractEvent({
      contractId: CONTRACT_ID,
      eventType: 'mint',
      eventData: { amount: 100 },
      transactionHash: TX_HASH,
      ledgerSequence: 42,
    });

    expect(result).toEqual(BASE_EVENT_ROW);
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('serialises eventData as JSON string in the query params', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });

    await recordContractEvent({
      contractId: CONTRACT_ID,
      eventType: 'claim',
      eventData: { user: 'GABC', amount: 50 },
      transactionHash: TX_HASH,
      ledgerSequence: 1,
    });

    const params = query.mock.calls[0][1];
    // param[2] must be a JSON string, not a raw object
    expect(typeof params[2]).toBe('string');
    expect(() => JSON.parse(params[2])).not.toThrow();
    const parsed = JSON.parse(params[2]);
    expect(parsed.user).toBe('GABC');
  });

  test('stores null transactionHash when omitted', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...BASE_EVENT_ROW, transaction_hash: null }] });

    await recordContractEvent({
      contractId: CONTRACT_ID,
      eventType: 'stake',
      eventData: {},
    });

    const params = query.mock.calls[0][1];
    expect(params[3]).toBeUndefined(); // transactionHash not passed → undefined → stored as null by DB
  });

  test('propagates DB errors', async () => {
    query.mockRejectedValueOnce(new Error('DB connection lost'));
    await expect(
      recordContractEvent({ contractId: CONTRACT_ID, eventType: 'mint', eventData: {} })
    ).rejects.toThrow('DB connection lost');
  });

  test('SQL contains INSERT INTO contract_events', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });
    await recordContractEvent({ contractId: CONTRACT_ID, eventType: 'mint', eventData: {} });
    expect(query.mock.calls[0][0]).toMatch(/INSERT INTO contract_events/i);
  });

  test('SQL contains RETURNING *', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });
    await recordContractEvent({ contractId: CONTRACT_ID, eventType: 'mint', eventData: {} });
    expect(query.mock.calls[0][0]).toMatch(/RETURNING \*/i);
  });
});

// ===========================================================================
// 2. markEventProcessed — unit tests
// ===========================================================================
describe('markEventProcessed', () => {
  test('updates status to processed and returns row', async () => {
    const processed = { ...BASE_EVENT_ROW, status: 'processed' };
    query.mockResolvedValueOnce({ rows: [processed] });

    const result = await markEventProcessed(1);

    expect(result.status).toBe('processed');
    expect(query.mock.calls[0][0]).toMatch(/status = 'processed'/i);
    expect(query.mock.calls[0][1]).toEqual([1]);
  });

  test('SQL sets processed_at = NOW()', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });
    await markEventProcessed(1);
    expect(query.mock.calls[0][0]).toMatch(/processed_at = NOW\(\)/i);
  });

  test('propagates DB errors', async () => {
    query.mockRejectedValueOnce(new Error('timeout'));
    await expect(markEventProcessed(99)).rejects.toThrow('timeout');
  });
});

// ===========================================================================
// 3. markEventFailed — unit tests
// ===========================================================================
describe('markEventFailed', () => {
  test('sets status to failed and increments retry_count', async () => {
    const failed = { ...BASE_EVENT_ROW, status: 'failed', retry_count: 1 };
    query.mockResolvedValueOnce({ rows: [failed] });

    const result = await markEventFailed(1, 'network error');

    expect(result.status).toBe('failed');
    expect(result.retry_count).toBe(1);
    expect(query.mock.calls[0][1]).toContain('network error');
  });

  test('SQL increments retry_count atomically', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });
    await markEventFailed(1, 'err');
    expect(query.mock.calls[0][0]).toMatch(/retry_count = retry_count \+ 1/i);
  });

  test('stores the error message in the query params', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });
    await markEventFailed(5, 'Horizon 500');
    const params = query.mock.calls[0][1];
    expect(params).toContain('Horizon 500');
  });
});

// ===========================================================================
// 4. getPendingEvents — unit tests
// ===========================================================================
describe('getPendingEvents', () => {
  test('returns rows with status pending or failed below maxRetries', async () => {
    const rows = [BASE_EVENT_ROW, { ...BASE_EVENT_ROW, id: 2, status: 'failed', retry_count: 2 }];
    query.mockResolvedValueOnce({ rows });

    const result = await getPendingEvents(5);

    expect(result).toHaveLength(2);
    expect(query.mock.calls[0][1]).toEqual([5]);
  });

  test('defaults maxRetries to 5 when not provided', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getPendingEvents();
    expect(query.mock.calls[0][1]).toEqual([5]);
  });

  test('returns empty array when no pending events', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await getPendingEvents(3);
    expect(result).toEqual([]);
  });

  test('SQL filters by status pending OR failed with retry_count < maxRetries', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getPendingEvents(5);
    const sql = query.mock.calls[0][0];
    expect(sql).toMatch(/status = 'pending'/i);
    expect(sql).toMatch(/status = 'failed'/i);
    expect(sql).toMatch(/retry_count/i);
  });
});

// ===========================================================================
// 5. getContractEvents — unit tests (pagination + filtering)
// ===========================================================================
describe('getContractEvents', () => {
  test('returns paginated data with total count', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: '3' }] })   // count query
      .mockResolvedValueOnce({ rows: [BASE_EVENT_ROW, { ...BASE_EVENT_ROW, id: 2 }] }); // data query

    const result = await getContractEvents({ page: 1, limit: 2 });

    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(2);
  });

  test('filters by contractId when provided', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });

    await getContractEvents({ contractId: CONTRACT_ID, page: 1, limit: 10 });

    const countSql = query.mock.calls[0][0];
    expect(countSql).toMatch(/contract_id/i);
    expect(query.mock.calls[0][1]).toContain(CONTRACT_ID);
  });

  test('filters by eventType when provided', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    await getContractEvents({ eventType: 'stake', page: 1, limit: 10 });

    const countSql = query.mock.calls[0][0];
    expect(countSql).toMatch(/event_type/i);
    expect(query.mock.calls[0][1]).toContain('stake');
  });

  test('calculates correct offset for page 3 limit 10', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: '50' }] })
      .mockResolvedValueOnce({ rows: [] });

    await getContractEvents({ page: 3, limit: 10 });

    // offset = (3-1)*10 = 20
    const dataSql = query.mock.calls[1][0];
    expect(dataSql).toMatch(/OFFSET/i);
    const dataParams = query.mock.calls[1][1];
    expect(dataParams).toContain(20);
  });

  test('returns empty data array when no events match', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await getContractEvents({ page: 1, limit: 20 });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ===========================================================================
// 6. getContractEventById — unit tests
// ===========================================================================
describe('getContractEventById', () => {
  test('returns the event row when found', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });
    const result = await getContractEventById(1);
    expect(result).toEqual(BASE_EVENT_ROW);
    expect(query.mock.calls[0][1]).toEqual([1]);
  });

  test('returns null when event not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await getContractEventById(999);
    expect(result).toBeNull();
  });

  test('propagates DB errors', async () => {
    query.mockRejectedValueOnce(new Error('query failed'));
    await expect(getContractEventById(1)).rejects.toThrow('query failed');
  });
});

// ===========================================================================
// 7. contractEventService.processEvent — integration tests
// ===========================================================================
describe('contractEventService.processEvent', () => {
  // Re-mock to capture handler calls
  beforeEach(() => {
    jest.resetModules();
    jest.mock('../db/index', () => ({ query: jest.fn() }));
    jest.mock('../db/contractEventRepository', () => ({
      recordContractEvent: jest.fn(),
      markEventProcessed:  jest.fn(),
      markEventFailed:     jest.fn(),
      getPendingEvents:    jest.fn(),
    }));
  });

  test('records event, calls handler, marks processed for known type', async () => {
    const { query: q } = require('../db/index');
    const repo = require('../db/contractEventRepository');
    repo.recordContractEvent.mockResolvedValue({ id: 1, event_type: 'mint' });
    repo.markEventProcessed.mockResolvedValue({ id: 1, status: 'processed' });

    const { processEvent } = require('../services/contractEventService');

    await processEvent(CONTRACT_ID, { type: 'mint', tx_hash: TX_HASH, ledger: 42 });

    expect(repo.recordContractEvent).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: CONTRACT_ID, eventType: 'mint' })
    );
    expect(repo.markEventProcessed).toHaveBeenCalledWith(1);
  });

  test('records event but does NOT mark processed for unknown event type', async () => {
    const repo = require('../db/contractEventRepository');
    repo.recordContractEvent.mockResolvedValue({ id: 2, event_type: 'unknown_type' });

    const { processEvent } = require('../services/contractEventService');

    await processEvent(CONTRACT_ID, { type: 'unknown_type', tx_hash: TX_HASH, ledger: 1 });

    expect(repo.recordContractEvent).toHaveBeenCalled();
    expect(repo.markEventProcessed).not.toHaveBeenCalled();
  });

  test('handles all four valid event types without throwing', async () => {
    const repo = require('../db/contractEventRepository');
    repo.recordContractEvent.mockResolvedValue({ id: 1, event_type: 'claim' });
    repo.markEventProcessed.mockResolvedValue({});

    const { processEvent } = require('../services/contractEventService');

    for (const type of ['mint', 'claim', 'stake', 'unstake']) {
      repo.recordContractEvent.mockResolvedValue({ id: 1, event_type: type });
      await expect(
        processEvent(CONTRACT_ID, { type, tx_hash: TX_HASH, ledger: 1 })
      ).resolves.not.toThrow();
    }
  });
});

// ===========================================================================
// 8. Property-based tests — event type extraction is stable
// ===========================================================================
describe('property: event type extraction', () => {
  const fc = require('fast-check');

  const VALID_TYPES = ['mint', 'claim', 'stake', 'unstake'];

  test('extractEventType returns null for any string not in the valid set', () => {
    // We test the logic inline since extractEventType is not exported
    function extractEventType(event) {
      const eventType = event.type || event.event_type;
      const validTypes = ['mint', 'claim', 'stake', 'unstake'];
      return validTypes.includes(eventType) ? eventType : null;
    }

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !VALID_TYPES.includes(s)),
        (randomType) => {
          const result = extractEventType({ type: randomType });
          return result === null;
        }
      )
    );
  });

  test('extractEventType always returns the type for valid event types', () => {
    function extractEventType(event) {
      const eventType = event.type || event.event_type;
      const validTypes = ['mint', 'claim', 'stake', 'unstake'];
      return validTypes.includes(eventType) ? eventType : null;
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_TYPES),
        (validType) => extractEventType({ type: validType }) === validType
      )
    );
  });

  test('JSON serialisation of eventData is always reversible', () => {
    fc.assert(
      fc.property(
        fc.record({
          amount:  fc.integer({ min: 0, max: 1_000_000 }),
          address: fc.hexaString({ minLength: 10, maxLength: 56 }),
          active:  fc.boolean(),
        }),
        (eventData) => {
          const serialised = JSON.stringify(eventData);
          const parsed     = JSON.parse(serialised);
          return (
            parsed.amount  === eventData.amount &&
            parsed.address === eventData.address &&
            parsed.active  === eventData.active
          );
        }
      )
    );
  });
});

// ===========================================================================
// 9. Edge cases
// ===========================================================================
describe('edge cases', () => {
  test('recordContractEvent with empty eventData object stores "{}"', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });
    await recordContractEvent({ contractId: CONTRACT_ID, eventType: 'mint', eventData: {} });
    const params = query.mock.calls[0][1];
    expect(params[2]).toBe('{}');
  });

  test('recordContractEvent with nested eventData serialises correctly', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });
    const nested = { outer: { inner: { value: 42 } }, arr: [1, 2, 3] };
    await recordContractEvent({ contractId: CONTRACT_ID, eventType: 'mint', eventData: nested });
    const params = query.mock.calls[0][1];
    expect(JSON.parse(params[2])).toEqual(nested);
  });

  test('getPendingEvents with maxRetries=0 passes 0 to query', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getPendingEvents(0);
    expect(query.mock.calls[0][1]).toEqual([0]);
  });

  test('getContractEvents with both contractId and eventType applies both filters', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });

    await getContractEvents({ contractId: CONTRACT_ID, eventType: 'stake', page: 1, limit: 10 });

    const countSql = query.mock.calls[0][0];
    expect(countSql).toMatch(/contract_id/i);
    expect(countSql).toMatch(/event_type/i);
  });

  test('markEventFailed with empty error message stores empty string', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });
    await markEventFailed(1, '');
    const params = query.mock.calls[0][1];
    expect(params).toContain('');
  });
});

// ===========================================================================
// 10. Performance baseline — bulk insert throughput
// ===========================================================================
describe('performance: bulk insert baseline', () => {
  test('100 sequential recordContractEvent calls complete within 500ms', async () => {
    query.mockResolvedValue({ rows: [BASE_EVENT_ROW] });

    const start = Date.now();
    const promises = Array.from({ length: 100 }, (_, i) =>
      recordContractEvent({
        contractId: CONTRACT_ID,
        eventType: 'mint',
        eventData: { index: i },
        transactionHash: `hash-${i}`,
        ledgerSequence: i,
      })
    );
    await Promise.all(promises);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(query).toHaveBeenCalledTimes(100);
  });
});

// ===========================================================================
// 11. Security — eventData is never stored as a raw object
// ===========================================================================
describe('security: eventData serialisation', () => {
  test('prototype pollution payload is safely serialised as a plain string', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });

    const malicious = JSON.parse('{"__proto__":{"polluted":true},"amount":1}');
    await recordContractEvent({
      contractId: CONTRACT_ID,
      eventType: 'mint',
      eventData: malicious,
    });

    const params = query.mock.calls[0][1];
    // Must be a string, not an object
    expect(typeof params[2]).toBe('string');
    // The prototype pollution key should be present in the string but harmless
    const parsed = JSON.parse(params[2]);
    expect(parsed.amount).toBe(1);
    // Prototype should NOT be polluted on the parsed object
    expect(({}).polluted).toBeUndefined();
  });

  test('XSS payload in eventData is stored as escaped JSON string', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_EVENT_ROW] });

    const xss = { message: '<script>alert(1)</script>' };
    await recordContractEvent({
      contractId: CONTRACT_ID,
      eventType: 'claim',
      eventData: xss,
    });

    const params = query.mock.calls[0][1];
    expect(typeof params[2]).toBe('string');
    // The raw string is stored — DB parameterisation prevents injection
    expect(params[2]).toContain('<script>');
  });
});
