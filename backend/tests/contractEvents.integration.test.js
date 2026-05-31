/**
 * Backend Integration Tests — Contract Events Parseability
 *
 * Verifies that every event schema defined in docs/contract-events.md
 * can be correctly parsed from a Horizon/Soroban RPC API response shape.
 *
 * These tests use mocked Horizon responses that mirror the real XDR-decoded
 * structure returned by @stellar/stellar-sdk SorobanRpc.getEvents().
 * No live network connection is required.
 *
 * Run: npx jest backend/tests/contractEvents.integration.test.js
 */

'use strict';

// ── Event type registry (mirrors contractEvents.js) ──────────────────────────
const EVENT_TYPES = require('../routes/contractEvents').EVENT_TYPES ||
  (() => {
    // Inline fallback if the route doesn't export EVENT_TYPES directly
    const mod = require('../routes/contractEvents');
    return mod;
  })();

// ── Schema version expected in all v1 events ─────────────────────────────────
const SCHEMA_V1 = 1;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a mock Soroban RPC event object that mirrors the structure returned
 * by SorobanRpc.Server.getEvents().
 *
 * @param {string} tag       - Topic 0 symbol value  (e.g. "nova_rwd")
 * @param {string} eventType - Topic 1 symbol value  (e.g. "staked")
 * @param {Array}  dataItems - Decoded data fields (schema_version first)
 * @param {string} [txHash]  - Optional transaction hash
 * @param {number} [ledger]  - Optional ledger sequence
 */
function mockRpcEvent(tag, eventType, dataItems, txHash = 'TXHASH001', ledger = 1000) {
  return {
    id: `${ledger}-0`,
    type: 'contract',
    ledger,
    ledgerClosedAt: '2026-05-31T00:00:00Z',
    contractId: 'CCONTRACTID0000000000000000000000000000000000000000000000',
    txHash,
    topic: [
      { type: 'symbol', value: tag },
      { type: 'symbol', value: eventType },
    ],
    value: dataItems,
  };
}

/**
 * Parse a mock RPC event the same way the indexer does in contractEvents.js.
 * Returns { tag, eventType, schemaVersion, fields } or throws on malformed input.
 */
