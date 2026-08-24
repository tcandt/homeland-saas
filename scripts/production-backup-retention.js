#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function parseArguments(argv) {
  const options = {
    outputDir: '.codex-backups/production',
    keepDaily: 7,
    keepWeekly: 4,
    keepMonthly: 12,
    apply: false,
    now: new Date(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--output-dir') {
      options.outputDir = argv[index + 1] || options.outputDir;
      index += 1;
    } else if (argument === '--keep-daily') {
      options.keepDaily = Number(argv[index + 1] || options.keepDaily);
      index += 1;
    } else if (argument === '--keep-weekly') {
      options.keepWeekly = Number(argv[index + 1] || options.keepWeekly);
      index += 1;
    } else if (argument === '--keep-monthly') {
      options.keepMonthly = Number(argv[index + 1] || options.keepMonthly);
      index += 1;
    } else if (argument === '--apply') {
      options.apply = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  for (const field of ['keepDaily', 'keepWeekly', 'keepMonthly']) {
    if (!Number.isInteger(options[field]) || options[field] < 0) {
      throw new Error(`${field} must be a non-negative integer.`);
    }
  }

  return options;
}

function ensureInside(parent, child) {
  const parentResolved = path.resolve(parent);
  const childResolved = path.resolve(child);
  if (childResolved !== parentResolved && !childResolved.startsWith(parentResolved + path.sep)) {
    throw new Error(`Unsafe path outside backup root: ${childResolved}`);
  }
}

function startOfUtcDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function startOfUtcWeek(date) {
  const midnight = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = midnight.getUTCDay() || 7;
  midnight.setUTCDate(midnight.getUTCDate() - (day - 1));
  return midnight.getTime();
}

function startOfUtcMonth(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function readBackupCandidates(outputDir) {
  if (!fs.existsSync(outputDir)) return [];
  const entries = fs.readdirSync(outputDir, { withFileTypes: true });
  const backups = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const backupDir = path.join(outputDir, entry.name);
    const manifestPath = path.join(backupDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const completedAt = new Date(String(manifest.completedAt || manifest.startedAt || ''));
    if (!Number.isFinite(completedAt.getTime())) continue;
    backups.push({
      id: manifest.id || entry.name,
      backupDir,
      manifestPath,
      manifest,
      completedAt,
      status: String(manifest.status || 'UNKNOWN'),
      offHostLocation: manifest.offHostLocation || null,
    });
  }

  return backups.sort((left, right) => right.completedAt.getTime() - left.completedAt.getTime());
}

function classifyRetention(backups, options) {
  const retained = new Map();
  const dailyBuckets = new Set();
  const weeklyBuckets = new Set();
  const monthlyBuckets = new Set();

  for (const backup of backups) {
    const dayBucket = startOfUtcDay(backup.completedAt);
    if (dailyBuckets.size < options.keepDaily && !dailyBuckets.has(dayBucket)) {
      dailyBuckets.add(dayBucket);
      retained.set(backup.id, 'daily');
      continue;
    }

    const weekBucket = startOfUtcWeek(backup.completedAt);
    if (weeklyBuckets.size < options.keepWeekly && !weeklyBuckets.has(weekBucket)) {
      weeklyBuckets.add(weekBucket);
      retained.set(backup.id, 'weekly');
      continue;
    }

    const monthBucket = startOfUtcMonth(backup.completedAt);
    if (monthlyBuckets.size < options.keepMonthly && !monthlyBuckets.has(monthBucket)) {
      monthlyBuckets.add(monthBucket);
      retained.set(backup.id, 'monthly');
      continue;
    }
  }

  const retainedBackups = backups
    .filter((backup) => retained.has(backup.id))
    .map((backup) => ({
      id: backup.id,
      completedAt: backup.completedAt.toISOString(),
      status: backup.status,
      offHostLocation: backup.offHostLocation,
      tier: retained.get(backup.id),
      backupDir: backup.backupDir,
    }));
  const prunableBackups = backups
    .filter((backup) => !retained.has(backup.id))
    .map((backup) => ({
      id: backup.id,
      completedAt: backup.completedAt.toISOString(),
      status: backup.status,
      offHostLocation: backup.offHostLocation,
      backupDir: backup.backupDir,
    }));

  return { retainedBackups, prunableBackups };
}

function pruneBackups(outputDir, prunableBackups, apply) {
  const deleted = [];
  if (!apply) return deleted;

  for (const backup of prunableBackups) {
    const target = path.resolve(backup.backupDir);
    ensureInside(outputDir, target);
    fs.rmSync(target, { recursive: true, force: true });
    deleted.push(backup.id);
  }

  return deleted;
}

function writeRetentionReport(outputDir, report) {
  const reportPath = path.join(outputDir, 'latest-retention-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

function runRetention(options) {
  const outputDir = path.resolve(options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const backups = readBackupCandidates(outputDir);
  const { retainedBackups, prunableBackups } = classifyRetention(backups, options);
  const deletedBackupIds = pruneBackups(outputDir, prunableBackups, options.apply);
  const latestSuccessful = backups.find((backup) => backup.status === 'SUCCESS') || null;
  const latestOffHostSuccessful =
    backups.find((backup) => backup.status === 'SUCCESS' && backup.offHostLocation) || null;

  const report = {
    generatedAt: new Date(options.now).toISOString(),
    outputDir,
    policy: {
      keepDaily: options.keepDaily,
      keepWeekly: options.keepWeekly,
      keepMonthly: options.keepMonthly,
    },
    apply: options.apply,
    summary: {
      totalBackups: backups.length,
      retainedBackups: retainedBackups.length,
      prunableBackups: prunableBackups.length,
      deletedBackups: deletedBackupIds.length,
      latestSuccessfulBackupId: latestSuccessful?.id || null,
      latestSuccessfulOffHostBackupId: latestOffHostSuccessful?.id || null,
      latestSuccessfulOffHostLocation: latestOffHostSuccessful?.offHostLocation || null,
    },
    retainedBackups,
    prunableBackups,
    deletedBackupIds,
  };

  const reportPath = writeRetentionReport(outputDir, report);
  process.stdout.write(`${JSON.stringify({ reportPath, summary: report.summary }, null, 2)}\n`);
  return report;
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  runRetention(options);
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`Production backup retention failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  parseArguments,
  readBackupCandidates,
  classifyRetention,
  runRetention,
};
