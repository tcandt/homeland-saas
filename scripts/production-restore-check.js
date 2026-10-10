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

function isSafeRelativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0')) return false;
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || value.includes(':')) return false;
  const parts = value.split('/');
  return parts.every((part) => part && part !== '.' && part !== '..');
}

function safeRecordPath(baseDir, record) {
  if (!record || typeof record !== 'object' || !isSafeRelativePath(record.path)) return null;
  if (!Number.isSafeInteger(record.size) || record.size < 0) return null;
  if (typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(record.sha256)) return null;
  const resolved = path.resolve(baseDir, record.path);
  const root = path.resolve(baseDir);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

function hasSymlinkInPath(root, target) {
  if (fs.lstatSync(root).isSymbolicLink()) return true;
  const relative = path.relative(root, target);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) return true;
  }
  return false;
}

function pass(id, message) {
  return { id, status: 'PASS', message };
}

function fail(id, message) {
  return { id, status: 'FAIL', message };
}

function inferBackupDir(manifestPath, manifest) {
  const manifestDir = path.dirname(manifestPath);
  if (path.basename(manifestPath) === 'latest-manifest.json' && typeof manifest.id === 'string' && isSafeRelativePath(manifest.id)) {
    return path.join(manifestDir, manifest.id);
  }
  return manifestDir;
}

function checkFileRecord(backupDir, label, record) {
  const filePath = safeRecordPath(backupDir, record);
  if (!filePath) return fail(label, `${label} record is malformed or unsafe.`);
  if (!fs.existsSync(filePath)) return fail(label, `${label} file is missing.`);
  let stat;
  try {
    stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink() || hasSymlinkInPath(path.resolve(backupDir), filePath) || !stat.isFile()) {
      return fail(label, `${label} file is a symlink or not a regular file.`);
    }
  } catch {
    return fail(label, `${label} file cannot be inspected.`);
  }
  if (record.size !== stat.size) {
    return fail(label, `${label} size does not match the manifest.`);
  }
  if (sha256File(filePath) !== record.sha256) {
    return fail(label, `${label} SHA256 does not match the manifest.`);
  }
  return pass(label, `${label} exists and matches checksum.`);
}

function checkEnvironmentRecord(backupDir, manifest) {
  if (manifest.envFile) {
    return checkFileRecord(backupDir, 'env_file', manifest.envFile);
  }
  if (manifest.envManagedExternally === true) {
    return pass(
      'env_file',
      'Environment is explicitly managed by the deployment host and is not part of this backup bundle.',
    );
  }
  return fail('env_file', 'env_file is missing from the backup manifest.');
}

function runPgRestoreList(options, backupDir, databaseRecord) {
  if (options.skipPgRestoreList || !databaseRecord) {
    return pass('pg_restore_list', 'pg_restore --list check skipped.');
  }

  const dumpPath = safeRecordPath(backupDir, databaseRecord);
  if (!dumpPath) return fail('pg_restore_list', 'Database dump record is malformed or unsafe.');
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
    return [fail('storage_backup', 'Storage backup is incomplete (skipped or source unavailable).')];
  }

  const checks = [checkFileRecord(backupDir, 'storage_manifest', storage.manifest)];
  const storageRoot = path.resolve(backupDir, 'storage');
  if (!Array.isArray(storage.files)) return [...checks, fail('storage_records', 'Storage records are malformed.')];
  for (const [index, record] of storage.files.entries()) {
    checks.push(checkFileRecord(storageRoot, `storage_file_${index + 1}`, record));
  }
  try {
    const storageManifestPath = safeRecordPath(backupDir, storage.manifest);
    const parsed = JSON.parse(fs.readFileSync(storageManifestPath, 'utf8'));
    if (!parsed || !Array.isArray(parsed.files) || parsed.files.length !== storage.files.length) {
      checks.push(fail('storage_manifest_records', 'Storage manifest records are malformed.'));
    } else {
      parsed.files.forEach((record, index) => {
        const expected = storage.files[index];
        if (!safeRecordPath(storageRoot, record) || record.path !== expected.path || record.size !== expected.size || record.sha256 !== expected.sha256) {
          checks.push(fail(`storage_manifest_file_${index + 1}`, 'Storage manifest records do not match the backup manifest.'));
        }
      });
      if (new Set(storage.files.map((record) => record.path)).size !== storage.files.length) {
        checks.push(fail('storage_records', 'Storage manifest contains duplicate paths.'));
      }
    }
  } catch {
    checks.push(fail('storage_manifest_records', 'Storage manifest cannot be read safely.'));
  }
  return checks;
}

