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

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-bundle-validation-'));
  const backupDir = path.join(root, 'backup-test');
  fs.mkdirSync(path.join(backupDir, 'storage'), { recursive: true });
  const storageFile = writeFileRecord(path.join(backupDir, 'storage'), 'document.txt', 'fixture');
  const manifest = {
    id: 'backup-test', status: 'SUCCESS', complete: true, completedAt: new Date().toISOString(),
    database: writeFileRecord(backupDir, 'database.dump', 'dump'), envManagedExternally: true,
    storage: { copied: true, files: [storageFile], manifest: writeFileRecord(backupDir, 'storage-manifest.json', JSON.stringify({ files: [storageFile] })) },
    offHostLocation: 'testremote:backups/backup-test',
  };
  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const receiptPath = path.join(backupDir, 'off-host-receipt.json');
  const receipt = { backupId: manifest.id, status: 'VERIFIED', location: manifest.offHostLocation, verifiedAt: new Date().toISOString(), manifestSha256: sha256(fs.readFileSync(manifestPath)) };
  fs.writeFileSync(receiptPath, JSON.stringify(receipt));
  return { root, backupDir, manifest, manifestPath, receipt, receiptPath };
}

for (const [label, mutate] of [
  ['null manifest', (f) => { f.manifest = null; }],
  ['path traversal ID', (f) => { f.manifest.id = '../outside'; }],
  ['drive-qualified record', (f) => { f.manifest.database.path = 'C:/outside.dump'; }],
  ['missing checksum', (f) => { f.manifest.database.sha256 = null; }],
  ['same-size tampering', (f) => { fs.writeFileSync(path.join(f.backupDir, 'database.dump'), 'evil'); }],
  ['storage record mismatch', (f) => {
    f.manifest.storage.manifest = writeFileRecord(f.backupDir, 'storage-manifest.json', JSON.stringify({ files: [{ ...f.manifest.storage.files[0], sha256: '0'.repeat(64) }] }));
  }],
  ['missing receipt', (f) => { fs.renameSync(f.receiptPath, `${f.receiptPath}.unverified`); }],
  ['failed receipt', (f) => { fs.writeFileSync(f.receiptPath, JSON.stringify({ ...f.receipt, status: 'FAILED' })); }],
  ['receipt wrong bundle', (f) => { fs.writeFileSync(f.receiptPath, JSON.stringify({ ...f.receipt, backupId: 'another-backup' })); }],
  ['symlink storage root', (f) => {
    const moved = path.join(f.root, 'moved-storage');
    fs.renameSync(path.join(f.backupDir, 'storage'), moved);
    fs.symlinkSync(moved, path.join(f.backupDir, 'storage'), 'junction');
  }],
]) {
  test(`rejects ${label}`, () => {
    const f = fixture();
    mutate(f);
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    const result = runRestoreCheck({ manifest: f.manifestPath, maxAgeHours: 24, requireOffHost: true, skipPgRestoreList: true });
    assert.equal(result.ready, false);
    assert.ok(result.checks.some((check) => check.status === 'FAIL'));
  });
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
    complete: true,
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
  const immutable = { ...manifest, offHostLocation: null };
  const manifestContent = JSON.stringify(immutable, null, 2);
  fs.writeFileSync(path.join(backupDir, 'manifest.json'), manifestContent);
  fs.writeFileSync(path.join(backupDir, 'off-host-receipt.json'), JSON.stringify({
    backupId, status: 'VERIFIED', manifestSha256: sha256(manifestContent),
    location: manifest.offHostLocation, verifiedAt: new Date().toISOString(),
  }));
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
    complete: true,
    completedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    database: dump,
    envFile: null,
    storage: { copied: true, files: [], manifest: writeFileRecord(backupDir, 'storage-manifest.json', JSON.stringify({ files: [] })) },
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
    complete: true,
    completedAt: new Date().toISOString(),
    database: writeFileRecord(backupDir, 'database.dump', 'dump'),
    envFile: null,
    envManagedExternally: true,
    storage: { copied: true, files: [], manifest: writeFileRecord(backupDir, 'storage-manifest.json', JSON.stringify({ files: [] })) },
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
