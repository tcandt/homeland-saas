const a = require('node:assert/strict');
const fs = require('node:fs');
const { PrismaClient } = require('/app/node_modules/@prisma/client');
const p = new PrismaClient();
async function main() {
  const checks = [];
  for (const origin of ['http://web:3000', 'https://homeland.ductinh.one']) {
    const ready = await fetch(`${origin}/api/v1/health/ready`, { signal: AbortSignal.timeout(30000) });
    a.equal(ready.status, 200);
    const response = await fetch(`${origin}/api/v1/health/build-info`, { headers: { 'x-internal-token': process.env.INTERNAL_API_TOKEN }, signal: AbortSignal.timeout(30000) });
    a.equal(response.status, 200);
    const payload = await response.json();
    const build = payload.data || payload;
    a.equal(build.commit, fs.readFileSync('/release/source.sha', 'utf8').trim());
    a.equal(build.buildId, 'nas-3.2.1');
    a.equal(build.version, '3.2.1');
    const page = await fetch(`${origin}/login`, { signal: AbortSignal.timeout(30000) });
    a.equal(page.status, 200);
    // The auth provider returns a loading shell until client hydration.
    // ui.browser.cjs checks the visible Web version in a real browser.
    a.ok((await page.text()).includes('/_next/static/'));
    const auth = await fetch(`${origin}/api/v1/contracts/import-existing`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30000) });
    a.equal(auth.status, 401);
    checks.push({ origin, ready: 200, build: build.commit, apiVersion: build.version, login: 200, importAuth: 401 });
  }
  a.equal(await p.building.count({ where: { deletedAt: null } }), 4);
  a.equal(await p.room.count({ where: { deletedAt: null } }), 34);
  const migrations = await p.$queryRawUnsafe('SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
  a.equal(migrations[0].count, 37);
  console.log(JSON.stringify({ status: 'PASS', checks, buildings: 4, rooms: 34, migrations: 37 }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => p.$disconnect());
