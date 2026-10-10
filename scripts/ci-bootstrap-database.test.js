const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { assertBaselineV2Artifact, assertHistoricalManifest, assertDisposableLocalDatabase, validateMigrationInventory, historicalManifest, supplementalManifest, reviewedMigrations } = require('./ci-bootstrap-database');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

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

test('existing BASELINE-V2 path is audit-only and cannot resolve or apply baseline SQL', () => {
  const script = read('scripts/ci-bootstrap-database.js');
  const existing = script.slice(script.indexOf('async function existingVerifiedBaseline'), script.indexOf('async function main'));
  assert.match(existing, /assertExactlyHistoricalState/);
  assert.match(existing, /assertCanonicalFingerprint/);
  assert.doesNotMatch(existing, /db', 'execute|resolveHistoricalAfterFreshVerification|migrate', 'resolve/);
});
