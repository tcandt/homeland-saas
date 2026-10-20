const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { assertBaselineV2Artifact, assertHistoricalManifest, assertDisposableLocalDatabase, assertNasStagingDatabase, validateMigrationInventory, historicalManifest, supplementalManifest, reviewedMigrations, nasLegacySeedFingerprint, nasReleaseFingerprint, validateNasReleaseHistory, bootstrapNasStaging, assertNasSeedCompleted, assertNasSeedRuntime } = require('./ci-bootstrap-database');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('NAS seed password rejects missing or blank configuration before opening the database', () => {
  const { assertNasSeedPassword } = require('./ci-bootstrap-database');
  for (const value of [undefined, null, '', ' ', '\t\r\n', 123]) {
    assert.throws(() => assertNasSeedPassword({ SEED_DEFAULT_PASSWORD: value }), /blocked before database writes/);
  }
  assert.doesNotThrow(() => assertNasSeedPassword({ SEED_DEFAULT_PASSWORD: 'synthetic-test-only' }));
  const main = read('scripts/ci-bootstrap-database.js').split('async function main()')[1];
  assert.ok(main.indexOf('assertNasSeedPassword()') < main.indexOf('new PrismaClient()'));
  const { spawnSync } = require('node:child_process');
  const env = {
    ...process.env, NAS_STAGING_BOOTSTRAP: 'true', DEPLOY_ENV: 'staging',
    NAS_STAGING_BOOTSTRAP_CONFIRM: 'homeland_nas_staging', CI_DATABASE_BOOTSTRAP_MODE: 'NAS_STAGING',
    DATABASE_URL: 'postgresql://homeland_staging:synthetic@postgres:5432/homeland_staging',
  };
  for (const value of ['', '   ']) {
    const result = spawnSync(process.execPath, ['scripts/ci-bootstrap-database.js'], { cwd: root, env: { ...env, SEED_DEFAULT_PASSWORD: value }, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^NAS staging bootstrap blocked before database writes: SEED_DEFAULT_PASSWORD is required\./);
    assert.equal(result.stdout, '');
  }
});

test('BASELINE-V2 is static, checksum-locked and sourced from all 18 immutable historical migrations', () => {
  assert.equal(historicalManifest.migrations.length, 18);
  assert.equal(reviewedMigrations.length, 18);
  assertHistoricalManifest();
  assertBaselineV2Artifact();
  assert.match(read('packages/database/prisma/baseline-v2/baseline-v2.sql'), /BASELINE-V2: static canonical schema/);
});

test('supplemental prerequisites do not weaken historical checksum/order or unknown backdated migration guards', () => {
  const historical = historicalManifest.migrations;
  const supplemental = supplementalManifest.migrations;
  const records = [...historical, ...supplemental];
  const directories = records.map(({ name }) => name).sort();
  const hash = (name) => records.find((record) => record.name === name).sha256;
  assert.doesNotThrow(() => validateMigrationInventory(historical, supplemental, directories, hash));
  assert.throws(() => validateMigrationInventory(historical, supplemental, directories, () => '0'.repeat(64)), /checksum/);
  assert.throws(() => validateMigrationInventory(historical, supplemental, [...directories, '20260901000000_unreviewed_patch'], hash), /ordering drift/);
  assert.throws(() => validateMigrationInventory(historical, supplemental, directories.filter((name) => name !== supplemental[0].name), hash), /coverage drift/);
  const reordered = [...historical];
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.throws(() => validateMigrationInventory(reordered, supplemental, directories, hash), /ordering drift/);
});

test('local bootstrap cannot target shared, remote or unconfirmed databases', () => {
  const valid = { LOCAL_DATABASE_BOOTSTRAP: 'true', LOCAL_DATABASE_BOOTSTRAP_CONFIRM: 'homeland_release_baseline_test', DATABASE_URL: 'postgresql://homeland_test:test@127.0.0.1:5436/homeland_release_baseline_test' };
  assert.doesNotThrow(() => assertDisposableLocalDatabase(valid));
  for (const DATABASE_URL of ['postgresql://homeland:test@localhost:5430/homeland', 'postgresql://homeland_test:test@nas.example:5436/homeland_release_baseline_test', 'postgresql://homeland_test:test@localhost:5436/homeland']) {
    assert.throws(() => assertDisposableLocalDatabase({ ...valid, DATABASE_URL }), /explicitly confirmed disposable/);
  }
  assert.throws(() => assertDisposableLocalDatabase({ ...valid, LOCAL_DATABASE_BOOTSTRAP_CONFIRM: '' }), /explicitly confirmed disposable/);
});

test('BASELINE-V2 inventory covers full schema and custom DDL dimensions', () => {
  const manifest = JSON.parse(read('packages/database/prisma/baseline-v2/baseline-v2.manifest.json'));
  for (const key of ['tables', 'columns', 'enums', 'constraints', 'indexes', 'functions', 'triggers']) assert.ok(Array.isArray(manifest.inventory[key]) && manifest.inventory[key].length > 0, `missing ${key}`);
  assert.ok(manifest.inventory.indexes.some((index) => index.name === 'Payment_tenantId_provider_providerRef_nonempty_key'));
  assert.ok(manifest.inventory.triggers.some((trigger) => trigger.name === 'DepositLedgerEntry_append_only'));
});

test('NAS bootstrap rejects production, external or unconfirmed database targets', () => {
  const valid = { NAS_STAGING_BOOTSTRAP: 'true', DEPLOY_ENV: 'staging', NAS_STAGING_BOOTSTRAP_CONFIRM: 'homeland_nas_staging', DATABASE_URL: 'postgresql://homeland_staging:test@postgres:5432/homeland_staging?schema=public' };
  assert.doesNotThrow(() => assertNasStagingDatabase(valid));
  for (const overrides of [
    { NAS_STAGING_BOOTSTRAP: 'false' }, { DEPLOY_ENV: 'production' }, { NAS_STAGING_BOOTSTRAP_CONFIRM: '' },
    { DATABASE_URL: 'postgresql://homeland_staging:test@nas.example:5432/homeland_staging' },
    { DATABASE_URL: 'postgresql://homeland_staging:test@postgres:5433/homeland_staging' },
    { DATABASE_URL: 'postgresql://homeland:test@postgres:5432/homeland_staging' },
    { DATABASE_URL: 'postgresql://homeland_staging:test@postgres:5432/homeland' },
    { DATABASE_URL: 'postgresql://homeland_staging:test@postgres:5432/homeland_staging?schema=private' },
    { DATABASE_URL: 'postgresql://homeland_staging:test@postgres:5432/homeland_staging?options=-csearch_path%3Dprivate' },
  ]) assert.throws(() => assertNasStagingDatabase({ ...valid, ...overrides }), /NAS staging bootstrap requires/);
});

test('existing BASELINE-V2 path is audit-only and cannot resolve or apply baseline SQL', () => {
  const script = read('scripts/ci-bootstrap-database.js');
  const existing = script.slice(script.indexOf('async function existingVerifiedBaseline'), script.indexOf('async function main'));
  assert.match(existing, /assertExactlyHistoricalState/);
  assert.match(existing, /assertCanonicalFingerprint/);
  assert.doesNotMatch(existing, /db', 'execute|resolveHistoricalAfterFreshVerification|migrate', 'resolve/);
});

test('NAS release audit rejects partial, failed, duplicated, unknown or changed migration history', () => {
  const expected = Array.from({ length: 37 }, (_, i) => ({ name: `migration_${String(i).padStart(2, '0')}`, sha256: 'a'.repeat(64) }));
  const rows = expected.map(({ name, sha256 }) => ({ migration_name: name, checksum: sha256, finished_at: new Date(), rolled_back_at: null }));
  assert.doesNotThrow(() => validateNasReleaseHistory(rows, expected));
  assert.doesNotThrow(() => validateNasReleaseHistory([...rows, { rolled_back_at: new Date() }], expected));
  for (const altered of [rows.slice(0, 36), rows.slice(0, 35), rows.slice(0, 18), rows.slice(0, 22), [...rows, rows[0]], rows.map((row, i) => i === 0 ? { ...row, checksum: 'b'.repeat(64) } : row), rows.map((row, i) => i === 0 ? { ...row, finished_at: null } : row), rows.map((row, i) => i === 0 ? { ...row, migration_name: 'unknown' } : row)]) {
    assert.throws(() => validateNasReleaseHistory(altered, expected), /drift/);
  }
});

test('NAS first initialization audits before seed and restart never initializes or reseeds', async () => {
  const calls = [];
  const actions = Object.fromEntries(['initialize', 'audit', 'seed', 'markSeedCompleted', 'verifySeedCompleted'].map((name) => [name, async () => { calls.push(name); }]));
  const prisma = { $queryRawUnsafe: async () => [{ count: 0 }] };
  assert.equal(await bootstrapNasStaging(prisma, actions), 'INITIALIZED');
  assert.deepEqual(calls, ['initialize', 'audit', 'seed', 'markSeedCompleted', 'verifySeedCompleted']);
  calls.length = 0;
  prisma.$queryRawUnsafe = async () => [{ count: 75 }];
  assert.equal(await bootstrapNasStaging(prisma, actions), 'VERIFIED_EXISTING');
  assert.deepEqual(calls, ['audit', 'verifySeedCompleted']);
  calls.length = 0;
  actions.audit = async () => { calls.push('audit'); throw new Error('schema drift'); };
  await assert.rejects(bootstrapNasStaging(prisma, actions), /schema drift/);
  assert.deepEqual(calls, ['audit']);
  calls.length = 0;
  prisma.$queryRawUnsafe = async () => [{ count: 0 }];
  await assert.rejects(bootstrapNasStaging(prisma, actions), /schema drift/);
  assert.deepEqual(calls, ['initialize', 'audit']);
});

test('NAS seed runtime is retained after pruning and checked before opening the database', () => {
  const runtime = assertNasSeedRuntime();
  assert.ok(fs.existsSync(runtime.cli));
  assert.equal(runtime.seed, path.join(root, 'packages/database/prisma/seed.ts'));
  for (const missing of ['tsx/cli', 'bcryptjs']) {
    assert.throws(() => assertNasSeedRuntime((name) => {
      if (name === missing) throw new Error('MODULE_NOT_FOUND');
      return require.resolve(name);
    }), /blocked before database writes/);
  }
  assert.throws(() => assertNasSeedRuntime(require.resolve, () => false), /blocked before database writes/);
  const databasePackage = JSON.parse(read('packages/database/package.json'));
  assert.ok(databasePackage.dependencies.tsx);
  assert.ok(databasePackage.dependencies.bcryptjs);
  const script = read('scripts/ci-bootstrap-database.js');
  const main = script.slice(script.indexOf('async function main()'));
  assert.ok(main.indexOf('assertNasSeedRuntime()') < main.indexOf('new PrismaClient()'));
  assert.match(main, /execFileSync\(process.execPath, \[seedRuntime.cli, seedRuntime.seed\]/);
});

test('NAS seed failure cannot write completion marker and a partial seed cannot pass restart', async () => {
  const calls = [];
  const actions = Object.fromEntries(['initialize', 'audit', 'seed', 'markSeedCompleted', 'verifySeedCompleted'].map((name) => [name, async () => { calls.push(name); }]));
  actions.seed = async () => { calls.push('seed'); throw new Error('seed failed'); };
  const prisma = { $queryRawUnsafe: async () => [{ count: 0 }] };
  await assert.rejects(bootstrapNasStaging(prisma, actions), /seed failed/);
  assert.deepEqual(calls, ['initialize', 'audit', 'seed']);
  calls.length = 0;
  prisma.$queryRawUnsafe = async () => [{ count: 75 }];
  actions.verifySeedCompleted = async () => { calls.push('verifySeedCompleted'); throw new Error('seed completion is unverified'); };
  await assert.rejects(bootstrapNasStaging(prisma, actions), /unverified/);
  assert.deepEqual(calls, ['audit', 'verifySeedCompleted']);
});

test('NAS seed completion marker accepts known 35/36 proof only after audited schema/history 37', async () => {
  const marker = {
    tenantId: 'synthetic-tenant', entity: 'NasStagingBootstrap', entityId: 'homeland_staging', action: 'CREATE',
    after: { seedCompleted: true, schemaFingerprint: nasLegacySeedFingerprint },
  };
  const prisma = {
    auditLog: { findUnique: async () => marker },
    tenantOrg: { findUnique: async () => ({ id: 'synthetic-tenant' }) },
  };
  const audited37 = { migrationCount: 37, schemaFingerprint: nasReleaseFingerprint };
  await assertNasSeedCompleted(prisma, audited37);
  prisma.auditLog.findUnique = async () => ({ ...marker, after: { seedCompleted: true, schemaFingerprint: 'df7b33d969caeec88c0288ace847308cb3479635614761b319537656f5d2e587' } });
  await assertNasSeedCompleted(prisma, audited37);
  prisma.auditLog.findUnique = async () => ({ ...marker, after: { seedCompleted: true, schemaFingerprint: nasReleaseFingerprint } });
  await assertNasSeedCompleted(prisma, audited37);
  prisma.auditLog.findUnique = async () => marker;
  for (const altered of [null, { ...marker, tenantId: 'other' }, { ...marker, action: 'UPDATE' }, { ...marker, entity: 'Other' }, { ...marker, entityId: 'production' }, { ...marker, after: {} }, { ...marker, after: { ...marker.after, schemaFingerprint: 'wrong' } }]) {
    prisma.auditLog.findUnique = async () => altered;
    await assert.rejects(assertNasSeedCompleted(prisma, audited37), /seed completion is unverified/);
  }
  await assert.rejects(assertNasSeedCompleted(prisma, { migrationCount: 35, schemaFingerprint: nasLegacySeedFingerprint }), /audited release identity/);
  await assert.rejects(assertNasSeedCompleted(prisma, { migrationCount: 36, schemaFingerprint: 'df7b33d969caeec88c0288ace847308cb3479635614761b319537656f5d2e587' }), /audited release identity/);
});

test('booking cancellation migration is transactional and binds its single item to the canonical service payload', () => {
  const sql = read('packages/database/prisma/migrations/20261017100000_booking_hold_cancel_adjustment_scope/migration.sql');
  assert.match(sql, /^BEGIN;\r?\n/);
  assert.match(sql, /\r?\nCOMMIT;\r?\n?$/);
  assert.match(sql, /NEW\."type" <> 'OTHER'/);
  assert.match(sql, /NEW\."description" IS DISTINCT FROM 'Internal closure of unpaid booking hold balance'/);
  assert.match(sql, /NEW\."servicePeriod" IS DISTINCT FROM COALESCE\(parent_invoice\."period", 'BOOKING_HOLD'\)/);
});
