jest.mock('../db/index', () => ({
     query: jest.fn(),
     pool: { connect: jest.fn() },
}));

const { query, pool } = require('../db/index');
const walletRepo = require('../db/walletRepository');
const { WalletFactory, UserFactory, STELLAR_ADDRESSES } = require('./fixtures');

describe('walletRepository', () => {
     beforeEach(() => {
          jest.clearAllMocks();
     });

     test('getWalletById returns row or null', async () => {
          const wallet = WalletFactory.build();
          query.mockResolvedValue({ rows: [wallet] });
          const result = await walletRepo.getWalletById(wallet.id);
          expect(result).toEqual(wallet);

          query.mockResolvedValue({ rows: [] });
          const missing = await walletRepo.getWalletById(999);
          expect(missing).toBeNull();
     });

     test('createWallet toggles primary correctly', async () => {
          const user = UserFactory.build();
          const wallet = WalletFactory.build({ user_id: user.id, address: STELLAR_ADDRESSES[2], is_primary: true });
          const client = { query: jest.fn(), release: jest.fn() };
          pool.connect.mockResolvedValue(client);
          client.query
               .mockResolvedValueOnce() // BEGIN
               .mockResolvedValueOnce() // UPDATE set non-primary
               .mockResolvedValueOnce({ rows: [wallet] }) // INSERT
               .mockResolvedValueOnce(); // COMMIT

          const result = await walletRepo.createWallet({ userId: user.id, address: wallet.address, isPrimary: true });
          expect(result).toEqual(wallet);
          expect(client.query).toHaveBeenCalledWith('BEGIN');
          expect(client.query).toHaveBeenCalledWith('UPDATE wallets SET is_primary = FALSE WHERE user_id = $1', [user.id]);
          expect(client.query).toHaveBeenCalledWith(
               expect.stringContaining('INSERT INTO wallets'),
               [user.id, wallet.address, true, true]
          );
          expect(client.query).toHaveBeenCalledWith('COMMIT');
     });
});
