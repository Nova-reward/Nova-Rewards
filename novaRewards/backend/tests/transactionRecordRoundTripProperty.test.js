// Feature: nova-rewards, Property 4: Recorded transactions round-trip by tx hash without field loss

jest.mock('../db/index', () => ({ query: jest.fn() }));

const fc = require('fast-check');

const { query } = require('../db/index');
const {
  recordTransaction,
  getTransactionByHash,
} = require('../db/transactionRepository');

function transactionInputArb(txType) {
  return fc.record({
    txHash: fc.uuid(),
    txType: fc.constant(txType),
    amount: fc.integer({ min: 1, max: 1_000_000 }).map(String),
    fromWallet: fc.hexaString({ minLength: 10, maxLength: 56 }),
    toWallet: fc.hexaString({ minLength: 10, maxLength: 56 }),
    merchantId: fc.integer({ min: 1, max: 1_000_000 }),
    campaignId: fc.integer({ min: 1, max: 1_000_000 }),
    stellarLedger: fc.integer({ min: 1, max: 10_000_000 }),
  });
}

describe('transaction record round-trip property tests (Property 4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each(['distribution', 'redemption', 'transfer'])(
    'recordTransaction and getTransactionByHash preserve all fields for tx_type=%s',
    async (txType) => {
      await fc.assert(
        fc.asyncProperty(
          transactionInputArb(txType),
          async (transactionInput) => {
            const rowsByHash = new Map();
            let nextId = 1;

            query.mockImplementation(async (sql, params) => {
              if (sql.includes('INSERT INTO transactions')) {
                const insertedRow = {
                  id: nextId++,
                  tx_hash: params[0],
                  tx_type: params[1],
                  amount: params[2],
                  from_wallet: params[3],
                  to_wallet: params[4],
                  merchant_id: params[5],
                  campaign_id: params[6],
                  user_id: params[7],
                  stellar_ledger: params[8],
                  status: params[9],
                  reference_tx_hash: params[10],
                  refund_reason: params[11],
                  metadata: JSON.parse(params[12]),
                };

                rowsByHash.set(insertedRow.tx_hash, insertedRow);
                return { rows: [insertedRow] };
              }

              if (sql.includes('WHERE t.tx_hash = $1')) {
                return { rows: [rowsByHash.get(params[0])].filter(Boolean) };
              }

              throw new Error(`Unexpected SQL in Property 4 test: ${sql}`);
            });

            const inserted = await recordTransaction(transactionInput);
            const retrieved = await getTransactionByHash(transactionInput.txHash);

            expect(query).toHaveBeenNthCalledWith(
              1,
              expect.stringContaining('INSERT INTO transactions'),
              [
                transactionInput.txHash,
                transactionInput.txType,
                transactionInput.amount,
                transactionInput.fromWallet,
                transactionInput.toWallet,
                transactionInput.merchantId,
                transactionInput.campaignId,
                null,
                transactionInput.stellarLedger,
                'completed',
                null,
                null,
                '{}',
              ]
            );
            expect(query).toHaveBeenNthCalledWith(
              2,
              expect.stringContaining('WHERE t.tx_hash = $1'),
              [transactionInput.txHash]
            );
            expect(inserted).toEqual(retrieved);
            expect(retrieved).toEqual({
              id: 1,
              tx_hash: transactionInput.txHash,
              tx_type: transactionInput.txType,
              amount: transactionInput.amount,
              from_wallet: transactionInput.fromWallet,
              to_wallet: transactionInput.toWallet,
              merchant_id: transactionInput.merchantId,
              campaign_id: transactionInput.campaignId,
              user_id: null,
              stellar_ledger: transactionInput.stellarLedger,
              status: 'completed',
              reference_tx_hash: null,
              refund_reason: null,
              metadata: {},
            });

            query.mockReset();
            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
