#!/usr/bin/env node
/* Read-only release-SHA staging gate. Never mutates data or prints secrets. */
const required = [
  'E2E_ENVIRONMENT', 'E2E_WEB_BASE_URL', 'E2E_API_BASE_URL', 'E2E_DATABASE_URL',
  'E2E_ADMIN_USERNAME', 'E2E_ADMIN_PASSWORD',
  'E2E_MANAGER_USERNAME', 'E2E_MANAGER_PASSWORD',
  'E2E_OWNER_A_USERNAME', 'E2E_OWNER_A_PASSWORD',
  'E2E_OWNER_B_USERNAME', 'E2E_OWNER_B_PASSWORD',
  'E2E_RUN_ID', 'E2E_EXPECTED_BUILD_SHA', 'E2E_INTERNAL_TOKEN', 'E2E_TARGET_DB_ID',
  'E2E_DISPOSABLE_DATABASE', 'RUN_DESTRUCTIVE_E2E',
];

function assertStaticGuards(env = process.env) {
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`BLOCKED: missing ${missing.join(', ')}`);
  if (env.E2E_ENVIRONMENT !== 'staging') throw new Error('BLOCKED: E2E_ENVIRONMENT must be staging');
  if (env.E2E_DISPOSABLE_DATABASE !== 'true') throw new Error('BLOCKED: E2E_DISPOSABLE_DATABASE must be true');
  if (env.RUN_DESTRUCTIVE_E2E !== 'true') throw new Error('BLOCKED: RUN_DESTRUCTIVE_E2E must be true');
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{7,80}$/.test(env.E2E_RUN_ID)) throw new Error('BLOCKED: E2E_RUN_ID format is invalid');
  if (!/^[a-f0-9]{40}$/.test(env.E2E_EXPECTED_BUILD_SHA)) throw new Error('BLOCKED: E2E_EXPECTED_BUILD_SHA must be a full immutable Git SHA');

  for (const key of ['E2E_WEB_BASE_URL', 'E2E_API_BASE_URL']) {
    const url = new URL(env[key]);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`BLOCKED: ${key} must be an HTTP(S) URL`);
  }
  const databaseUrl = new URL(env.E2E_DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) throw new Error('BLOCKED: E2E_DATABASE_URL must be a PostgreSQL URL');
  const databaseId = decodeURIComponent(databaseUrl.pathname).replace(/^\//, '');
  if (databaseId !== env.E2E_TARGET_DB_ID) throw new Error('BLOCKED: E2E_DATABASE_URL and E2E_TARGET_DB_ID disagree');
}

async function requireOk(fetchImpl, url, init, label) {
  const response = await fetchImpl(url, init);
  if (!response.ok) throw new Error(`BLOCKED: ${label} returned HTTP ${response.status}`);
  return response;
}

async function preflight(env = process.env, fetchImpl = fetch) {
  assertStaticGuards(env);
  const api = env.E2E_API_BASE_URL.replace(/\/$/, '');
  await requireOk(fetchImpl, `${api}/api/v1/health`, undefined, '/api/v1/health');
  await requireOk(fetchImpl, `${api}/api/v1/health/ready`, undefined, '/api/v1/health/ready');
  const headers = { Authorization: `Bearer ${env.E2E_INTERNAL_TOKEN}` };
  const build = await requireOk(fetchImpl, `${api}/api/v1/health/build-info`, { headers }, '/api/v1/health/build-info');
  const body = await build.json();
  const actual = body.commit ?? body.sha ?? body.buildId;
  if (actual !== env.E2E_EXPECTED_BUILD_SHA) throw new Error('BLOCKED: build SHA mismatch');
  const diagnostics = await requireOk(fetchImpl, `${api}/api/v1/health/staging-diagnostics`, { headers }, '/api/v1/health/staging-diagnostics');
  const diagnosticBody = await diagnostics.json();
  if (diagnosticBody.databaseId !== env.E2E_TARGET_DB_ID) throw new Error('BLOCKED: database identity mismatch');
  return { status: 'READY', runId: env.E2E_RUN_ID, databaseId: diagnosticBody.databaseId, buildSha: actual };
}

if (require.main === module) {
  preflight().then((result) => console.log(`${result.status}: run=${result.runId} database=${result.databaseId} sha=${result.buildSha}`))
    .catch((error) => { console.error(error.message); process.exit(1); });
}

module.exports = { assertStaticGuards, preflight, required };
