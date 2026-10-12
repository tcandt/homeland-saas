const test = require('node:test');
const assert = require('node:assert/strict');
const { assertStagingDiagnostics, expectedMigrationCount, unwrapApiPayload } = require('./staging-diagnostics-guard');
const env = { E2E_TARGET_DB_ID: 'homeland_release_test', E2E_EXPECTED_BUILD_SHA: 'a'.repeat(40), CORE1004_SCHEMA_FINGERPRINT: 'b'.repeat(64) };
const good = () => ({ databaseId: env.E2E_TARGET_DB_ID, buildCommit: env.E2E_EXPECTED_BUILD_SHA,
  environment: 'staging', schemaFingerprint: env.CORE1004_SCHEMA_FINGERPRINT, migrationCount: expectedMigrationCount() });

test('validates raw and real enveloped current release diagnostics', () => {
  assert.deepEqual(assertStagingDiagnostics(good(), env), good());
  assert.deepEqual(assertStagingDiagnostics({ success: true, data: good() }, env), good());
  assert.ok(expectedMigrationCount() > 18, 'current release must not be pinned to BASELINE-V2 history');
});

test('fails closed on mismatched environment, database, commit, fingerprint and migration count', () => {
  for (const [field, wrong, message] of [
    ['environment', 'production', /environment/], ['databaseId', 'homeland', /database identity/],
    ['buildCommit', 'c'.repeat(40), /build SHA/], ['schemaFingerprint', 'c'.repeat(64), /fingerprint/],
    ['migrationCount', 18, /migration count/], ['migrationCount', String(expectedMigrationCount()), /migration count/],
  ]) assert.throws(() => assertStagingDiagnostics({ ...good(), [field]: wrong }, env), message);
});

test('requires operator-approved schema identity and immutable commit, never learns them from the response', () => {
  for (const field of Object.keys(env)) {
    assert.throws(() => assertStagingDiagnostics(good(), { ...env, [field]: '' }), /BLOCKED/);
  }
  assert.throws(() => assertStagingDiagnostics(good(), { ...env, CORE1004_SCHEMA_FINGERPRINT: 'unknown' }), /fingerprint/);
  assert.throws(() => assertStagingDiagnostics(good(), { ...env, E2E_EXPECTED_BUILD_SHA: 'latest' }), /immutable/);
});

test('rejects failed, null, array and malformed payloads before checking identities', () => {
  for (const body of [null, [], { success: false, data: good() }, { success: true }, { success: true, data: [] }]) {
    assert.throws(() => assertStagingDiagnostics(body, env), /invalid API/);
  }
  assert.throws(() => unwrapApiPayload('bad', 'test'), /invalid API/);
});
