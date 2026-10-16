const assert = require('node:assert/strict');
const crypto = require('node:crypto');
async function main() {
  assert.equal(process.env.PREVIEW_RECOVERED_API_CONFIRM, 'homeland_preview_restore_drill_20261016');
  assert.ok(process.env.SEED_DEFAULT_PASSWORD && process.env.INTERNAL_API_TOKEN);
  const base = 'http://127.0.0.1:3001/api/v1'; // Inside the restored API namespace only.
  let checks = 0;
  async function request(path, status, options = {}) {
    const response = await fetch(base + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, status, path);
    checks++;
    return response;
  }
  await request('/health/ready', 200);
  const raw = await (await request('/health/build-info', 200, { headers: { 'x-internal-token': process.env.INTERNAL_API_TOKEN } })).json();
  const build = raw.data ?? raw;
  assert.equal(build.commit, 'e1decc81045114db20e09718fcb465349aa012f9');
  assert.equal(build.deploymentEnvironment, 'staging');
  const diagnosticsResponse = await request('/health/staging-diagnostics', 200, { headers: { 'x-internal-token': process.env.INTERNAL_API_TOKEN } });
  const rawDiagnostics = await diagnosticsResponse.json();
  const diagnostics = rawDiagnostics.data ?? rawDiagnostics;
  assert.equal(diagnostics.databaseId, process.env.PREVIEW_RECOVERED_API_CONFIRM);
  assert.equal(diagnostics.migrationCount, 35);
  const login = await (await request('/auth/login', 201, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ emailOrPhone: 'admin@homeland.vn', password: process.env.SEED_DEFAULT_PASSWORD }),
  })).json();
  const auth = login.data ?? login;
  assert.ok(auth.accessToken);
  const headers = { authorization: `Bearer ${auth.accessToken}` };
  try {
    await request('/auth/me', 200, { headers });
    const response = await request('/documents/cmvahlu1p000moltit978fdbs/download', 200, { headers });
    const checksum = crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
    assert.equal(checksum, '947a3496f36d44ef68956d81802dde75e126172725db142b11e63bd270f97376');
  } finally { await request('/auth/logout', 201, { method: 'POST', headers }); }
  console.log(JSON.stringify({ status: 'PASS', scope: 'isolated-recovered-API-HTTP-not-financial-or-Web-UAT', checks, documentChecksum: 'MATCH', commit: build.commit }));
}
module.exports = { main };
if (require.main === module) main().catch(() => { console.error('Recovered API verification failed; sensitive response withheld'); process.exitCode = 1; });
