const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');

const DEFAULT_BACKUP_DIR = path.resolve(__dirname, '../../backups/base');
const DEFAULT_WAL_ARCHIVE_DIR = path.resolve(__dirname, '../../backups/wal');
const DEFAULT_RETENTION_DAYS = 14;
const DEFAULT_SCHEDULE_TIME = '02:00';

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  return String(value).toLowerCase() === 'true';
}

function resolveScheduleTime(value = DEFAULT_SCHEDULE_TIME) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error('BACKUP_SCHEDULE_UTC must be in HH:MM format');
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error('BACKUP_SCHEDULE_UTC contains an invalid time');
  }

  return { hour, minute, value: `${match[1]}:${match[2]}` };
}

function getBackupConfig() {
  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    throw new Error('BACKUP_RETENTION_DAYS must be a positive integer');
  }

  return {
    enabled: parseBoolean(process.env.BACKUP_ENABLED, false),
    backupDir: path.resolve(process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR),
    walArchiveDir: path.resolve(process.env.BACKUP_WAL_ARCHIVE_DIR || DEFAULT_WAL_ARCHIVE_DIR),
    passphrase: process.env.BACKUP_PASSPHRASE || '',
    retentionDays,
    schedule: resolveScheduleTime(process.env.BACKUP_SCHEDULE_UTC || DEFAULT_SCHEDULE_TIME),
    databaseUrl: process.env.DATABASE_URL,
  };
}

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function ensureBackupDirectories(config = getBackupConfig()) {
  await Promise.all([
    ensureDir(config.backupDir),
    ensureDir(config.walArchiveDir),
  ]);
}

function backupIdFromDate(now = new Date()) {
  return now.toISOString().replace(/[:.]/g, '-');
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let stderr = '';

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stderr });
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

async function createEncryptedBackup({ now = new Date(), reason = 'scheduled' } = {}) {
  const config = getBackupConfig();
  if (!config.enabled) {
    throw new Error('Backups are disabled');
  }
  if (!config.passphrase) {
    throw new Error('BACKUP_PASSPHRASE is required when backups are enabled');
  }
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to create backups');
  }

  await ensureBackupDirectories(config);

  const backupId = backupIdFromDate(now);
  const fileName = `base-${backupId}.tar.gz.enc`;
  const backupPath = path.join(config.backupDir, fileName);
  const manifestPath = path.join(config.backupDir, `base-${backupId}.manifest.json`);
  const tempPath = `${backupPath}.tmp`;

  const baseBackup = spawn(
    'pg_basebackup',
    [
      '--dbname',
      config.databaseUrl,
      '--pgdata',
      '-',
      '--format',
      'tar',
      '--gzip',
      '--checkpoint=fast',
      '--wal-method=none',
      '--label',
      `nova-rewards-${backupId}`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let baseBackupError = '';
  baseBackup.stderr.on('data', (chunk) => {
    baseBackupError += chunk.toString();
  });

  const openssl = spawn(
    'openssl',
    ['enc', '-aes-256-cbc', '-pbkdf2', '-salt', '-pass', `pass:${config.passphrase}`, '-out', tempPath],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  );

  let opensslError = '';
  openssl.stderr.on('data', (chunk) => {
    opensslError += chunk.toString();
  });

  await pipeline(baseBackup.stdout, openssl.stdin);

  const [baseBackupResult, opensslResult] = await Promise.allSettled([
    new Promise((resolve, reject) => {
      baseBackup.on('error', reject);
      baseBackup.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`pg_basebackup exited with code ${code}: ${baseBackupError.trim()}`));
      });
    }),
    new Promise((resolve, reject) => {
      openssl.on('error', reject);
      openssl.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`openssl exited with code ${code}: ${opensslError.trim()}`));
      });
    }),
  ]);

  if (baseBackupResult.status === 'rejected' || opensslResult.status === 'rejected') {
    await fs.promises.rm(tempPath, { force: true });
    throw baseBackupResult.reason || opensslResult.reason;
  }

  await fs.promises.rename(tempPath, backupPath);
  const stats = await fs.promises.stat(backupPath);

  const manifest = {
    backupId,
    createdAt: now.toISOString(),
    reason,
    fileName,
    path: backupPath,
    walArchiveDir: config.walArchiveDir,
    sizeBytes: stats.size,
    encryption: {
      algorithm: 'aes-256-cbc',
      kdf: 'pbkdf2',
    },
    retentionExpiresAt: new Date(
      now.getTime() + config.retentionDays * 24 * 60 * 60 * 1000
    ).toISOString(),
  };

  await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return manifest;
}

