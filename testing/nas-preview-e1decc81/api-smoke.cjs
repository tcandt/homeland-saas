const assert = require('node:assert/strict');
const targets = { 'v4-api-container': 'http://127.0.0.1:3001', 'v4-api-to-web': 'http://web:3000' };
const context = process.env.PREVIEW_SMOKE_CONTEXT;
assert.ok(Object.hasOwn(targets, context), 'An explicit v4 container context is required');
const origin = process.env.PREVIEW_SMOKE_ORIGIN;
assert.equal(origin, targets[context], 'An explicit origin matching the v4 container context is required');
const commit = 'e1decc81045114db20e09718fcb465349aa012f9';
const checks = [];
const unwrap = body => body?.data ?? body;
async function request(path, expected, options = {}) {
  const response = await fetch(`${origin}/api/v1${path}`, {
    ...options, redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  assert.equal(response.status, expected, `${options.method || 'GET'} ${path}`);
  const body = unwrap(await response.json());
  checks.push(`${options.method || 'GET'} ${path}: ${response.status}`);
  return body;
}
async function main() {
  assert.equal(process.env.DEPLOY_ENV, 'staging');
  assert.equal(process.env.COMMUNICATION_EXTERNAL_DELIVERY_ENABLED, 'false');
  assert.equal(process.env.DISABLE_SCHEDULED_JOBS, 'true');
  assert.equal(process.env.RUN_DB_MIGRATIONS, 'false');
  assert.ok(process.env.SEED_DEFAULT_PASSWORD && process.env.INTERNAL_API_TOKEN);
  await request('/health/ready', 200);
  await request('/health/build-info', 401);
  await request('/notifications', 401);
  const internal = { 'x-internal-token': process.env.INTERNAL_API_TOKEN };
  const build = await request('/health/build-info', 200, { headers: internal });
  assert.equal(build.commit, commit);
  assert.equal(build.deploymentEnvironment, 'staging');
  const diagnostics = await request('/health/staging-diagnostics', 200, { headers: internal });
  assert.equal(diagnostics.buildCommit, commit);
  assert.equal(diagnostics.databaseId, 'homeland_staging');
  assert.equal(diagnostics.migrationCount, 35);
  await request('/health/seed', 200, { headers: internal });
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const period = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
  for (const [email, role] of [['admin@homeland.vn','ADMIN'], ['manager@homeland.local','MANAGER'], ['finance@homeland.local','FINANCE']]) {
    const auth = await request('/auth/login', 201, { method: 'POST', body: JSON.stringify({ emailOrPhone: email, password: process.env.SEED_DEFAULT_PASSWORD }) });
    assert.ok(auth.accessToken);
    const headers = { authorization: `Bearer ${auth.accessToken}` };
    try {
      const me = await request('/auth/me', 200, { headers });
      assert.ok(JSON.stringify(me.roles).includes(role));
      assert.ok(!JSON.stringify(me.roles).includes('SALES'));
      await request('/notifications', 200, { headers });
      await request('/auth/activity', 201, { headers, method: 'POST', body: '{}' });
      if (role === 'ADMIN') {
        for (const path of ['/payments/sepay/admin-config','/rooms','/customers','/contracts','/deposits','/invoices','/finance/cashflow','/finance/profit-loss','/finance/debt-summary',`/reports/cashflow?period=${period}`,`/reports/profit-loss?period=${period}`,'/reports/deposit-liability','/reports/receivable-aging']) await request(path, 200, { headers });
        for (const path of ['/notifications/zalo/connect-webhook','/notifications/zalo/test-admin-group']) {
          const result = await request(path, 503, { headers, method: 'POST', body: '{}' });
          assert.ok(JSON.stringify(result).includes('EXTERNAL_PROVIDER_DISABLED_IN_STAGING'));
        }
      } else {
        await request('/system-update/backups', 403, { headers });
      }
      await request('/sales/leads', 404, { headers });
    } finally {
      await request('/auth/logout', 201, { headers, method: 'POST', body: '{}' });
    }
  }
  console.log(JSON.stringify({ status: 'PASS', scope: 'isolated-NAS-preview-API-not-full-UAT', commit, period, total: checks.length, checks }));
}
module.exports = { main };
if (require.main === module) main().catch(() => { console.error('Preview API smoke FAIL; sensitive response withheld'); process.exitCode = 1; });
