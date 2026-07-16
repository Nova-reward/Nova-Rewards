jest.mock('../db/index', () => ({ query: jest.fn() }));

const { query } = require('../db/index');
const notificationRepo = require('../db/notificationRepository');
const { NotificationFactory, UserFactory } = require('./fixtures');

describe('notificationRepository', () => {
     beforeEach(() => {
          jest.clearAllMocks();
     });

     test('createNotification stores the record and returns it', async () => {
          const user = UserFactory.build();
          const notification = NotificationFactory.build({ user_id: user.id, type: 'alert', message: 'Hello' });
          query.mockResolvedValue({ rows: [notification] });

          const row = await notificationRepo.createNotification({
               userId: user.id,
               type: notification.type,
               title: notification.title,
               message: notification.message,
               payload: notification.payload,
          });
          expect(row).toEqual(notification);
          expect(query).toHaveBeenCalledWith(
               expect.stringContaining('INSERT INTO notifications'),
               [user.id, notification.type, notification.title, notification.message, JSON.stringify(notification.payload)]
          );
     });

     test('getNotificationsForUser returns data and pagination metadata', async () => {
          const notifications = NotificationFactory.buildList(2);
          query
               .mockResolvedValueOnce({ rows: [{ total: '2' }] })
               .mockResolvedValueOnce({ rows: notifications });

          const result = await notificationRepo.getNotificationsForUser(1, { page: 1, limit: 2 });
          expect(result).toEqual({ data: notifications, total: 2, page: 1, limit: 2 });
     });

     test('markNotificationAsRead updates the row', async () => {
          const notification = NotificationFactory.build({ is_read: true });
          query.mockResolvedValue({ rows: [notification] });

          const updated = await notificationRepo.markNotificationAsRead(notification.id);
          expect(updated).toEqual(notification);
          expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE notifications'), [notification.id]);
     });
});