async function listBackups(config = getBackupConfig()) {
  await ensureBackupDirectories(config);
  const names = await fs.promises.readdir(config.backupDir);
  const manifests = await Promise.all(
    names
      .filter((name) => name.endsWith('.manifest.json'))
      .map(async (name) => {
        const fullPath = path.join(config.backupDir, name);
        const raw = await fs.promises.readFile(fullPath, 'utf8');
        return JSON.parse(raw);
      })
  );

  return manifests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function pruneExpiredBackups(now = new Date(), config = getBackupConfig()) {
  const backups = await listBackups(config);
  const removed = [];

  for (const backup of backups) {
    if (new Date(backup.retentionExpiresAt) > now) continue;

    await fs.promises.rm(backup.path, { force: true });
    await fs.promises.rm(path.join(config.backupDir, `base-${backup.backupId}.manifest.json`), { force: true });
    removed.push(backup.backupId);
  }

  return removed;
}

async function listArchivedWalSegments(config = getBackupConfig()) {
  await ensureBackupDirectories(config);
  const names = await fs.promises.readdir(config.walArchiveDir);
  const metadataFiles = names.filter((name) => name.endsWith('.json'));

  const entries = await Promise.all(metadataFiles.map(async (name) => {
    const raw = await fs.promises.readFile(path.join(config.walArchiveDir, name), 'utf8');
    return JSON.parse(raw);
  }));

  return entries.sort((a, b) => new Date(a.archivedAt) - new Date(b.archivedAt));
}

function selectBackupForTimestamp(backups, targetTime) {
  const targetMs = new Date(targetTime).getTime();
  if (Number.isNaN(targetMs)) {
    throw new Error('targetTime must be a valid ISO-8601 timestamp');
  }

  const eligible = backups
    .filter((backup) => new Date(backup.createdAt).getTime() <= targetMs)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return eligible[0] || null;
}

async function buildRecoveryPlan({ targetTime } = {}) {
  if (!targetTime) {
    throw new Error('targetTime is required to build a recovery plan');
  }

  const config = getBackupConfig();
  const backups = await listBackups(config);
  const backup = selectBackupForTimestamp(backups, targetTime);

  if (!backup) {
    throw new Error('No backup exists at or before the requested recovery point');
  }

  const walSegments = await listArchivedWalSegments(config);
  const targetMs = new Date(targetTime).getTime();
  const applicableWal = walSegments.filter(
    (segment) => new Date(segment.archivedAt).getTime() <= targetMs
  );

  return {
    targetTime,
    backup,
    walSegmentCount: applicableWal.length,
    walSegments: applicableWal,
    restoreCommand: [
      'node',
      'scripts/restore-pitr.js',
      '--backup-manifest',
      path.join(config.backupDir, `base-${backup.backupId}.manifest.json`),
      '--target-time',
      targetTime,
    ].join(' '),
  };
}

module.exports = {
  backupIdFromDate,
  buildRecoveryPlan,
  createEncryptedBackup,
  ensureBackupDirectories,
  getBackupConfig,
  listArchivedWalSegments,
  listBackups,
  pruneExpiredBackups,
  resolveScheduleTime,
  selectBackupForTimestamp,
  runCommand,
};
