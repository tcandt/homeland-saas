const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { assertBaselineV2Artifact, assertHistoricalManifest, historicalManifest, reviewedMigrations } = require('./ci-bootstrap-database');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('BASELINE-V2 is static, checksum-locked and sourced from all 18 immutable migrations', () => {
  assert.equal(historicalManifest.migrations.length, 18);
  assert.equal(reviewedMigrations.length, 18);
  assertHistoricalManifest();
  assertBaselineV2Artifact();
  assert.match(read('packages/database/prisma/baseline-v2/baseline-v2.sql'), /BASELINE-V2: static canonical schema/);
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
