// Feature: nova-rewards, Property 9: Merchant-scoped transaction queries never leak another merchant's data

jest.mock('../db/index', () => ({ query: jest.fn() }));

const fc = require('fast-check');

const { query } = require('../db/index');
const { getTransactionsByMerchant } = require('../db/transactionRepository');

const merchantPairArb = fc
  .tuple(
    fc.integer({ min: 1, max: 1_000_000 }),
    fc.integer({ min: 1, max: 1_000_000 })
  )
  .filter(([left, right]) => left !== right);

const merchantScopedTransactionsArb = merchantPairArb.chain(([merchantAId, merchantBId]) =>
  fc.record({
    merchantAId: fc.constant(merchantAId),
    merchantBId: fc.constant(merchantBId),
    queriedMerchantId: fc.constantFrom(merchantAId, merchantBId),
    merchantATransactions: transactionSetArb(merchantAId),
    merchantBTransactions: transactionSetArb(merchantBId),
  })
);

function transactionSetArb(merchantId) {
  return fc.uniqueArray(
    fc.record({
      id: fc.integer({ min: 1, max: 10_000_000 }),
      merchant_id: fc.constant(merchantId),
      tx_hash: fc.uuid(),
      tx_type: fc.constantFrom('distribution', 'redemption', 'transfer'),
      amount: fc.integer({ min: 1, max: 1_000_000 }).map(String),
      created_at: fc.date().map((value) => value.toISOString()),
    }),
    {
      minLength: 1,
      maxLength: 20,
      selector: (tx) => tx.id,
    }
  );
}

function sortByCreatedAtDesc(rows) {
  return [...rows].sort((left, right) => (
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  ));
}

describe('getTransactionsByMerchant property tests (Property 9)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns only transactions for the queried merchant and never leaks another merchant dataset', async () => {
    await fc.assert(
      fc.asyncProperty(
        merchantScopedTransactionsArb,
        async ({
          merchantAId,
          merchantBId,
          queriedMerchantId,
          merchantATransactions,
          merchantBTransactions,
        }) => {
          const otherMerchantId = queriedMerchantId === merchantAId ? merchantBId : merchantAId;
          const allTransactions = [
            ...merchantATransactions,
            ...merchantBTransactions,
          ];

          query.mockImplementation(async (_sql, [merchantId]) => ({
            rows: sortByCreatedAtDesc(
              allTransactions.filter((tx) => tx.merchant_id === merchantId)
            ),
          }));

          const result = await getTransactionsByMerchant(queriedMerchantId);
          const expected = sortByCreatedAtDesc(
            queriedMerchantId === merchantAId ? merchantATransactions : merchantBTransactions
          );

          expect(query).toHaveBeenCalledWith(
            expect.stringContaining('WHERE merchant_id = $1'),
            [queriedMerchantId]
          );
          expect(result).toEqual(expected);
          expect(result).toHaveLength(expected.length);
          expect(result.every((tx) => tx.merchant_id === queriedMerchantId)).toBe(true);
          expect(result.some((tx) => tx.merchant_id === otherMerchantId)).toBe(false);

          query.mockReset();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
