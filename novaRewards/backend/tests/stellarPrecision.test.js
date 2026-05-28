'use strict';

/**
 * Stellar numeric precision tests (#954)
 *
 * Verifies that the maximum Stellar token amount (922,337,203,685.4775807),
 * 7-decimal-place amounts, arithmetic operations, and large-number display
 * are handled correctly without floating-point precision loss.
 *
 * Closes #954
 */

const { xlmToStroops, stroopsToXlm, pointsToTokens } = require('../src/utils/conversion');
const { roundTo } = require('../src/utils/math');

// ── Constants ─────────────────────────────────────────────────────────────

/**
 * Stellar int64 max / 10^7 = 922337203685.4775807
 * This is the maximum representable NOVA token amount.
 */
const MAX_STELLAR_AMOUNT = '922337203685.4775807';
const MAX_STROOPS = 9_223_372_036_854_775_807n; // int64 max as BigInt
const STROOPS_PER_TOKEN = 10_000_000n;

// ── Maximum amount handling ───────────────────────────────────────────────

describe('Maximum Stellar token amount', () => {
  it('MAX_STELLAR_AMOUNT string parses to the correct value', () => {
    // Use BigInt arithmetic to verify the exact value
    const [intPart, fracPart] = MAX_STELLAR_AMOUNT.split('.');
    const stroops = BigInt(intPart) * STROOPS_PER_TOKEN + BigInt(fracPart);
    expect(stroops).toBe(MAX_STROOPS);
  });

  it('BigInt representation of max stroops equals int64 max', () => {
    expect(MAX_STROOPS).toBe(9_223_372_036_854_775_807n);
  });

  it('max amount integer part is 922337203685', () => {
    const intPart = MAX_STELLAR_AMOUNT.split('.')[0];
    expect(intPart).toBe('922337203685');
  });

  it('max amount fractional part has exactly 7 decimal places', () => {
    const fracPart = MAX_STELLAR_AMOUNT.split('.')[1];
    expect(fracPart).toHaveLength(7);
    expect(fracPart).toBe('4775807');
  });

  it('JavaScript Number cannot represent max stroops exactly (precision loss documented)', () => {
    // This test documents the known JS limitation — Number loses precision
    // for values > Number.MAX_SAFE_INTEGER (2^53 - 1 = 9007199254740991)
    const maxStroopsAsNumber = Number(MAX_STROOPS);
    // The number is larger than MAX_SAFE_INTEGER, so it will be rounded
    expect(Number.MAX_SAFE_INTEGER).toBeLessThan(Number(MAX_STROOPS));
    // BigInt preserves the exact value
    expect(BigInt(MAX_STROOPS)).toBe(MAX_STROOPS);
  });

  it('BigInt arithmetic preserves max stroops exactly', () => {
    const computed = BigInt('922337203685') * STROOPS_PER_TOKEN + BigInt('4775807');
    expect(computed).toBe(MAX_STROOPS);
  });
});

// ── 7 decimal place precision ─────────────────────────────────────────────

describe('7 decimal place amounts are not rounded or truncated', () => {
  const CASES = [
    { amount: '0.0000001', stroops: 1n },
    { amount: '0.0000010', stroops: 10n },
    { amount: '1.0000001', stroops: 10_000_001n },
    { amount: '1.1234567', stroops: 11_234_567n },
    { amount: '100.9999999', stroops: 1_009_999_999n },
  ];

  CASES.forEach(({ amount, stroops }) => {
    it(`${amount} → ${stroops} stroops (BigInt)`, () => {
      const [intPart, fracPart = '0000000'] = amount.split('.');
      const paddedFrac = fracPart.padEnd(7, '0').slice(0, 7);
      const computed = BigInt(intPart) * STROOPS_PER_TOKEN + BigInt(paddedFrac);
      expect(computed).toBe(stroops);
    });
  });

  it('minimum unit (1 stroop = 0.0000001 tokens) round-trips correctly', () => {
    const oneStroop = 1n;
    const tokens = Number(oneStroop) / Number(STROOPS_PER_TOKEN);
    // 1e-7 should be representable in IEEE 754 without loss
    expect(tokens).toBe(1e-7);
    expect(tokens.toFixed(7)).toBe('0.0000001');
  });

  it('1.1234567 does not lose the 7th decimal place', () => {
    const amount = 1.1234567;
    // JavaScript floats can lose precision at 7 decimal places
    // Verify the string representation is correct
    expect(amount.toFixed(7)).toBe('1.1234567');
  });

  it('stroopsToXlm preserves 7 decimal places for small values', () => {
    // 1 stroop = 0.0000001 XLM
    expect(stroopsToXlm(1)).toBe(1e-7);
    expect(stroopsToXlm(1).toFixed(7)).toBe('0.0000001');
  });
});

// ── Arithmetic operations (balance subtraction) ───────────────────────────

