// Feature: nova-rewards, Property 12: getMerchantTotals sums distribution amounts correctly
// Validates: Requirements 10.2

const fc = require('fast-check');

// Mock db/index before requiring the repository
jest.mock('../db/index', () => ({ query: jest.fn() }));

const { query } = require('../db/index');
const { getMerchantTotals } = require('../db/transactionRepository');

describe('getMerchantTotals (Property 12)', () => {
  beforeEach(() => jest.clearAllMocks());

  // Property: totalDistributed always equals the arithmetic sum of all distribution amounts
  test('totalDistributed equals the sum of a random list of distribution amounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a non-empty list of positive distribution amounts (up to 2 decimal places)
        fc.array(
          fc.integer({ min: 1, max: 100000 }).map((n) => n / 100),
          { minLength: 1, maxLength: 50 }
        ),
        async (amounts) => {
          const expectedTotal = amounts.reduce((sum, a) => sum + a, 0);

          // Simulate what Postgres GROUP BY tx_type returns
          query.mockResolvedValue({
            rows: [
              { tx_type: 'distribution', total: String(expectedTotal) },
              { tx_type: 'redemption', total: '0' },
            ],
          });

          const result = await getMerchantTotals(1);

          expect(parseFloat(result.totalDistributed)).toBeCloseTo(expectedTotal, 5);
          expect(result.totalRedeemed).toBe('0');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: totalDistributed is 0 when there are no distribution transactions
  test('totalDistributed is 0 when merchant has no distributions', async () => {
    query.mockResolvedValue({ rows: [] });

    const result = await getMerchantTotals(99);

    expect(result.totalDistributed).toBe('0');
    expect(result.totalRedeemed).toBe('0');
  });
});
