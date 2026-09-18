#!/usr/bin/env node
/* Read-only staging readiness check. Never mutates data or prints secrets. */
const required = [
  'E2E_WEB_BASE_URL', 'E2E_API_BASE_URL',
  'E2E_ADMIN_USERNAME', 'E2E_ADMIN_PASSWORD',
  'E2E_MANAGER_USERNAME', 'E2E_MANAGER_PASSWORD',
  'E2E_OWNER_A_USERNAME', 'E2E_OWNER_A_PASSWORD',
  'E2E_OWNER_B_USERNAME', 'E2E_OWNER_B_PASSWORD',
  'E2E_EXPECTED_BUILD_SHA', 'E2E_INTERNAL_TOKEN', 'E2E_TARGET_DB_ID',
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`BLOCKED: missing ${missing.join(', ')}`);
  process.exit(2);
}

const api = process.env.E2E_API_BASE_URL.replace(/\/$/, '');
const expectedSha = process.env.E2E_EXPECTED_BUILD_SHA;
const token = process.env.E2E_INTERNAL_TOKEN;
const endpoints = ['/api/v1/health', '/api/v1/health/ready'];
async function main() {
  for (const path of endpoints) {
    const response = await fetch(`${api}${path}`);
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  }
  const response = await fetch(`${api}/api/v1/health/build-info`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`/api/v1/health/build-info returned HTTP ${response.status}`);
  const body = await response.json();
  const actual = body.commit ?? body.sha ?? body.buildId;
  if (actual !== expectedSha) throw new Error(`build SHA mismatch (expected ${expectedSha}, got ${actual ?? 'unknown'})`);
  const diagnostics = await (await fetch(`${api}/api/v1/health/staging-diagnostics`, { headers: { Authorization: `Bearer ${token}` } })).json();
  if (diagnostics.databaseId !== process.env.E2E_TARGET_DB_ID) throw new Error(`DB identity mismatch (expected ${process.env.E2E_TARGET_DB_ID})`);
  console.log('READY');
}
main().catch((error) => { console.error(`BLOCKED: ${error.message}`); process.exit(1); });
