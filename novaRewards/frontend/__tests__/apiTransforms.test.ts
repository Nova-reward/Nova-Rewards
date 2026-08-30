/**
 * Tests — API Transforms (apiTransforms.ts)
 *
 * Covers:
 *  - toCamelCase / toSnakeCase
 *  - camelizeKeys (deep recursion, arrays, primitives, dates)
 *  - snakerizeKeys (deep recursion)
 *  - unwrapEnvelope (standard envelope, legacy flat responses)
 *  - unwrapPaginated (various envelope shapes)
 *  - transformRequest (skips FormData/Blob, snakifies objects)
 *  - transformResponse (parses JSON, camelizes)
 */

import {
  toCamelCase,
  toSnakeCase,
  camelizeKeys,
  snakerizeKeys,
  unwrapEnvelope,
  unwrapPaginated,
  transformRequest,
  transformResponse,
} from '../lib/apiTransforms';

// ---------------------------------------------------------------------------
// toCamelCase
// ---------------------------------------------------------------------------

describe('toCamelCase', () => {
  it('converts simple snake_case', () => {
    expect(toCamelCase('first_name')).toBe('firstName');
  });

  it('converts multi-word snake_case', () => {
    expect(toCamelCase('on_chain_status')).toBe('onChainStatus');
  });

  it('leaves camelCase unchanged', () => {
    expect(toCamelCase('alreadyCamel')).toBe('alreadyCamel');
  });

  it('handles leading/trailing underscores gracefully', () => {
    // _private → the leading underscore matches /_([a-z])/ so 'p' is uppercased
    // This is expected behavior; callers should not pass private-style keys
    expect(toCamelCase('_private')).toBe('Private');
  });

  it('handles all-lowercase single word', () => {
    expect(toCamelCase('name')).toBe('name');
  });
});

// ---------------------------------------------------------------------------
// toSnakeCase
// ---------------------------------------------------------------------------

describe('toSnakeCase', () => {
  it('converts simple camelCase', () => {
    expect(toSnakeCase('firstName')).toBe('first_name');
  });

  it('converts multi-word camelCase', () => {
    expect(toSnakeCase('onChainStatus')).toBe('on_chain_status');
  });

  it('leaves snake_case unchanged', () => {
    expect(toSnakeCase('already_snake')).toBe('already_snake');
  });

  it('handles single lowercase word', () => {
    expect(toSnakeCase('name')).toBe('name');
  });
});

// ---------------------------------------------------------------------------
// camelizeKeys
// ---------------------------------------------------------------------------

describe('camelizeKeys', () => {
  it('converts flat object keys', () => {
    const result = camelizeKeys({ first_name: 'Alice', last_name: 'Nova' });
    expect(result).toEqual({ firstName: 'Alice', lastName: 'Nova' });
  });

  it('recursively converts nested objects', () => {
    const result = camelizeKeys({
      user_info: { wallet_address: 'G123', on_chain_status: 'confirmed' },
    });
    expect(result).toEqual({
      userInfo: { walletAddress: 'G123', onChainStatus: 'confirmed' },
    });
  });

  it('handles arrays of objects', () => {
    const result = camelizeKeys([
      { reward_rate: 1.5, merchant_id: 2 },
      { reward_rate: 2.5, merchant_id: 3 },
    ]);
    expect(result).toEqual([
      { rewardRate: 1.5, merchantId: 2 },
      { rewardRate: 2.5, merchantId: 3 },
    ]);
  });

  it('handles arrays nested inside objects', () => {
    const result = camelizeKeys({ reward_list: [{ item_id: 1 }, { item_id: 2 }] });
    expect(result).toEqual({ rewardList: [{ itemId: 1 }, { itemId: 2 }] });
  });

  it('returns primitives unchanged', () => {
    expect(camelizeKeys('a string')).toBe('a string');
    expect(camelizeKeys(42)).toBe(42);
    expect(camelizeKeys(true)).toBe(true);
    expect(camelizeKeys(null)).toBeNull();
  });

  it('leaves Date objects unchanged', () => {
    const d = new Date('2026-01-01');
    const result = camelizeKeys({ created_at: d });
    // The key is camelized but the value is the same Date reference
    expect((result as Record<string, unknown>).createdAt).toBe(d);
  });
});

// ---------------------------------------------------------------------------
// snakerizeKeys
// ---------------------------------------------------------------------------

