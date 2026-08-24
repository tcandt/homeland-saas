const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseArguments, runBackup, walkFiles } = require('./production-backup');

test('parses backup CLI arguments', () => {
  assert.deepEqual(parseArguments([
    '--env-file',
    '.env.production',
    '--output-dir',
    '.backups',
    '--storage-dir',
    'storage',
    '--skip-db',
  ]), {
    envFile: '.env.production',
    outputDir: '.backups',
    storageDir: 'storage',
    skipDb: true,
    skipStorage: false,
    pgDump: process.env.PG_DUMP_PATH || 'pg_dump',
  });
});

test('walkFiles skips symlinks and returns files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-backup-walk-'));
  fs.mkdirSync(path.join(root, 'nested'));
  fs.writeFileSync(path.join(root, 'nested', 'a.txt'), 'a');
  fs.writeFileSync(path.join(root, 'b.txt'), 'b');
  const files = walkFiles(root).map((file) => path.relative(root, file).replace(/\\/g, '/'));
  assert.deepEqual(files, ['b.txt', 'nested/a.txt']);
});

test('creates a backup manifest without database when --skip-db is used', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-backup-'));
  const storage = path.join(root, 'storage-source');
  fs.mkdirSync(storage);
  fs.writeFileSync(path.join(storage, 'document.txt'), 'hello');
  const outputDir = path.join(root, 'out');

  const manifest = runBackup({
    envFile: null,
    outputDir,
    storageDir: storage,
    skipDb: true,
    skipStorage: false,
    pgDump: 'pg_dump',
  });

  assert.equal(manifest.status, 'SUCCESS');
  assert.equal(manifest.database, null);
  assert.equal(manifest.storage.copied, true);
  assert.equal(manifest.storage.files.length, 1);
  assert.ok(fs.existsSync(path.join(outputDir, 'latest-manifest.json')));
});
