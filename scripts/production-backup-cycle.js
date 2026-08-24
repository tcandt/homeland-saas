#!/usr/bin/env node
const { runBackup } = require('./production-backup');
const { runRetention } = require('./production-backup-retention');
const { runRestoreCheck } = require('./production-restore-check');

function parseArguments(argv) {
  const options = {
    envFile: null,
    outputDir: '.codex-backups/production',
    storageDir: 'storage',
    pgDump: process.env.PG_DUMP_PATH || 'pg_dump',
    pgRestore: process.env.PG_RESTORE_PATH || 'pg_restore',
    keepDaily: 7,
    keepWeekly: 4,
    keepMonthly: 12,
    maxAgeHours: 24,
    requireOffHost: false,
    applyRetention: false,
    skipDb: false,
    skipStorage: false,
    skipRestoreCheck: false,
    skipPgRestoreList: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--env-file') {
      options.envFile = argv[index + 1] || null;
      index += 1;
    } else if (argument === '--output-dir') {
      options.outputDir = argv[index + 1] || options.outputDir;
      index += 1;
    } else if (argument === '--storage-dir') {
      options.storageDir = argv[index + 1] || options.storageDir;
      index += 1;
    } else if (argument === '--pg-dump') {
      options.pgDump = argv[index + 1] || options.pgDump;
      index += 1;
    } else if (argument === '--pg-restore') {
      options.pgRestore = argv[index + 1] || options.pgRestore;
      index += 1;
    } else if (argument === '--keep-daily') {
      options.keepDaily = Number(argv[index + 1]);
      index += 1;
    } else if (argument === '--keep-weekly') {
      options.keepWeekly = Number(argv[index + 1]);
      index += 1;
    } else if (argument === '--keep-monthly') {
      options.keepMonthly = Number(argv[index + 1]);
      index += 1;
    } else if (argument === '--max-age-hours') {
      options.maxAgeHours = Number(argv[index + 1]);
      index += 1;
    } else if (argument === '--require-off-host') {
      options.requireOffHost = true;
    } else if (argument === '--apply-retention') {
      options.applyRetention = true;
    } else if (argument === '--skip-db') {
      options.skipDb = true;
    } else if (argument === '--skip-storage') {
      options.skipStorage = true;
    } else if (argument === '--skip-restore-check') {
      options.skipRestoreCheck = true;
    } else if (argument === '--skip-pg-restore-list') {
      options.skipPgRestoreList = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  for (const [key, value] of Object.entries({
    keepDaily: options.keepDaily,
    keepWeekly: options.keepWeekly,
    keepMonthly: options.keepMonthly,
    maxAgeHours: options.maxAgeHours,
  })) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${key} must be a positive number.`);
    }
  }

  return options;
}

function summarizeStatus(backup, retention, restoreCheck) {
  if (!backup || backup.status !== 'SUCCESS') return 'FAILED_BACKUP';
  if (restoreCheck && restoreCheck.ready === false) return 'FAILED_RESTORE_CHECK';
  if (retention && retention.summary && retention.summary.prunableBackups > 0 && !retention.deletedBackups?.length) {
    return 'SUCCESS_WITH_PENDING_RETENTION';
  }
  return 'SUCCESS';
}

function runBackupCycle(options, deps = {}) {
  const backupRunner = deps.runBackup || runBackup;
  const retentionRunner = deps.runRetention || runRetention;
  const restoreCheckRunner = deps.runRestoreCheck || runRestoreCheck;

  const backup = backupRunner({
    envFile: options.envFile,
    outputDir: options.outputDir,
    storageDir: options.storageDir,
    pgDump: options.pgDump,
    skipDb: options.skipDb,
    skipStorage: options.skipStorage,
  });

  const retention = retentionRunner({
    outputDir: options.outputDir,
    keepDaily: options.keepDaily,
    keepWeekly: options.keepWeekly,
    keepMonthly: options.keepMonthly,
    apply: options.applyRetention,
  });

  const restoreCheck = options.skipRestoreCheck
    ? {
        ready: true,
        summary: { passed: 1, failed: 0, total: 1 },
        checks: [{ id: 'restore_precheck', status: 'PASS', message: 'Restore precheck skipped.' }],
      }
    : restoreCheckRunner({
        manifest: `${options.outputDir.replace(/[\\/]+$/, '')}/latest-manifest.json`,
        maxAgeHours: options.maxAgeHours,
        requireOffHost: options.requireOffHost,
        pgRestore: options.pgRestore,
        skipPgRestoreList: options.skipPgRestoreList,
      });

  const result = {
    status: summarizeStatus(backup, retention, restoreCheck),
    backup: {
      id: backup.id || null,
      status: backup.status,
      offHostLocation: backup.offHostLocation || null,
      errors: backup.errors || [],
    },
    retention: {
      retainedBackups: retention.summary?.retainedBackups || 0,
      prunableBackups: retention.summary?.prunableBackups || 0,
      deletedBackups: retention.deletedBackups || [],
      latestSuccessfulOffHost: retention.latestSuccessfulOffHost?.id || null,
    },
    restoreCheck: {
      ready: restoreCheck.ready,
      failed: restoreCheck.summary?.failed || 0,
      total: restoreCheck.summary?.total || 0,
    },
  };

  return result;
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  const result = runBackupCycle(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === 'SUCCESS' || result.status === 'SUCCESS_WITH_PENDING_RETENTION' ? 0 : 1;
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`Production backup cycle failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  parseArguments,
  runBackupCycle,
};