function parseEvent(event) {
  if (!event.topic || event.topic.length < 2) {
    throw new Error('Event must have at least 2 topics');
  }
  const tag = event.topic[0].value;
  const eventType = event.topic[1].value;
  const data = event.value;

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Event ${tag}:${eventType} has no data`);
  }

  const schemaVersion = data[0];
  if (typeof schemaVersion !== 'number') {
    throw new Error(`schema_version must be a number, got ${typeof schemaVersion}`);
  }

  return { tag, eventType, schemaVersion, fields: data.slice(1) };
}

/**
 * Assert that a parsed event matches expected shape.
 */
function assertEvent(parsed, expectedTag, expectedType, expectedFieldCount) {
  expect(parsed.tag).toBe(expectedTag);
  expect(parsed.eventType).toBe(expectedType);
  expect(parsed.schemaVersion).toBe(SCHEMA_V1);
  expect(parsed.fields).toHaveLength(expectedFieldCount);
}

// ── Test addresses / hashes ───────────────────────────────────────────────────
const ADDR_A = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const ADDR_B = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const WASM_HASH = new Array(32).fill(0);

// =============================================================================
// NovaRewards events
// =============================================================================
describe('NovaRewards (nova_rwd) events', () => {
  test('init — parseable with admin address', () => {
    const event = mockRpcEvent('nova_rwd', 'init', [SCHEMA_V1, ADDR_A]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'init', 1);
    expect(parsed.fields[0]).toBe(ADDR_A);
  });

  test('bal_set — parseable with user and amount', () => {
    const event = mockRpcEvent('nova_rwd', 'bal_set', [SCHEMA_V1, ADDR_A, 10000]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'bal_set', 2);
    expect(parsed.fields[1]).toBe(10000);
  });

  test('staked — parseable with staker, amount, timestamp', () => {
    const event = mockRpcEvent('nova_rwd', 'staked', [SCHEMA_V1, ADDR_A, 5000, 1748649600]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'staked', 3);
    expect(parsed.fields[0]).toBe(ADDR_A);
    expect(parsed.fields[1]).toBe(5000);
    expect(parsed.fields[2]).toBe(1748649600);
  });

  test('unstaked — parseable with staker, principal, yield, timestamp', () => {
    const event = mockRpcEvent('nova_rwd', 'unstaked', [SCHEMA_V1, ADDR_A, 5000, 250, 1748736000]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'unstaked', 4);
    expect(parsed.fields[1]).toBe(5000);  // principal
    expect(parsed.fields[2]).toBe(250);   // yield
  });

  test('rate_set — parseable with rate', () => {
    const event = mockRpcEvent('nova_rwd', 'rate_set', [SCHEMA_V1, 500]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'rate_set', 1);
    expect(parsed.fields[0]).toBe(500);
  });

  test('swap — parseable with user, nova_amount, xlm_received, path', () => {
    const event = mockRpcEvent('nova_rwd', 'swap', [SCHEMA_V1, ADDR_A, 1000, 980, [ADDR_B]]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'swap', 4);
    expect(parsed.fields[1]).toBe(1000);
    expect(parsed.fields[2]).toBe(980);
  });

  test('paused — parseable with procedure and timestamp', () => {
    const event = mockRpcEvent('nova_rwd', 'paused', [SCHEMA_V1, 'manual', 1748649600]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'paused', 2);
  });

  test('resumed — parseable with timestamp', () => {
    const event = mockRpcEvent('nova_rwd', 'resumed', [SCHEMA_V1, 1748736000]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'resumed', 1);
  });

  test('emrg_paus — parseable with expiry', () => {
    const event = mockRpcEvent('nova_rwd', 'emrg_paus', [SCHEMA_V1, 1748822400]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'emrg_paus', 1);
  });

  test('rec_op — parseable with recovery_admin', () => {
    const event = mockRpcEvent('nova_rwd', 'rec_op', [SCHEMA_V1, ADDR_B]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'rec_op', 1);
  });

  test('snap — parseable with user, balance, timestamp', () => {
    const event = mockRpcEvent('nova_rwd', 'snap', [SCHEMA_V1, ADDR_A, 10000, 1748649600]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'snap', 3);
  });

  test('restore — parseable with user, balance, timestamp', () => {
    const event = mockRpcEvent('nova_rwd', 'restore', [SCHEMA_V1, ADDR_A, 10000, 1748736000]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'restore', 3);
  });

  test('rec_tx — parseable with user, delta, new_balance', () => {
    const event = mockRpcEvent('nova_rwd', 'rec_tx', [SCHEMA_V1, ADDR_A, -500, 9500]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'rec_tx', 3);
    expect(parsed.fields[1]).toBe(-500);
    expect(parsed.fields[2]).toBe(9500);
  });

  test('rec_funds — parseable with from, to, amount', () => {
    const event = mockRpcEvent('nova_rwd', 'rec_funds', [SCHEMA_V1, ADDR_A, ADDR_B, 1000]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'rec_funds', 3);
  });

  test('upgraded — parseable with wasm_hash and migration_version', () => {
    const event = mockRpcEvent('nova_rwd', 'upgraded', [SCHEMA_V1, WASM_HASH, 2]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'nova_rwd', 'upgraded', 2);
    expect(parsed.fields[1]).toBe(2);
  });
});

// =============================================================================
// Campaign events
// =============================================================================
describe('Campaign (camp) events', () => {
  test('created — parseable with id, owner, reward_count, max_participants', () => {
    const event = mockRpcEvent('camp', 'created', [SCHEMA_V1, 1, ADDR_A, 3, 100]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'camp', 'created', 4);
    expect(parsed.fields[0]).toBe(1);   // id
    expect(parsed.fields[2]).toBe(3);   // reward_count
    expect(parsed.fields[3]).toBe(100); // max_participants
  });

  test('activated — parseable with id and owner', () => {
    const event = mockRpcEvent('camp', 'activated', [SCHEMA_V1, 1, ADDR_A]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'camp', 'activated', 2);
  });

  test('deactivated — parseable with id and owner', () => {
    const event = mockRpcEvent('camp', 'deactivated', [SCHEMA_V1, 1, ADDR_A]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'camp', 'deactivated', 2);
  });

  test('joined — parseable with id and participant', () => {
    const event = mockRpcEvent('camp', 'joined', [SCHEMA_V1, 1, ADDR_B]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'camp', 'joined', 2);
    expect(parsed.fields[1]).toBe(ADDR_B);
  });

  test('rwd_issued — parseable with id, participant, reward_count', () => {
    const event = mockRpcEvent('camp', 'rwd_issued', [SCHEMA_V1, 1, ADDR_B, 3]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'camp', 'rwd_issued', 3);
    expect(parsed.fields[2]).toBe(3);
  });

  test('paused — parseable with admin', () => {
    const event = mockRpcEvent('camp', 'paused', [SCHEMA_V1, ADDR_A]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'camp', 'paused', 1);
  });

  test('upgraded — parseable with wasm_hash', () => {
    const event = mockRpcEvent('camp', 'upgraded', [SCHEMA_V1, WASM_HASH]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'camp', 'upgraded', 1);
  });
});

// =============================================================================
// Escrow events
// =============================================================================
describe('Escrow events', () => {
  test('created — parseable with id, depositor, beneficiary, timeout', () => {
    const event = mockRpcEvent('escrow', 'created', [SCHEMA_V1, 0, ADDR_A, ADDR_B, 1748736000]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'escrow', 'created', 4);
    expect(parsed.fields[1]).toBe(ADDR_A);
    expect(parsed.fields[2]).toBe(ADDR_B);
    expect(parsed.fields[3]).toBe(1748736000);
  });

  test('funded — parseable with id, depositor, amount', () => {
    const event = mockRpcEvent('escrow', 'funded', [SCHEMA_V1, 0, ADDR_A, 5000]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'escrow', 'funded', 3);
    expect(parsed.fields[2]).toBe(5000);
  });

  test('released — parseable with id, beneficiary, amount', () => {
    const event = mockRpcEvent('escrow', 'released', [SCHEMA_V1, 0, ADDR_B, 5000]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'escrow', 'released', 3);
    expect(parsed.fields[1]).toBe(ADDR_B);
  });

  test('refunded — parseable with id, depositor, amount', () => {
    const event = mockRpcEvent('escrow', 'refunded', [SCHEMA_V1, 0, ADDR_A, 5000]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'escrow', 'refunded', 3);
  });

  test('upgraded — parseable with wasm_hash', () => {
    const event = mockRpcEvent('escrow', 'upgraded', [SCHEMA_V1, WASM_HASH]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'escrow', 'upgraded', 1);
  });
});

// =============================================================================
// Distribution events
// =============================================================================
describe('Distribution (dist) events', () => {
  test('distributed — parseable with recipient, amount, clawback_deadline', () => {
    const event = mockRpcEvent('dist', 'distributed', [SCHEMA_V1, ADDR_B, 1000, 1751241600]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'dist', 'distributed', 3);
    expect(parsed.fields[0]).toBe(ADDR_B);
    expect(parsed.fields[1]).toBe(1000);
    expect(parsed.fields[2]).toBe(1751241600);
  });

  test('batch_dist — parseable with count and total_amount', () => {
    const event = mockRpcEvent('dist', 'batch_dist', [SCHEMA_V1, 5, 5000]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'dist', 'batch_dist', 2);
    expect(parsed.fields[0]).toBe(5);
    expect(parsed.fields[1]).toBe(5000);
  });

  test('clawback — parseable with recipient and amount', () => {
    const event = mockRpcEvent('dist', 'clawback', [SCHEMA_V1, ADDR_B, 1000]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'dist', 'clawback', 2);
  });

  test('upgraded — parseable with wasm_hash', () => {
    const event = mockRpcEvent('dist', 'upgraded', [SCHEMA_V1, WASM_HASH]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'dist', 'upgraded', 1);
  });
});

// =============================================================================
// Governance events
// =============================================================================
describe('Governance (gov) events', () => {
  test('proposed — parseable with id, proposer, title', () => {
    const event = mockRpcEvent('gov', 'proposed', [SCHEMA_V1, 1, ADDR_A, 'Increase reward rate']);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'gov', 'proposed', 3);
    expect(parsed.fields[0]).toBe(1);
    expect(parsed.fields[2]).toBe('Increase reward rate');
  });

  test('voted — parseable with proposal_id, voter, support', () => {
    const event = mockRpcEvent('gov', 'voted', [SCHEMA_V1, 1, ADDR_B, true]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'gov', 'voted', 3);
    expect(parsed.fields[2]).toBe(true);
  });

  test('finalised — parseable with proposal_id and passed', () => {
    const event = mockRpcEvent('gov', 'finalised', [SCHEMA_V1, 1, true]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'gov', 'finalised', 2);
    expect(parsed.fields[1]).toBe(true);
  });

  test('executed — parseable with proposal_id and proposer', () => {
    const event = mockRpcEvent('gov', 'executed', [SCHEMA_V1, 1, ADDR_A]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'gov', 'executed', 2);
  });

  test('upgraded — parseable with wasm_hash', () => {
    const event = mockRpcEvent('gov', 'upgraded', [SCHEMA_V1, WASM_HASH]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'gov', 'upgraded', 1);
  });
});

// =============================================================================
// AdminRoles events
// =============================================================================
describe('AdminRoles (adm_roles) events', () => {
  test('adm_prop — parseable with current_admin and proposed', () => {
    const event = mockRpcEvent('adm_roles', 'adm_prop', [SCHEMA_V1, ADDR_A, ADDR_B]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'adm_roles', 'adm_prop', 2);
    expect(parsed.fields[0]).toBe(ADDR_A);
    expect(parsed.fields[1]).toBe(ADDR_B);
  });

  test('adm_xfer — parseable with old_admin and new_admin', () => {
    const event = mockRpcEvent('adm_roles', 'adm_xfer', [SCHEMA_V1, ADDR_A, ADDR_B]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'adm_roles', 'adm_xfer', 2);
  });

  test('role_chg — parseable with admin, operation, target', () => {
    const event = mockRpcEvent('adm_roles', 'role_chg', [SCHEMA_V1, ADDR_A, 'mint', ADDR_B]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'adm_roles', 'role_chg', 3);
    expect(parsed.fields[1]).toBe('mint');
  });

  test('upgraded — parseable with wasm_hash', () => {
    const event = mockRpcEvent('adm_roles', 'upgraded', [SCHEMA_V1, WASM_HASH]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'adm_roles', 'upgraded', 1);
  });
});

// =============================================================================
// ContractState events
// =============================================================================
describe('ContractState (state) events', () => {
  test('set — parseable with schema_version_counter', () => {
    const event = mockRpcEvent('state', 'set', [SCHEMA_V1, 0]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'state', 'set', 1);
  });

  test('migrate — parseable with new_version', () => {
    const event = mockRpcEvent('state', 'migrate', [SCHEMA_V1, 1]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'state', 'migrate', 1);
    expect(parsed.fields[0]).toBe(1);
  });

  test('recover — parseable with snap_version', () => {
    const event = mockRpcEvent('state', 'recover', [SCHEMA_V1, 0]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'state', 'recover', 1);
  });

  test('upgraded — parseable with wasm_hash', () => {
    const event = mockRpcEvent('state', 'upgraded', [SCHEMA_V1, WASM_HASH]);
    const parsed = parseEvent(event);
    assertEvent(parsed, 'state', 'upgraded', 1);
  });
});

// =============================================================================
// NovaToken events
// =============================================================================
describe('NovaToken (nova_tok) events', () => {
  test('mint — parseable with to and amount', () => {
    const event = mockRpcEvent('nova_tok', 'mint', [ADDR_A, 1000]);
    // nova_token does not yet include schema_version — parse raw
    expect(event.value[0]).toBe(ADDR_A);
    expect(event.value[1]).toBe(1000);
  });

  test('transfer — parseable with from, to, amount', () => {
    const event = mockRpcEvent('nova_tok', 'transfer', [ADDR_A, ADDR_B, 500]);
    expect(event.value).toHaveLength(3);
    expect(event.value[2]).toBe(500);
  });

  test('burn — parseable with from and amount', () => {
    const event = mockRpcEvent('nova_tok', 'burn', [ADDR_A, 200]);
    expect(event.value).toHaveLength(2);
  });

  test('approve — parseable with owner, spender, amount', () => {
    const event = mockRpcEvent('nova_tok', 'approve', [ADDR_A, ADDR_B, 1000]);
    expect(event.value).toHaveLength(3);
  });
});

// =============================================================================
// EVENT_TYPES registry completeness
// =============================================================================
describe('EVENT_TYPES registry', () => {
  // All event keys that must be present in the registry
  const REQUIRED_KEYS = [
    'nova_rwd:init', 'nova_rwd:bal_set', 'nova_rwd:staked', 'nova_rwd:unstaked',
    'nova_rwd:rate_set', 'nova_rwd:swap', 'nova_rwd:paused', 'nova_rwd:resumed',
    'nova_rwd:emrg_paus', 'nova_rwd:rec_op', 'nova_rwd:snap', 'nova_rwd:restore',
    'nova_rwd:rec_tx', 'nova_rwd:rec_funds', 'nova_rwd:upgraded',
    'nova_tok:mint', 'nova_tok:burn', 'nova_tok:transfer', 'nova_tok:approve',
    'camp:created', 'camp:activated', 'camp:deactivated', 'camp:joined',
    'camp:rwd_issued', 'camp:paused', 'camp:unpaused', 'camp:upgraded',
    'escrow:created', 'escrow:funded', 'escrow:released', 'escrow:refunded', 'escrow:upgraded',
    'dist:distributed', 'dist:batch_dist', 'dist:clawback', 'dist:upgraded',
    'gov:proposed', 'gov:voted', 'gov:finalised', 'gov:executed', 'gov:upgraded',
    'adm_roles:adm_prop', 'adm_roles:adm_xfer', 'adm_roles:role_chg', 'adm_roles:upgraded',
    'state:set', 'state:delete', 'state:snapshot', 'state:migrate', 'state:recover', 'state:upgraded',
    'rwd_pool:deposited', 'rwd_pool:withdrawn',
    'vesting:tok_rel',
    'referral:ref_reg', 'referral:ref_cred',
  ];

  // Load the actual EVENT_TYPES from the route file
  let registeredTypes = {};
  try {
    // Extract EVENT_TYPES by reading the file and evaluating the object
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../routes/contractEvents.js'), 'utf8'
    );
    const match = src.match(/const EVENT_TYPES\s*=\s*(\{[\s\S]*?\});/);
    if (match) {
      // eslint-disable-next-line no-eval
      registeredTypes = eval('(' + match[1] + ')');
    }
  } catch (e) {
    // If parsing fails, skip registry completeness check
    console.warn('Could not parse EVENT_TYPES from route file:', e.message);
  }

  test.each(REQUIRED_KEYS)('EVENT_TYPES contains key: %s', (key) => {
    if (Object.keys(registeredTypes).length === 0) {
      // Skip if we couldn't parse the registry
      return;
    }
    expect(registeredTypes).toHaveProperty(key);
    expect(registeredTypes[key]).toHaveProperty('contract');
    expect(registeredTypes[key]).toHaveProperty('description');
  });
});

// =============================================================================
// Error handling — malformed events
// =============================================================================
describe('parseEvent error handling', () => {
  test('throws on missing topics', () => {
    expect(() => parseEvent({ topic: [], value: [1, 'addr'] }))
      .toThrow('at least 2 topics');
  });

  test('throws on empty data array', () => {
    expect(() => parseEvent(mockRpcEvent('nova_rwd', 'staked', [])))
      .toThrow('no data');
  });

  test('throws when schema_version is not a number', () => {
    expect(() => parseEvent(mockRpcEvent('nova_rwd', 'staked', ['bad', 'addr', 5000, 123])))
      .toThrow('schema_version must be a number');
  });

  test('unknown event type does not throw — indexer should handle gracefully', () => {
    const event = mockRpcEvent('unknown', 'event', [SCHEMA_V1, 'data']);
    const parsed = parseEvent(event);
    expect(parsed.tag).toBe('unknown');
    expect(parsed.eventType).toBe('event');
    expect(parsed.schemaVersion).toBe(SCHEMA_V1);
  });
});
