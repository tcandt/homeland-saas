#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArguments(argv) {
  const options = {
    manifest: '.codex-backups/production/latest-manifest.json',
    maxAgeHours: 24,
    requireOffHost: false,
    pgRestore: process.env.PG_RESTORE_PATH || 'pg_restore',
    skipPgRestoreList: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--manifest') {
      options.manifest = argv[index + 1] || options.manifest;
      index += 1;
    } else if (argument === '--max-age-hours') {
      options.maxAgeHours = Number(argv[index + 1]);
      index += 1;
    } else if (argument === '--require-off-host') {
      options.requireOffHost = true;
    } else if (argument === '--pg-restore') {
      options.pgRestore = argv[index + 1] || options.pgRestore;
      index += 1;
    } else if (argument === '--skip-pg-restore-list') {
      options.skipPgRestoreList = true;
    } else if (argument === '--json') {
      options.json = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!Number.isFinite(options.maxAgeHours) || options.maxAgeHours <= 0) {
    throw new Error('--max-age-hours must be a positive number.');
  }

  return options;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function pass(id, message) {
  return { id, status: 'PASS', message };
}

function fail(id, message) {
  return { id, status: 'FAIL', message };
}

function inferBackupDir(manifestPath, manifest) {
  const manifestDir = path.dirname(manifestPath);
  if (path.basename(manifestPath) === 'latest-manifest.json' && manifest.id) {
    return path.join(manifestDir, manifest.id);
  }
  return manifestDir;
}

function checkFileRecord(backupDir, label, record) {
  if (!record) return fail(label, `${label} is missing from the backup manifest.`);
  const filePath = path.resolve(backupDir, record.path || '');
  const backupRoot = path.resolve(backupDir);
  if (!filePath.startsWith(backupRoot + path.sep) && filePath !== backupRoot) {
    return fail(label, `${label} path points outside the backup directory.`);
  }
  if (!fs.existsSync(filePath)) return fail(label, `${label} file is missing.`);
  const stat = fs.statSync(filePath);
  if (Number(record.size) !== stat.size) {
    return fail(label, `${label} size does not match the manifest.`);
  }
  if (record.sha256 && sha256File(filePath) !== record.sha256) {
    return fail(label, `${label} SHA256 does not match the manifest.`);
  }
  return pass(label, `${label} exists and matches checksum.`);
}

function runPgRestoreList(options, backupDir, databaseRecord) {
  if (options.skipPgRestoreList || !databaseRecord) {
    return pass('pg_restore_list', 'pg_restore --list check skipped.');
  }

  const dumpPath = path.resolve(backupDir, databaseRecord.path || '');
  const result = spawnSync(options.pgRestore, ['--list', dumpPath], {
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return fail('pg_restore_list', 'pg_restore --list failed; dump must be inspected before release.');
  }

  return pass('pg_restore_list', 'pg_restore --list can read the database dump.');
}

function checkStorageRecords(backupDir, storage) {
  if (!storage || storage.copied === false) {
    return [pass('storage_backup', 'Storage backup was skipped or source storage did not exist.')];
  }

  const checks = [checkFileRecord(backupDir, 'storage_manifest', storage.manifest)];
  const storageRoot = path.resolve(backupDir, 'storage');
  for (const [index, record] of (storage.files || []).entries()) {
    checks.push(checkFileRecord(storageRoot, `storage_file_${index + 1}`, record));
  }
  return checks;
}

function runRestoreCheck(options) {
  const manifestPath = path.resolve(options.manifest);
  const checks = [];

  if (!fs.existsSync(manifestPath)) {
    return {
      ready: false,
      summary: { passed: 0, failed: 1, total: 1 },
      checks: [fail('manifest', 'Backup manifest file does not exist.')],
    };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const backupDir = inferBackupDir(manifestPath, manifest);
  const completedAt = Date.parse(String(manifest.completedAt || ''));
  const ageSeconds = Number.isFinite(completedAt) ? (Date.now() - completedAt) / 1000 : Infinity;
  const maxAgeSeconds = options.maxAgeHours * 3600;

  checks.push(
    manifest.status === 'SUCCESS'
      ? pass('manifest_status', 'Latest backup manifest reports SUCCESS.')
      : fail('manifest_status', 'Latest backup manifest is not SUCCESS.'),
  );
  checks.push(
    Number.isFinite(ageSeconds) && ageSeconds >= 0 && ageSeconds <= maxAgeSeconds
      ? pass('backup_age', `Backup age is within ${options.maxAgeHours}h.`)
      : fail('backup_age', `Backup is missing a valid completedAt or is older than ${options.maxAgeHours}h.`),
  );
  checks.push(checkFileRecord(backupDir, 'database_dump', manifest.database));
  checks.push(checkFileRecord(backupDir, 'env_file', manifest.envFile));
  checks.push(...checkStorageRecords(backupDir, manifest.storage));
  checks.push(
    !options.requireOffHost || manifest.offHostLocation
      ? pass('off_host_copy', 'Off-host backup requirement is satisfied or not required.')
      : fail('off_host_copy', 'Off-host backup location is required but missing.'),
  );
  checks.push(runPgRestoreList(options, backupDir, manifest.database));

  const failed = checks.filter((check) => check.status === 'FAIL').length;
  return {
    ready: failed === 0,
    backupId: manifest.id || null,
    backupDir,
    summary: { passed: checks.length - failed, failed, total: checks.length },
    checks,
  };
}

function formatHumanReport(result) {
  const lines = ['HomeLand production backup restore check', ''];
  if (result.backupId) lines.push(`Backup ID: ${result.backupId}`);
  if (result.backupDir) lines.push(`Backup dir: ${result.backupDir}`);
  if (result.backupId || result.backupDir) lines.push('');
  for (const check of result.checks) {
    lines.push(`[${check.status}] ${check.id}: ${check.message}`);
  }
  lines.push('', `Restore precheck: ${result.ready ? 'PASS' : 'FAIL'} (${result.summary.passed}/${result.summary.total})`);
  return lines.join('\n');
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  const result = runRestoreCheck(options);
  process.stdout.write(`${options.json ? JSON.stringify(result, null, 2) : formatHumanReport(result)}\n`);
  process.exitCode = result.ready ? 0 : 1;
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`Production restore check failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  formatHumanReport,
  parseArguments,
  runRestoreCheck,
};
