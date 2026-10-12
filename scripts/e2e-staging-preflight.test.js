const test = require('node:test');
const assert = require('node:assert/strict');
const { assertStaticGuards, preflight } = require('./e2e-staging-preflight');
const { expectedMigrationCount } = require('./staging-diagnostics-guard');

const sha = '7bed941e12c65d9bfd586919bfe8d89b84cecda2';
const good = {
  E2E_ENVIRONMENT: 'staging', E2E_WEB_BASE_URL: 'https://staging-web.example.test', E2E_API_BASE_URL: 'https://staging-api.example.test',
  E2E_DATABASE_URL: 'postgresql://test:masked@db.example.test:5432/homeland_e2e_test', E2E_TARGET_DB_ID: 'homeland_e2e_test',
  E2E_ADMIN_USERNAME: 'admin', E2E_ADMIN_PASSWORD: 'masked', E2E_MANAGER_USERNAME: 'manager', E2E_MANAGER_PASSWORD: 'masked',
  E2E_OWNER_A_USERNAME: 'owner-a', E2E_OWNER_A_PASSWORD: 'masked', E2E_OWNER_B_USERNAME: 'owner-b', E2E_OWNER_B_PASSWORD: 'masked',
  E2E_RUN_ID: 'core1004-20260926-2020', E2E_EXPECTED_BUILD_SHA: sha, E2E_INTERNAL_TOKEN: 'masked',
  E2E_DISPOSABLE_DATABASE: 'true', RUN_DESTRUCTIVE_E2E: 'true', E2E_STAGING_ORIGINS: 'https://staging-web.example.test,https://staging-api.example.test',
  CORE1004_SCHEMA_FINGERPRINT: 'b'.repeat(64),
};
const diagnostics = () => ({ databaseId: good.E2E_TARGET_DB_ID, environment: 'staging', buildCommit: sha,
  schemaFingerprint: good.CORE1004_SCHEMA_FINGERPRINT, migrationCount: expectedMigrationCount() });

test('staging preflight refuses incomplete, mutable, or non-disposable configuration', () => {
  assert.throws(() => assertStaticGuards({ ...good, E2E_RUN_ID: '' }), /E2E_RUN_ID/);
  assert.throws(() => assertStaticGuards({ ...good, E2E_EXPECTED_BUILD_SHA: sha.slice(0, 7) }), /immutable Git SHA/);
  assert.throws(() => assertStaticGuards({ ...good, E2E_ENVIRONMENT: 'production' }), /must be staging/);
  assert.throws(() => assertStaticGuards({ ...good, CORE1004_SCHEMA_FINGERPRINT: 'unknown' }), /schema fingerprint/);
  assert.throws(() => assertStaticGuards({ ...good, E2E_DISPOSABLE_DATABASE: 'false' }), /DISPOSABLE/);
  assert.throws(() => assertStaticGuards({ ...good, E2E_DATABASE_URL: 'postgresql://test:masked@db.example.test:5432/another_db' }), /disagree/);
  assert.throws(() => assertStaticGuards({ ...good, E2E_WEB_BASE_URL: 'http://staging-web.example.test' }), /HTTPS/);
  assert.throws(() => assertStaticGuards({ ...good, E2E_API_BASE_URL: 'https://evil.example.test' }), /approved staging origin/);
});

test('staging preflight verifies health, immutable build identity, and target database identity', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith('/build-info')) return { ok: true, status: 200, json: async () => ({ commit: sha }) };
    if (url.endsWith('/staging-diagnostics')) return { ok: true, status: 200, json: async () => diagnostics() };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const result = await preflight(good, fetchImpl);
  assert.deepEqual(result, { status: 'READY', runId: good.E2E_RUN_ID, databaseId: good.E2E_TARGET_DB_ID, buildSha: sha });
  assert.equal(calls.length, 4);
});

test('staging preflight fails closed for an unexpected build or database', async () => {
  const wrongBuild = async (url) => ({ ok: true, status: 200, json: async () => url.endsWith('/build-info') ? { commit: 'a'.repeat(40) } : {} });
  await assert.rejects(() => preflight(good, wrongBuild), /build SHA mismatch/);
  const wrongDatabase = async (url) => ({ ok: true, status: 200, json: async () => url.endsWith('/build-info') ? { commit: sha } : url.endsWith('/staging-diagnostics') ? { ...diagnostics(), databaseId: 'wrong' } : {} });
  await assert.rejects(() => preflight(good, wrongDatabase), /database identity mismatch/);
});

test('staging preflight reads the real API success envelope without bypassing identity checks', async () => {
  const wrappedFetch = (commit = sha, databaseId = good.E2E_TARGET_DB_ID) => async (url) => ({
    ok: true, status: 200, json: async () => ({
      success: true, data: url.endsWith('/build-info') ? { commit } : { ...diagnostics(), databaseId },
    }),
  });
  const result = await preflight(good, wrappedFetch());
  assert.equal(result.buildSha, sha);
  assert.equal(result.databaseId, good.E2E_TARGET_DB_ID);
  await assert.rejects(() => preflight(good, wrappedFetch('a'.repeat(40))), /build SHA mismatch/);
  await assert.rejects(() => preflight(good, wrappedFetch(sha, 'wrong')), /database identity mismatch/);
});

test('staging preflight rejects failed or malformed envelopes even if they include matching identities', async () => {
  for (const body of [
    { success: false, data: { commit: sha } },
    { success: true, data: null, commit: sha },
    { success: true, data: [], commit: sha },
  ]) {
    const malformed = async () => ({ ok: true, status: 200, json: async () => body });
    await assert.rejects(() => preflight(good, malformed), /invalid API envelope/);
  }
});

test('unapproved endpoint never receives a request or token, approved endpoints cannot redirect', async () => {
  let calls = 0;
  const fetchImpl = async (url, init) => {
    calls++;
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    return { ok: true, json: async () => url.endsWith('/build-info') ? { commit: sha } : diagnostics() };
  };
  await assert.rejects(() => preflight({ ...good, E2E_API_BASE_URL: 'https://evil.test' }, fetchImpl), /approved staging origin/);
  assert.equal(calls, 0);
  await preflight(good, fetchImpl);
  assert.equal(calls, 4);
});
