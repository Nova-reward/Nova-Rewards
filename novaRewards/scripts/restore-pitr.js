#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key.startsWith('--')) {
      args[key.slice(2)] = value;
      i += 1;
    }
  }
  return args;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const manifestPath = args['backup-manifest'];
  const targetTime = args['target-time'];
  const outputDir = path.resolve(args['output-dir'] || path.join(process.cwd(), 'recovery'));

  if (!manifestPath || !targetTime) {
    throw new Error('Usage: node scripts/restore-pitr.js --backup-manifest <manifest> --target-time <iso-timestamp> [--output-dir <path>]');
  }

  if (!process.env.BACKUP_PASSPHRASE) {
    throw new Error('BACKUP_PASSPHRASE is required');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-recovery-'));
  const tarPath = path.join(tempDir, 'base.tar.gz');
  const walArchiveDir = path.resolve(args['wal-archive-dir'] || manifest.walArchiveDir);

  fs.mkdirSync(outputDir, { recursive: true });

  await run('openssl', [
    'enc',
    '-d',
    '-aes-256-cbc',
    '-pbkdf2',
    '-pass',
    `pass:${process.env.BACKUP_PASSPHRASE}`,
    '-in',
    manifest.path,
    '-out',
    tarPath,
  ]);

  await run('tar', ['-xzf', tarPath, '-C', outputDir]);

  const recoveryConfigPath = path.join(outputDir, 'postgresql.auto.conf');
  const restoreCommand = `openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:${process.env.BACKUP_PASSPHRASE} -in ${walArchiveDir}/%f.enc -out %p`;
  fs.appendFileSync(
    recoveryConfigPath,
    `\nrestore_command = '${restoreCommand}'\nrecovery_target_time = '${targetTime}'\n`
  );
  fs.writeFileSync(path.join(outputDir, 'recovery.signal'), '');

  console.log(`Recovery data prepared in ${outputDir}`);
  console.log('Start PostgreSQL with this directory as PGDATA to replay WAL up to the requested point in time.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
