const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseArguments, runRestoreCheck } = require('./production-restore-check');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function writeFileRecord(baseDir, relativePath, content) {
  const filePath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return {
    path: relativePath.replace(/\\/g, '/'),
    size: Buffer.byteLength(content),
    sha256: sha256(content),
  };
}

test('parses restore check CLI arguments', () => {
  assert.deepEqual(parseArguments([
    '--manifest',
    '.backups/latest-manifest.json',
    '--max-age-hours',
    '12',
    '--require-off-host',
    '--pg-restore',
    'pg_restore_custom',
    '--skip-pg-restore-list',
    '--json',
  ]), {
    manifest: '.backups/latest-manifest.json',
    maxAgeHours: 12,
    requireOffHost: true,
    pgRestore: 'pg_restore_custom',
    skipPgRestoreList: true,
    json: true,
  });
});

test('passes a fresh backup manifest with matching checksums', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-restore-check-'));
  const backupId = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(root, backupId);
  fs.mkdirSync(path.join(backupDir, 'storage'), { recursive: true });

  const storageFile = writeFileRecord(path.join(backupDir, 'storage'), 'contracts/a.txt', 'contract');
  const storageManifest = writeFileRecord(backupDir, 'storage-manifest.json', JSON.stringify({ files: [storageFile] }));
  const manifest = {
    id: backupId,
    status: 'SUCCESS',
    completedAt: new Date().toISOString(),
    database: writeFileRecord(backupDir, 'database.dump', 'dump'),
    envFile: writeFileRecord(backupDir, '.env', 'NODE_ENV=production\n'),
    storage: {
      copied: true,
      files: [storageFile],
      manifest: storageManifest,
    },
    offHostLocation: 'r2:homeland-production/backup',
  };
  const latest = path.join(root, 'latest-manifest.json');
  fs.writeFileSync(latest, JSON.stringify(manifest, null, 2));

  const result = runRestoreCheck({
    manifest: latest,
    maxAgeHours: 24,
    requireOffHost: true,
    pgRestore: 'pg_restore',
    skipPgRestoreList: true,
    json: false,
  });

  assert.equal(result.ready, true);
  assert.equal(result.summary.failed, 0);
});

test('fails stale or tampered backups', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-restore-check-bad-'));
  const backupId = 'backup-1';
  const backupDir = path.join(root, backupId);
  fs.mkdirSync(backupDir, { recursive: true });

  const dump = writeFileRecord(backupDir, 'database.dump', 'dump');
  fs.writeFileSync(path.join(backupDir, 'database.dump'), 'tampered');
  const manifest = {
    id: backupId,
    status: 'SUCCESS',
    completedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    database: dump,
    envFile: null,
    storage: { copied: false, files: [] },
    offHostLocation: null,
  };
  const latest = path.join(root, 'latest-manifest.json');
  fs.writeFileSync(latest, JSON.stringify(manifest, null, 2));

  const result = runRestoreCheck({
    manifest: latest,
    maxAgeHours: 24,
    requireOffHost: true,
    pgRestore: 'pg_restore',
    skipPgRestoreList: true,
    json: false,
  });

  assert.equal(result.ready, false);
  assert.ok(result.checks.some((check) => check.id === 'backup_age' && check.status === 'FAIL'));
  assert.ok(result.checks.some((check) => check.id === 'database_dump' && check.status === 'FAIL'));
  assert.ok(result.checks.some((check) => check.id === 'env_file' && check.status === 'FAIL'));
  assert.ok(result.checks.some((check) => check.id === 'off_host_copy' && check.status === 'FAIL'));
});

test('accepts a missing env file only when the manifest marks it as host-managed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-restore-check-host-env-'));
  const backupId = 'backup-host-env';
  const backupDir = path.join(root, backupId);
  fs.mkdirSync(backupDir, { recursive: true });

  const manifest = {
    id: backupId,
    status: 'SUCCESS',
    completedAt: new Date().toISOString(),
    database: writeFileRecord(backupDir, 'database.dump', 'dump'),
    envFile: null,
    envManagedExternally: true,
    storage: { copied: false, files: [] },
    offHostLocation: null,
  };
  const latest = path.join(root, 'latest-manifest.json');
  fs.writeFileSync(latest, JSON.stringify(manifest, null, 2));

  const result = runRestoreCheck({
    manifest: latest,
    maxAgeHours: 24,
    requireOffHost: false,
    pgRestore: 'pg_restore',
    skipPgRestoreList: true,
    json: false,
  });

  assert.equal(result.ready, true);
  assert.ok(result.checks.some((check) => check.id === 'env_file' && check.status === 'PASS'));
});