function checkOffHostReceipt(backupDir, manifest, required) {
  if (!required) return pass('off_host_copy', 'Off-host backup is not required by this check.');
  try {
    const manifestPath = path.join(backupDir, 'manifest.json');
    const receiptPath = path.join(backupDir, 'off-host-receipt.json');
    for (const filePath of [manifestPath, receiptPath]) {
      if (hasSymlinkInPath(path.resolve(backupDir), filePath) || !fs.lstatSync(filePath).isFile()) throw new Error();
    }
    const immutable = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const { offHostLocation: ignoredLocation, ...expected } = manifest;
    const { offHostLocation: ignoredImmutableLocation, ...snapshot } = immutable;
    if (JSON.stringify(expected) !== JSON.stringify(snapshot)) throw new Error();
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    const verifiedAt = Date.parse(receipt.verifiedAt);
    if (receipt.backupId !== manifest.id || receipt.status !== 'VERIFIED'
      || receipt.manifestSha256 !== sha256File(manifestPath)
      || typeof receipt.location !== 'string' || !receipt.location.trim()
      || (manifest.offHostLocation && manifest.offHostLocation !== receipt.location)
      || !Number.isFinite(verifiedAt) || verifiedAt < Date.parse(manifest.completedAt) || verifiedAt > Date.now()) throw new Error();
    return { ...pass('off_host_copy', 'Verified off-host transfer receipt matches the immutable backup manifest.'), location: receipt.location };
  } catch {
    return fail('off_host_copy', 'Valid verified off-host transfer receipt is required.');
  }
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

  let manifest;
  try {
    if (fs.lstatSync(manifestPath).isSymbolicLink() || !fs.lstatSync(manifestPath).isFile()) throw new Error();
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error();
    if (!isSafeRelativePath(manifest.id) || manifest.id.includes('/')) throw new Error();
  } catch {
    return { ready: false, summary: { passed: 0, failed: 1, total: 1 }, checks: [fail('manifest', 'Backup manifest is malformed.')] };
  }
  const backupDir = inferBackupDir(manifestPath, manifest);
  const completedAt = Date.parse(String(manifest.completedAt || ''));
  const ageSeconds = Number.isFinite(completedAt) ? (Date.now() - completedAt) / 1000 : Infinity;
  const maxAgeSeconds = options.maxAgeHours * 3600;

  checks.push(
    typeof manifest.id === 'string' && isSafeRelativePath(manifest.id) && !manifest.id.includes('/') && manifest.id === path.basename(backupDir)
      ? pass('manifest_id', 'Backup ID is well-formed.')
      : fail('manifest_id', 'Backup manifest ID is malformed or does not match its bundle directory.'),
  );
  checks.push(
    manifest.status === 'SUCCESS' && manifest.complete === true
      ? pass('manifest_status', 'Latest backup manifest reports SUCCESS.')
      : fail('manifest_status', 'Latest backup manifest is incomplete or not SUCCESS.'),
  );
  checks.push(
    Number.isFinite(ageSeconds) && ageSeconds >= 0 && ageSeconds <= maxAgeSeconds
      ? pass('backup_age', `Backup age is within ${options.maxAgeHours}h.`)
      : fail('backup_age', `Backup is missing a valid completedAt or is older than ${options.maxAgeHours}h.`),
  );
  checks.push(checkFileRecord(backupDir, 'database_dump', manifest.database));
  checks.push(checkEnvironmentRecord(backupDir, manifest));
  checks.push(...checkStorageRecords(backupDir, manifest.storage));
  checks.push(checkOffHostReceipt(backupDir, manifest, options.requireOffHost));
  if (checks.some((check) => check.status === 'FAIL')) {
    checks.push(fail('pg_restore_list', 'Dump inspection was not executed because bundle validation failed.'));
  } else {
    checks.push(runPgRestoreList(options, backupDir, manifest.database));
  }

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
    process.stderr.write('Production restore check failed.\n');
    process.exitCode = 1;
  }
}

module.exports = {
  checkOffHostReceipt,
  formatHumanReport,
  parseArguments,
  runRestoreCheck,
};
