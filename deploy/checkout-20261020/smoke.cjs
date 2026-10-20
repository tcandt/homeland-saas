const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('/app/node_modules/bcryptjs');
const { PrismaClient } = require('/app/node_modules/@prisma/client');
const prisma = new PrismaClient();
const base = process.argv[2];
assert.ok(['http://web:3000', 'https://homeland.ductinh.one'].includes(base));
const checks = [];
let userId;
let accessToken;
let fixtureTenant;
let fixtureEmail;
const unwrap = x => x && typeof x === 'object' && 'data' in x ? x.data : x;
async function request(path, expected, options = {}) {
  const response = await fetch(`${base}/api/v1${path}`, { ...options, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, expected, `${options.method || 'GET'} ${path}`);
  checks.push({ path, method: options.method || 'GET', status: response.status });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
async function main() {
  const ready = unwrap(await request('/health/ready', 200));
  assert.equal(ready.status, 'READY');
  await request('/health/build-info', 401);
  const build = unwrap(await request('/health/build-info', 200, { headers: { 'x-internal-token': process.env.INTERNAL_API_TOKEN } }));
  assert.equal(build.commit, '87aa24573fe3d7e0a5bbea7a44d042cf854c4e5d');
  assert.equal(build.buildId, 'checkout-87aa2457');
  await request('/contracts', 401);
  const tenant = await prisma.tenantOrg.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
  const role = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  assert.ok(tenant && role);
  const password = crypto.randomBytes(32).toString('hex');
  fixtureTenant = tenant.id;
  fixtureEmail = `checkout-${crypto.randomBytes(12).toString('hex')}@deployment.invalid`;
  const user = await prisma.user.create({ data: { tenantId: tenant.id, email: fixtureEmail,
    fullName: 'Temporary checkout deployment verifier', passwordHash: await bcrypt.hash(password, 10),
    roles: { create: { roleId: role.id } } } });
  userId = user.id;
  assert.equal(await prisma.appSetting.count({ where: { tenantId: tenant.id, ownerId: user.id, key: 'auth-security' } }), 0);
  const login = unwrap(await request('/auth/login', 201, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ emailOrPhone: user.email, password }) }));
  assert.ok(login.accessToken && !login.challengeToken);
  accessToken = login.accessToken;
  const headers = { authorization: `Bearer ${accessToken}` };
  for (const path of ['/auth/me', '/buildings', '/rooms', '/customers', '/contracts', '/invoices', '/hunonic/history']) {
    await request(path, 200, { headers });
  }
  await request('/auth/logout', 201, { method: 'POST', headers });
  accessToken = null;
  const page = await fetch(`${base}/login`, { signal: AbortSignal.timeout(30000) });
  assert.equal(page.status, 200);
  const html = await page.text();
  const assets = [...new Set([...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map(x => x[1]))].slice(0, 4);
  assert.ok(assets.length >= 2);
  for (const asset of assets) assert.equal((await fetch(new URL(asset, base), { signal: AbortSignal.timeout(30000) })).status, 200);
  checks.push({ loginPage: 200, staticAssets: assets.length });
  console.log(JSON.stringify({ status: 'PASS', base, checks }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(async () => {
  try {
    if (accessToken) await fetch(`${base}/api/v1/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) });
    if (userId) {
      // Remove only this fresh random fixture and its authentication side effects.
      await prisma.$transaction(async tx => {
        await tx.appSetting.deleteMany({ where: { tenantId: fixtureTenant, scope: 'USER', ownerId: userId } });
        await tx.auditLog.deleteMany({ where: { tenantId: fixtureTenant, OR: [{ userId }, { entityId: userId }] } });
        await tx.userRole.deleteMany({ where: { userId } });
        await tx.user.delete({ where: { id: userId, email: fixtureEmail } });
      });
    }
  } catch (e) { console.error('Fixture cleanup failed: ' + e.message); process.exitCode = 1; }
  await prisma.$disconnect();
});
