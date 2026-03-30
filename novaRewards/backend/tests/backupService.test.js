const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  backupIdFromDate,
  buildRecoveryPlan,
  resolveScheduleTime,
  selectBackupForTimestamp,
} = require('../services/backupService');

describe('backupService helpers', () => {
  test('resolveScheduleTime parses HH:MM', () => {
    expect(resolveScheduleTime('02:15')).toEqual({ hour: 2, minute: 15, value: '02:15' });
  });

  test('backupIdFromDate is filesystem-safe', () => {
    expect(backupIdFromDate(new Date('2026-03-30T01:02:03.456Z'))).toBe('2026-03-30T01-02-03-456Z');
  });

  test('selectBackupForTimestamp returns latest backup at or before target', () => {
    const selected = selectBackupForTimestamp([
      { backupId: 'older', createdAt: '2026-03-29T00:00:00Z' },
      { backupId: 'match', createdAt: '2026-03-30T00:00:00Z' },
      { backupId: 'future', createdAt: '2026-03-31T00:00:00Z' },
    ], '2026-03-30T05:00:00Z');

    expect(selected.backupId).toBe('match');
  });

  test('buildRecoveryPlan picks backup and matching WAL metadata', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-plan-'));
    const baseDir = path.join(root, 'base');
    const walDir = path.join(root, 'wal');
    fs.mkdirSync(baseDir, { recursive: true });
    fs.mkdirSync(walDir, { recursive: true });

    process.env.BACKUP_DIR = baseDir;
    process.env.BACKUP_WAL_ARCHIVE_DIR = walDir;

    fs.writeFileSync(path.join(baseDir, 'base-a.manifest.json'), JSON.stringify({
      backupId: 'a',
      createdAt: '2026-03-30T00:00:00Z',
      path: path.join(baseDir, 'base-a.tar.gz.enc'),
      walArchiveDir: walDir,
      retentionExpiresAt: '2026-04-13T00:00:00Z',
    }));

    fs.writeFileSync(path.join(walDir, '000000010000000000000001.json'), JSON.stringify({
      fileName: '000000010000000000000001.enc',
      archivedAt: '2026-03-30T00:30:00Z',
    }));
    fs.writeFileSync(path.join(walDir, '000000010000000000000002.json'), JSON.stringify({
      fileName: '000000010000000000000002.enc',
      archivedAt: '2026-03-30T02:30:00Z',
    }));

    const plan = await buildRecoveryPlan({ targetTime: '2026-03-30T01:00:00Z' });

    expect(plan.backup.backupId).toBe('a');
    expect(plan.walSegmentCount).toBe(1);
    expect(plan.restoreCommand).toContain('scripts/restore-pitr.js');
  });
});