describe('snakerizeKeys', () => {
  it('converts flat camelCase keys to snake_case', () => {
    const result = snakerizeKeys({ firstName: 'Alice', rewardRate: 1.5 });
    expect(result).toEqual({ first_name: 'Alice', reward_rate: 1.5 });
  });

  it('recursively converts nested objects', () => {
    const result = snakerizeKeys({
      campaignData: { merchantId: 5, onChainStatus: 'pending' },
    });
    expect(result).toEqual({
      campaign_data: { merchant_id: 5, on_chain_status: 'pending' },
    });
  });

  it('handles arrays', () => {
    const result = snakerizeKeys([{ rewardId: 1 }, { rewardId: 2 }]);
    expect(result).toEqual([{ reward_id: 1 }, { reward_id: 2 }]);
  });

  it('handles primitives', () => {
    expect(snakerizeKeys(null)).toBeNull();
    expect(snakerizeKeys(99)).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// unwrapEnvelope
// ---------------------------------------------------------------------------

describe('unwrapEnvelope', () => {
  it('unwraps a standard { success, data } envelope and camelizes', () => {
    const raw = { success: true, data: { user_id: 1, first_name: 'Alice' } };
    const result = unwrapEnvelope<{ userId: number; firstName: string }>(raw);
    expect(result).toEqual({ userId: 1, firstName: 'Alice' });
  });

  it('handles nested data in the envelope', () => {
    const raw = {
      success: true,
      data: { campaign: { reward_rate: 2.0, on_chain_status: 'confirmed' } },
    };
    const result = unwrapEnvelope<{ campaign: { rewardRate: number; onChainStatus: string } }>(raw);
    expect(result.campaign.rewardRate).toBe(2.0);
    expect(result.campaign.onChainStatus).toBe('confirmed');
  });

  it('returns camelized raw value for legacy flat responses', () => {
    const raw = { user_id: 5, first_name: 'Bob' };
    const result = unwrapEnvelope<{ userId: number; firstName: string }>(raw);
    expect(result).toEqual({ userId: 5, firstName: 'Bob' });
  });

  it('returns camelized array for array responses', () => {
    const raw = [{ item_id: 1 }, { item_id: 2 }];
    const result = unwrapEnvelope<Array<{ itemId: number }>>(raw);
    expect(result).toEqual([{ itemId: 1 }, { itemId: 2 }]);
  });

  it('handles null data inside envelope', () => {
    const raw = { success: true, data: null };
    const result = unwrapEnvelope(raw);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// unwrapPaginated
// ---------------------------------------------------------------------------

describe('unwrapPaginated', () => {
  it('unwraps a standard paginated envelope', () => {
    const raw = {
      success: true,
      data: [{ reward_id: 1 }, { reward_id: 2 }],
      total: 50,
      page: 2,
      limit: 10,
      hasMore: true,
    };
    const result = unwrapPaginated<{ rewardId: number }>(raw);
    expect(result.items).toEqual([{ rewardId: 1 }, { rewardId: 2 }]);
    expect(result.total).toBe(50);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.hasMore).toBe(true);
  });

  it('normalises has_more snake_case variant', () => {
    const raw = {
      success: true,
      data: [{ id: 1 }],
      total: 1,
      has_more: false,
    };
    const result = unwrapPaginated(raw);
    expect(result.hasMore).toBe(false);
  });

  it('handles plain array (no envelope)', () => {
    const raw = [{ tx_hash: 'abc' }, { tx_hash: 'def' }];
    const result = unwrapPaginated<{ txHash: string }>(raw);
    expect(result.items).toEqual([{ txHash: 'abc' }, { txHash: 'def' }]);
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it('handles rewards key in response', () => {
    const raw = {
      success: true,
      rewards: [{ reward_id: 10 }],
      total: 1,
    };
    const result = unwrapPaginated<{ rewardId: number }>(raw as never);
    expect(result.items).toEqual([{ rewardId: 10 }]);
  });

  it('includes nextCursor when present', () => {
    const raw = {
      success: true,
      data: [{ id: 1 }],
      total: 100,
      hasMore: true,
      nextCursor: 'cursor-xyz',
    };
    const result = unwrapPaginated(raw);
    expect(result.nextCursor).toBe('cursor-xyz');
  });

  it('normalises next_cursor snake_case variant', () => {
    const raw = {
      success: true,
      data: [],
      total: 0,
      next_cursor: 'cursor-abc',
    };
    const result = unwrapPaginated(raw);
    expect(result.nextCursor).toBe('cursor-abc');
  });

  it('returns empty items for empty envelope', () => {
    const raw = { success: true, data: [] };
    const result = unwrapPaginated(raw);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// transformRequest
// ---------------------------------------------------------------------------

describe('transformRequest', () => {
  it('serialises a camelCase object to snake_case JSON', () => {
    const result = transformRequest({ firstName: 'Alice', rewardRate: 2.0 });
    expect(result).toBe(JSON.stringify({ first_name: 'Alice', reward_rate: 2.0 }));
  });

  it('passes through FormData unchanged', () => {
    const fd = new FormData();
    expect(transformRequest(fd)).toBe(fd);
  });

  it('passes through Blob unchanged', () => {
    const blob = new Blob(['data']);
    expect(transformRequest(blob)).toBe(blob);
  });

  it('passes through string unchanged', () => {
    expect(transformRequest('raw string')).toBe('raw string');
  });

  it('passes through null unchanged', () => {
    expect(transformRequest(null)).toBeNull();
  });

  it('passes through undefined unchanged', () => {
    expect(transformRequest(undefined)).toBeUndefined();
  });

  it('serialises nested objects with snake_case keys', () => {
    const result = transformRequest({ campaignData: { merchantId: 5 } });
    expect(result).toBe(JSON.stringify({ campaign_data: { merchant_id: 5 } }));
  });
});

// ---------------------------------------------------------------------------
// transformResponse
// ---------------------------------------------------------------------------

describe('transformResponse', () => {
  it('parses a JSON string and camelizes keys', () => {
    const json = JSON.stringify({ user_id: 1, first_name: 'Bob' });
    const result = transformResponse(json);
    expect(result).toEqual({ userId: 1, firstName: 'Bob' });
  });

  it('camelizes an already-parsed object', () => {
    const obj = { on_chain_status: 'confirmed', reward_rate: 1.5 };
    expect(transformResponse(obj)).toEqual({
      onChainStatus: 'confirmed',
      rewardRate: 1.5,
    });
  });

  it('returns invalid JSON strings as-is', () => {
    expect(transformResponse('not json')).toBe('not json');
  });

  it('returns numbers unchanged', () => {
    expect(transformResponse(42)).toBe(42);
  });

  it('handles null', () => {
    expect(transformResponse(null)).toBeNull();
  });

  it('handles arrays inside JSON string', () => {
    const json = JSON.stringify([{ item_id: 1 }, { item_id: 2 }]);
    const result = transformResponse(json);
    expect(result).toEqual([{ itemId: 1 }, { itemId: 2 }]);
  });
});
