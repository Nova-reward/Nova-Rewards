jest.mock('../db/index', () => ({ query: jest.fn() }));

const { query } = require('../db/index');
const notificationRepo = require('../db/notificationRepository');

describe('notificationRepository', () => {
     beforeEach(() => {
          jest.clearAllMocks();
     });

     test('createNotification stores the record and returns it', async () => {
          query.mockResolvedValue({ rows: [{ id: 1, user_id: 1, type: 'alert', message: 'Hello' }] });
          const row = await notificationRepo.createNotification({ userId: 1, type: 'alert', title: 'Hi', message: 'Hello', payload: { a: 1 } });
          expect(row).toEqual({ id: 1, user_id: 1, type: 'alert', message: 'Hello' });
          expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO notifications'), [1, 'alert', 'Hi', 'Hello', JSON.stringify({ a: 1 })]);
     });

     test('getNotificationsForUser returns data and pagination metadata', async () => {
          query
               .mockResolvedValueOnce({ rows: [{ total: '2' }] })
               .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

          const result = await notificationRepo.getNotificationsForUser(1, { page: 1, limit: 2 });
          expect(result).toEqual({ data: [{ id: 1 }, { id: 2 }], total: 2, page: 1, limit: 2 });
     });

     test('markNotificationAsRead updates the row', async () => {
          query.mockResolvedValue({ rows: [{ id: 1, is_read: true }] });
          const updated = await notificationRepo.markNotificationAsRead(1);
          expect(updated).toEqual({ id: 1, is_read: true });
          expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE notifications'), [1]);
     });
});
