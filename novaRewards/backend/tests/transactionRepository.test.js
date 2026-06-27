jest.mock('../db/index', () => ({ query: jest.fn() }));

const { query } = require('../db/index');
const { getMerchantTotals } = require('../db/transactionRepository');
const { TransactionFactory } = require('./fixtures');

describe('getMerchantTotals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns grouped distribution and redemption totals as numeric strings', async () => {
    const dist = TransactionFactory.distribution({ merchant_id: 7, amount: '125.5000000' });
    const redeem = TransactionFactory.redemption({ merchant_id: 7, amount: '23.2500000' });
    query.mockResolvedValue({
      rows: [
        { tx_type: dist.tx_type, total: dist.amount },
        { tx_type: redeem.tx_type, total: redeem.amount },
      ],
    });

    const totals = await getMerchantTotals(7);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/SUM\(amount\)/i);
    expect(query.mock.calls[0][0]).toMatch(/GROUP BY tx_type/i);
    expect(query.mock.calls[0][1]).toEqual([7]);
    expect(totals).toEqual({
      totalDistributed: '125.5000000',
      totalRedeemed: '23.2500000',
    });
    expect(typeof totals.totalDistributed).toBe('string');
    expect(typeof totals.totalRedeemed).toBe('string');
  });

  test('returns zero strings when no matching transactions exist', async () => {
    query.mockResolvedValue({ rows: [] });

    const totals = await getMerchantTotals(99);

    expect(totals).toEqual({ totalDistributed: '0', totalRedeemed: '0' });
  });

  test('returns zero string for missing grouped type', async () => {
    const dist = TransactionFactory.distribution({ merchant_id: 3, amount: '10.0000000' });
    query.mockResolvedValue({
      rows: [{ tx_type: dist.tx_type, total: dist.amount }],
    });

    const totals = await getMerchantTotals(3);

    expect(totals).toEqual({ totalDistributed: '10.0000000', totalRedeemed: '0' });
  });
});
