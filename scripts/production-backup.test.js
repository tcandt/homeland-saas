const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runRestoreCheck } = require('./production-restore-check');
const { readBackupCandidates } = require('./production-backup-retention');

const { normalizePostgresCliUrl, parseArguments, runBackup, walkFiles } = require('./production-backup');

test('removes Prisma-only query parameters before invoking PostgreSQL CLI tools', () => {
  const normalized = normalizePostgresCliUrl(
    'postgresql://user:pass@127.0.0.1:5432/homeland?schema=public&connection_limit=10&sslmode=require',
  );
  const parsed = new URL(normalized);
  assert.equal(parsed.searchParams.has('schema'), false);
  assert.equal(parsed.searchParams.has('connection_limit'), false);
  assert.equal(parsed.searchParams.get('sslmode'), 'require');
});

for (const failingStage of [null, 'copy', 'payload-check', 'copyto', 'receipt-check', 'dump']) {
  test(`off-host backup ${failingStage ? `fails closed at ${failingStage}` : 'verifies immutable bundle and remote receipt'}`, (t) => {
    const previous = { exitCode: process.exitCode, database: process.env.DATABASE_URL, destination: process.env.BACKUP_RCLONE_DEST };
    t.after(() => {
      process.exitCode = previous.exitCode;
      if (previous.database === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous.database;
      if (previous.destination === undefined) delete process.env.BACKUP_RCLONE_DEST; else process.env.BACKUP_RCLONE_DEST = previous.destination;
    });
    process.env.DATABASE_URL = 'postgresql://user:test-secret@127.0.0.1:5432/backup_test';
    process.env.BACKUP_RCLONE_DEST = 'testremote:backups';
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-offhost-test-'));
    const storage = path.join(root, 'source');
    fs.mkdirSync(storage);
    fs.writeFileSync(path.join(storage, 'document.txt'), 'fixture');
    let checkCount = 0;
    const calls = [];
    const result = runBackup({ envFile: null, envManagedExternally: true, outputDir: path.join(root, 'out'), storageDir: storage, pgDump: 'pg_dump' }, {
      spawnSync: (command, args, options) => {
        calls.push({ command, args });
        const stage = command === 'pg_dump' ? 'dump' : args[0] === 'check' ? (++checkCount === 1 ? 'payload-check' : 'receipt-check') : args[0];
        if (command === 'pg_dump') {
          assert.equal(options.env.PGPASSWORD, 'test-secret');
          assert.equal(options.env.DATABASE_URL, undefined);
          assert.ok(!JSON.stringify(args).includes('test-secret'));
          if (stage !== failingStage) fs.writeFileSync(args.at(-1), 'dump');
        }
        return { status: stage === failingStage ? 1 : 0, stderr: 'credential=test-secret' };
      },
    });
    assert.equal(result.status, failingStage ? 'FAILED' : 'SUCCESS');
    const bundle = path.join(root, 'out', result.id);
    const latest = JSON.parse(fs.readFileSync(path.join(root, 'out', 'latest-manifest.json'), 'utf8'));
    assert.equal(latest.status, result.status);
    const snapshot = JSON.parse(fs.readFileSync(path.join(bundle, 'manifest.json'), 'utf8'));
    assert.equal(snapshot.status, result.status);
    assert.equal(snapshot.complete, !failingStage);
    assert.ok(!JSON.stringify(result).includes('test-secret'));
    const verified = runRestoreCheck({ manifest: path.join(bundle, 'manifest.json'), maxAgeHours: 24, requireOffHost: true, skipPgRestoreList: true });
    assert.equal(verified.ready, !failingStage);
    const candidates = readBackupCandidates(path.join(root, 'out'));
    assert.equal(candidates[0].status, result.status);
    assert.equal(Boolean(candidates[0].offHostLocation), !failingStage);
    if (!failingStage) {
      assert.deepEqual(calls.map((call) => call.command === 'pg_dump' ? 'dump' : call.args[0]), ['dump', 'copy', 'check', 'copyto', 'check']);
      const original = fs.readFileSync(path.join(bundle, 'manifest.json'), 'utf8');
      const receiptPath = path.join(bundle, 'off-host-receipt.json');
      const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
      receipt.manifestSha256 = '0'.repeat(64);
      fs.writeFileSync(receiptPath, JSON.stringify(receipt));
      assert.equal(runRestoreCheck({ manifest: path.join(bundle, 'manifest.json'), maxAgeHours: 24, requireOffHost: true, skipPgRestoreList: true }).ready, false);
      assert.equal(fs.readFileSync(path.join(bundle, 'manifest.json'), 'utf8'), original);
    }
  });
}

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
    envManagedExternally: false,
    outputDir: '.backups',
    storageDir: 'storage',
    skipDb: true,
    skipStorage: false,
    pgDump: process.env.PG_DUMP_PATH || 'pg_dump',
  });
});

test('requires an explicit and exclusive externally-managed env declaration', () => {
  assert.equal(parseArguments(['--env-managed-externally']).envManagedExternally, true);
  assert.throws(
    () => parseArguments(['--env-file', '.env.production', '--env-managed-externally']),
    /cannot be used together/,
  );
});

test('walkFiles skips symlinks and returns files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-backup-walk-'));
  fs.mkdirSync(path.join(root, 'nested'));
  fs.writeFileSync(path.join(root, 'nested', 'a.txt'), 'a');
  fs.writeFileSync(path.join(root, 'b.txt'), 'b');
  const files = walkFiles(root).map((file) => path.relative(root, file).replace(/\\/g, '/'));
  assert.deepEqual(files, ['b.txt', 'nested/a.txt']);
});

test('creates a backup manifest without database when --skip-db is used', (t) => {
  const previousExitCode = process.exitCode;
  t.after(() => { process.exitCode = previousExitCode; });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-backup-'));
  const storage = path.join(root, 'storage-source');
  fs.mkdirSync(storage);
  fs.writeFileSync(path.join(storage, 'document.txt'), 'hello');
  const outputDir = path.join(root, 'out');

  const manifest = runBackup({
    envFile: null,
    envManagedExternally: false,
    outputDir,
    storageDir: storage,
    skipDb: true,
    skipStorage: false,
    pgDump: 'pg_dump',
  });

  assert.equal(manifest.status, 'INCOMPLETE');
  assert.equal(process.exitCode, 1);
  assert.equal(manifest.complete, false);
  assert.equal(manifest.database, null);
  assert.equal(manifest.storage.copied, true);
  assert.equal(manifest.storage.files.length, 1);
  assert.ok(fs.existsSync(path.join(outputDir, 'latest-manifest.json')));
});
