jest.mock('../db/index', () => ({ query: jest.fn() }));

const { query } = require('../db/index');
const rewardRepo = require('../db/rewardRepository');

describe('rewardRepository', () => {
     beforeEach(() => jest.clearAllMocks());

     test('getRewardById returns row or null', async () => {
          query.mockResolvedValue({ rows: [{ id: 5, name: 'Free Coffee' }] });
          const reward = await rewardRepo.getRewardById(5);
          expect(reward).toEqual({ id: 5, name: 'Free Coffee' });

          query.mockResolvedValue({ rows: [] });
          const missing = await rewardRepo.getRewardById(999);
          expect(missing).toBeNull();
     });

     test('createReward inserts row', async () => {
          query.mockResolvedValue({ rows: [{ id: 12, name: 'T-shirt' }] });
          const row = await rewardRepo.createReward({ name: 'T-shirt', cost: 100, stock: 10 });
          expect(row).toEqual({ id: 12, name: 'T-shirt' });
          expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO rewards'), ['T-shirt', 100, 10, true]);
     });
});