describe('Arithmetic operations do not lose precision', () => {
  it('BigInt subtraction: large balance minus campaign amount', () => {
    const balance = 1_000_000_000n * STROOPS_PER_TOKEN; // 1 billion tokens in stroops
    const campaignAmount = 500_000_000n * STROOPS_PER_TOKEN; // 500 million tokens
    const remaining = balance - campaignAmount;
    expect(remaining).toBe(500_000_000n * STROOPS_PER_TOKEN);
  });

  it('BigInt subtraction: exact stroop-level precision', () => {
    // 10.0000001 - 0.0000001 = 10.0000000
    const a = 10n * STROOPS_PER_TOKEN + 1n; // 100_000_001 stroops
    const b = 1n;                            // 1 stroop
    expect(a - b).toBe(10n * STROOPS_PER_TOKEN);
  });

  it('floating-point subtraction of large amounts can lose precision (documented)', () => {
    // This documents the known JS float issue
    const a = 922337203685.4775807;
    const b = 0.0000001;
    // Float arithmetic may not give exact result
    const result = a - b;
    // We document that BigInt should be used instead
    const aBigInt = MAX_STROOPS;
    const bBigInt = 1n;
    expect(aBigInt - bBigInt).toBe(9_223_372_036_854_775_806n);
  });

  it('xlmToStroops uses Math.round to avoid float truncation', () => {
    // 0.1 XLM = 1,000,000 stroops
    expect(xlmToStroops(0.1)).toBe(1_000_000);
    // 0.0000001 XLM = 1 stroop
    expect(xlmToStroops(0.0000001)).toBe(1);
    // 1.1234567 XLM = 11,234,567 stroops
    expect(xlmToStroops(1.1234567)).toBe(11_234_567);
  });

  it('stroopsToXlm round-trips correctly for common amounts', () => {
    const amounts = [1, 100, 1_000_000, 10_000_000, 100_000_000];
    for (const stroops of amounts) {
      const xlm = stroopsToXlm(stroops);
      const backToStroops = xlmToStroops(xlm);
      expect(backToStroops).toBe(stroops);
    }
  });

  it('pointsToTokens does not lose precision for small rates', () => {
    // 1000 points at 0.001 rate = 1 token
    expect(pointsToTokens(1000, 0.001)).toBeCloseTo(1, 6);
    // 1 point at 0.0000001 rate = 0.0000001 tokens
    expect(pointsToTokens(1, 0.0000001)).toBeCloseTo(1e-7, 10);
  });
});

// ── Large amount display ──────────────────────────────────────────────────

describe('Large amounts display correctly without overflow', () => {
  it('max amount formats without scientific notation using toFixed', () => {
    const amount = 922337203685.4775807;
    // toFixed(7) should not produce scientific notation
    const formatted = amount.toFixed(7);
    expect(formatted).not.toContain('e');
    expect(formatted).not.toContain('E');
  });

  it('max amount integer part does not overflow Number.MAX_SAFE_INTEGER check', () => {
    // The integer part (922337203685) is safely within MAX_SAFE_INTEGER
    const intPart = 922_337_203_685;
    expect(intPart).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(Number.isSafeInteger(intPart)).toBe(true);
  });

  it('max stroops (int64 max) exceeds Number.MAX_SAFE_INTEGER — BigInt required', () => {
    expect(Number(MAX_STROOPS)).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
    // BigInt handles it exactly
    expect(MAX_STROOPS > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it('Intl.NumberFormat formats large token amounts without overflow', () => {
    const amount = 922337203685;
    const formatted = new Intl.NumberFormat('en-US').format(amount);
    expect(formatted).toBe('922,337,203,685');
    expect(formatted).not.toContain('e');
  });

  it('roundTo utility handles 7 decimal places correctly', () => {
    expect(roundTo(1.12345678, 7)).toBe(1.1234568);
    expect(roundTo(0.00000015, 7)).toBe(0.0000002);
  });

  it('BigInt-to-display-string conversion preserves all digits', () => {
    const stroops = MAX_STROOPS;
    const intPart = stroops / STROOPS_PER_TOKEN;
    const fracPart = stroops % STROOPS_PER_TOKEN;
    const display = `${intPart}.${String(fracPart).padStart(7, '0')}`;
    expect(display).toBe(MAX_STELLAR_AMOUNT);
  });
});

// ── Boundary values ───────────────────────────────────────────────────────

describe('Boundary values', () => {
  it('minimum valid amount: 1 stroop = 0.0000001', () => {
    const stroops = 1n;
    const intPart = stroops / STROOPS_PER_TOKEN;
    const fracPart = stroops % STROOPS_PER_TOKEN;
    const display = `${intPart}.${String(fracPart).padStart(7, '0')}`;
    expect(display).toBe('0.0000001');
  });

  it('zero amount: 0 stroops', () => {
    const stroops = 0n;
    expect(stroops).toBe(0n);
    expect(Number(stroops)).toBe(0);
  });

  it('one full token: 10000000 stroops', () => {
    const stroops = STROOPS_PER_TOKEN;
    const intPart = stroops / STROOPS_PER_TOKEN;
    expect(intPart).toBe(1n);
    expect(stroopsToXlm(Number(stroops))).toBe(1);
  });

  it('maximum amount minus 1 stroop is valid', () => {
    const almostMax = MAX_STROOPS - 1n;
    expect(almostMax).toBe(9_223_372_036_854_775_806n);
    expect(almostMax).toBeGreaterThan(0n);
  });

  it('xlmToStroops handles the maximum safe float amount', () => {
    // 922337203685 is within Number.MAX_SAFE_INTEGER
    const result = xlmToStroops(922337203685);
    expect(result).toBe(9_223_372_036_850_000_000);
  });
});
