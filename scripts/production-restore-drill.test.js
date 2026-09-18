const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  parseArguments,
  parseDatabaseIdentity,
  normalizePostgresCliUrl,
  isHarmlessTransactionTimeoutCompatibilityWarning,
  runRestoreDrill,
  validateRestoreTarget,
} = require('./production-restore-drill');

test('accepts only the single harmless transaction_timeout compatibility warning', () => {
  assert.equal(isHarmlessTransactionTimeoutCompatibilityWarning({
    status: 1,
    stderr: 'ERROR: unrecognized configuration parameter "transaction_timeout"\nwarning: errors ignored on restore: 1',
  }), true);
  assert.equal(isHarmlessTransactionTimeoutCompatibilityWarning({
    status: 1,
    stderr: 'ERROR: unrecognized configuration parameter "transaction_timeout"\nERROR: relation failed\nwarning: errors ignored on restore: 2',
  }), false);
});

test('removes Prisma-only parameters from the pg_restore target URL', () => {
  const normalized = normalizePostgresCliUrl(
    'postgresql://user:pass@127.0.0.1:5432/homeland_restore_drill?schema=public&sslmode=require',
  );
  const parsed = new URL(normalized);
  assert.equal(parsed.searchParams.has('schema'), false);
  assert.equal(parsed.searchParams.get('sslmode'), 'require');
});

function writeManifest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-restore-drill-'));
  const backupId = 'backup-drill-1';
  const backupDir = path.join(root, backupId);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'database.dump'), 'dump');
  const manifest = {
    id: backupId,
    status: 'SUCCESS',
    completedAt: new Date().toISOString(),
    database: {
      path: 'database.dump',
      size: 4,
      sha256: null,
    },
    envFile: null,
    storage: { copied: false, files: [] },
  };
  const manifestPath = path.join(root, 'latest-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return { manifestPath, backupDir };
}

test('parses restore drill CLI arguments', () => {
  assert.deepEqual(parseArguments([
    '--manifest',
    '.backups/latest-manifest.json',
    '--max-age-hours',
    '6',
    '--require-off-host',
    '--pg-restore',
    'pg_restore_custom',
    '--prisma',
    'prisma_custom',
    '--schema',
    'schema.prisma',
    '--database-url',
    'postgresql://user:pass@127.0.0.1:5432/homeland_restore_drill',
    '--confirm-target-db',
    'homeland_restore_drill',
    '--skip-migrate-status',
    '--json',
  ]), {
    manifest: '.backups/latest-manifest.json',
    maxAgeHours: 6,
    requireOffHost: true,
    pgRestore: 'pg_restore_custom',
    prisma: 'prisma_custom',
    schema: 'schema.prisma',
    databaseUrl: 'postgresql://user:pass@127.0.0.1:5432/homeland_restore_drill',
    confirmTargetDb: 'homeland_restore_drill',
    skipMigrateStatus: true,
    json: true,
  });
});

test('rejects production-like restore targets', () => {
  const result = validateRestoreTarget('postgresql://user:pass@postgres:5432/homeland', 'homeland');
  assert.equal(result.status, 'FAIL');
  assert.match(result.message, /production-like/);
});

test('parses and masks restore drill database identity', () => {
  const identity = parseDatabaseIdentity('postgresql://user:pass@127.0.0.1:5432/homeland_restore_drill');
  assert.equal(identity.databaseName, 'homeland_restore_drill');
  assert.equal(identity.maskedUrl, 'postgresql://***@127.0.0.1:5432/homeland_restore_drill');
});

test('runs restore drill against confirmed isolated database', () => {
  const { manifestPath, backupDir } = writeManifest();
  const calls = [];
  const result = runRestoreDrill({
    manifest: manifestPath,
    maxAgeHours: 24,
    requireOffHost: false,
    pgRestore: 'pg_restore',
    prisma: 'prisma',
    schema: 'packages/database/prisma/schema.prisma',
    databaseUrl: 'postgresql://user:pass@127.0.0.1:5432/homeland_restore_drill',
    confirmTargetDb: 'homeland_restore_drill',
    skipMigrateStatus: true,
    json: false,
  }, {
    runRestoreCheck: () => ({
      ready: true,
      backupId: 'backup-drill-1',
      backupDir,
      checks: [{ id: 'restore_check', status: 'PASS', message: 'precheck pass' }],
    }),
    spawnSync: (command, args) => {
      calls.push({ command, args });
      return { status: 0, stdout: '', stderr: '' };
    },
  });

  assert.equal(result.ready, true);
  assert.equal(result.restored, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'pg_restore');
  assert.ok(calls[0].args.includes('--clean'));
  assert.ok(calls[0].args.includes(path.join(backupDir, 'database.dump')));
});
