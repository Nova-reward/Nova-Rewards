jest.mock('../db/index', () => ({
     query: jest.fn(),
     pool: { connect: jest.fn() },
}));

const { query, pool } = require('../db/index');
const walletRepo = require('../db/walletRepository');

describe('walletRepository', () => {
     beforeEach(() => {
          jest.clearAllMocks();
     });

     test('getWalletById returns row or null', async () => {
          query.mockResolvedValue({ rows: [{ id: 1, address: 'GABC' }] });
          const result = await walletRepo.getWalletById(1);
          expect(result).toEqual({ id: 1, address: 'GABC' });

          query.mockResolvedValue({ rows: [] });
          const missing = await walletRepo.getWalletById(2);
          expect(missing).toBeNull();
     });

     test('createWallet toggles primary correctly', async () => {
          const client = { query: jest.fn(), release: jest.fn() };
          pool.connect.mockResolvedValue(client);
          client.query
               .mockResolvedValueOnce() // BEGIN
               .mockResolvedValueOnce() // UPDATE set non-primary
               .mockResolvedValueOnce({ rows: [{ id: 2, user_id: 1, address: 'GXYZ', is_primary: true }] }) // INSERT
               .mockResolvedValueOnce(); // COMMIT

          const result = await walletRepo.createWallet({ userId: 1, address: 'GXYZ', isPrimary: true });
          expect(result).toEqual({ id: 2, user_id: 1, address: 'GXYZ', is_primary: true });
          expect(client.query).toHaveBeenCalledWith('BEGIN');
          expect(client.query).toHaveBeenCalledWith('UPDATE wallets SET is_primary = FALSE WHERE user_id = $1', [1]);
          expect(client.query).toHaveBeenCalledWith(
               expect.stringContaining('INSERT INTO wallets'),
               [1, 'GXYZ', true, true]
          );
          expect(client.query).toHaveBeenCalledWith('COMMIT');
     });
});
