jest.mock('../db/index', () => ({ query: jest.fn() }));

const { query } = require('../db/index');
const auditLogRepo = require('../db/auditLogRepository');

describe('auditLogRepository', () => {
     beforeEach(() => {
          jest.clearAllMocks();
     });

     test('logAudit inserts and returns row', async () => {
          query.mockResolvedValue({ rows: [{ id: 1, entity_type: 'user', action: 'create' }] });
          const row = await auditLogRepo.logAudit({ entityType: 'user', action: 'create', performedBy: 1 });
          expect(row).toEqual({ id: 1, entity_type: 'user', action: 'create' });
          expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO audit_logs'), ['user', null, 'create', 1, null, null]);
     });

     test('getAuditLogs returns paginated data', async () => {
          query
               .mockResolvedValueOnce({ rows: [{ total: '3' }] })
               .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] });

          const pageData = await auditLogRepo.getAuditLogs({ page: 1, limit: 3 });
          expect(pageData).toEqual({ data: [{ id: 1 }, { id: 2 }, { id: 3 }], total: 3, page: 1, limit: 3 });
     });
});
