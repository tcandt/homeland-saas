const test = require('node:test');
const assert = require('node:assert/strict');

const { parseArguments, runBackupCycle } = require('./production-backup-cycle');

test('parses backup cycle CLI arguments', () => {
  assert.deepEqual(
    parseArguments([
      '--env-file', '.env.public-production',
      '--output-dir', '.codex-backups/production',
      '--storage-dir', 'storage',
      '--keep-daily', '7',
      '--keep-weekly', '4',
      '--keep-monthly', '12',
      '--max-age-hours', '24',
      '--require-off-host',
      '--apply-retention',
      '--skip-pg-restore-list',
    ]),
    {
      envFile: '.env.public-production',
      outputDir: '.codex-backups/production',
      storageDir: 'storage',
      pgDump: process.env.PG_DUMP_PATH || 'pg_dump',
      pgRestore: process.env.PG_RESTORE_PATH || 'pg_restore',
      keepDaily: 7,
      keepWeekly: 4,
      keepMonthly: 12,
      maxAgeHours: 24,
      requireOffHost: true,
      applyRetention: true,
      skipDb: false,
      skipStorage: false,
      skipRestoreCheck: false,
      skipPgRestoreList: true,
    },
  );
});

test('runs backup, retention, and restore check as one cycle', () => {
  const calls = [];
  const result = runBackupCycle(
    {
      envFile: '.env.public-production',
      outputDir: '.codex-backups/production',
      storageDir: 'storage',
      pgDump: 'pg_dump',
      pgRestore: 'pg_restore',
      keepDaily: 7,
      keepWeekly: 4,
      keepMonthly: 12,
      maxAgeHours: 24,
      requireOffHost: true,
      applyRetention: false,
      skipDb: false,
      skipStorage: false,
      skipRestoreCheck: false,
      skipPgRestoreList: false,
    },
    {
      runBackup: (options) => {
        calls.push(['backup', options]);
        return { id: 'backup-1', status: 'SUCCESS', offHostLocation: 'r2://bucket/backup-1', errors: [] };
      },
      runRetention: (options) => {
        calls.push(['retention', options]);
        return {
          summary: { retainedBackups: 7, prunableBackups: 2 },
          deletedBackups: [],
          latestSuccessfulOffHost: { id: 'backup-1' },
        };
      },
      runRestoreCheck: (options) => {
        calls.push(['restore-check', options]);
        return { ready: true, summary: { failed: 0, total: 6 } };
      },
    },
  );

  assert.equal(calls.length, 3);
  assert.equal(result.status, 'SUCCESS_WITH_PENDING_RETENTION');
  assert.equal(result.backup.id, 'backup-1');
  assert.equal(result.retention.prunableBackups, 2);
  assert.equal(result.restoreCheck.ready, true);
});
