jest.mock('../db/index', () => ({ query: jest.fn() }));

const { query } = require('../db/index');
const { recordTransaction } = require('../db/transactionRepository');

describe('recordTransaction campaignId nullability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [{ id: 1 }] });
  });

  test('passes SQL null at $7 when campaignId is undefined', async () => {
    await recordTransaction({
      txHash: 'abc123',
      txType: 'distribution',
      amount: '10',
      fromWallet: 'GAAAA',
      toWallet: 'GBBBB',
      merchantId: 1,
      stellarLedger: 123,
    });

    const params = query.mock.calls[0][1];
    expect(params[6]).toBeNull();
  });

  test('passes SQL null at $7 when campaignId is null', async () => {
    await recordTransaction({
      txHash: 'def456',
      txType: 'distribution',
      amount: '20',
      fromWallet: 'GCCCC',
      toWallet: 'GDDDD',
      merchantId: 2,
      campaignId: null,
      stellarLedger: 456,
    });

    const params = query.mock.calls[0][1];
    expect(params[6]).toBeNull();
  });
});