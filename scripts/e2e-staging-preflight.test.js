const test = require('node:test');
const assert = require('node:assert/strict');
const { assertStaticGuards, preflight } = require('./e2e-staging-preflight');

const sha = '7bed941e12c65d9bfd586919bfe8d89b84cecda2';
const good = {
  E2E_ENVIRONMENT: 'staging', E2E_WEB_BASE_URL: 'https://staging-web.example.test', E2E_API_BASE_URL: 'https://staging-api.example.test',
  E2E_DATABASE_URL: 'postgresql://test:masked@db.example.test:5432/homeland_e2e_test', E2E_TARGET_DB_ID: 'homeland_e2e_test',
  E2E_ADMIN_USERNAME: 'admin', E2E_ADMIN_PASSWORD: 'masked', E2E_MANAGER_USERNAME: 'manager', E2E_MANAGER_PASSWORD: 'masked',
  E2E_OWNER_A_USERNAME: 'owner-a', E2E_OWNER_A_PASSWORD: 'masked', E2E_OWNER_B_USERNAME: 'owner-b', E2E_OWNER_B_PASSWORD: 'masked',
  E2E_RUN_ID: 'core1004-20260926-2020', E2E_EXPECTED_BUILD_SHA: sha, E2E_INTERNAL_TOKEN: 'masked',
  E2E_DISPOSABLE_DATABASE: 'true', RUN_DESTRUCTIVE_E2E: 'true',
};

test('staging preflight refuses incomplete, mutable, or non-disposable configuration', () => {
  assert.throws(() => assertStaticGuards({ ...good, E2E_RUN_ID: '' }), /E2E_RUN_ID/);
  assert.throws(() => assertStaticGuards({ ...good, E2E_EXPECTED_BUILD_SHA: sha.slice(0, 7) }), /immutable Git SHA/);
  assert.throws(() => assertStaticGuards({ ...good, E2E_ENVIRONMENT: 'production' }), /must be staging/);
  assert.throws(() => assertStaticGuards({ ...good, E2E_DISPOSABLE_DATABASE: 'false' }), /DISPOSABLE/);
  assert.throws(() => assertStaticGuards({ ...good, E2E_DATABASE_URL: 'postgresql://test:masked@db.example.test:5432/another_db' }), /disagree/);
});

test('staging preflight verifies health, immutable build identity, and target database identity', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith('/build-info')) return { ok: true, status: 200, json: async () => ({ commit: sha }) };
    if (url.endsWith('/staging-diagnostics')) return { ok: true, status: 200, json: async () => ({ databaseId: good.E2E_TARGET_DB_ID }) };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const result = await preflight(good, fetchImpl);
  assert.deepEqual(result, { status: 'READY', runId: good.E2E_RUN_ID, databaseId: good.E2E_TARGET_DB_ID, buildSha: sha });
  assert.equal(calls.length, 4);
});

test('staging preflight fails closed for an unexpected build or database', async () => {
  const wrongBuild = async (url) => ({ ok: true, status: 200, json: async () => url.endsWith('/build-info') ? { commit: 'a'.repeat(40) } : {} });
  await assert.rejects(() => preflight(good, wrongBuild), /build SHA mismatch/);
  const wrongDatabase = async (url) => ({ ok: true, status: 200, json: async () => url.endsWith('/build-info') ? { commit: sha } : url.endsWith('/staging-diagnostics') ? { databaseId: 'wrong' } : {} });
  await assert.rejects(() => preflight(good, wrongDatabase), /database identity mismatch/);
});
