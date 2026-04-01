jest.mock('../services/backupService', () => ({
  createEncryptedBackup: jest.fn(),
  getBackupConfig: jest.fn(() => ({
    enabled: true,
    schedule: { hour: 2, minute: 0, value: '02:00' },
  })),
  pruneExpiredBackups: jest.fn(),
}));

const {
  msUntilNextScheduledRun,
  runBackupCycle,
} = require('../jobs/backupJob');
const backupService = require('../services/backupService');

describe('backupJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('msUntilNextScheduledRun targets next UTC schedule', () => {
    const now = new Date('2026-03-30T01:00:00Z');
    const delay = msUntilNextScheduledRun(now, { hour: 2, minute: 0 });
    expect(delay).toBe(60 * 60 * 1000);
  });

  test('runBackupCycle creates backup and prunes expired files', async () => {
    backupService.createEncryptedBackup.mockResolvedValue({ backupId: 'backup-1' });
    backupService.pruneExpiredBackups.mockResolvedValue(['old-backup']);

    const result = await runBackupCycle(new Date('2026-03-30T01:00:00Z'), 'manual');

    expect(backupService.createEncryptedBackup).toHaveBeenCalled();
    expect(result.manifest.backupId).toBe('backup-1');
    expect(result.pruned).toEqual(['old-backup']);
  });
});
