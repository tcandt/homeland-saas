const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { PrismaClient } = require('/app/node_modules/@prisma/client');

const mode = process.argv[2];
const output = '/drill-output';
const database = 'homeland_restore_drill_20261015_fresh';
const prefix = 'webworker-drill-20261015-';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
Object.assign(process.env, {
  DATABASE_URL: `postgresql://homeland_drill:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}@127.0.0.1:5432/${database}`,
  REDIS_URL: 'redis://127.0.0.1:6379', NODE_ENV: 'production', DEPLOY_ENV: 'staging',
  RUN_DB_MIGRATIONS: 'false', ALLOW_REGISTRATION: 'false',
  DISABLE_SCHEDULED_JOBS: mode === 'worker-launch' ? 'false' : 'true',
  DISABLE_DEPOSIT_OUTBOX: 'true', COMMUNICATION_IMMEDIATE_DELIVERY: 'false',
  COMMUNICATION_EXTERNAL_DELIVERY_ENABLED: 'false', SYSTEM_BACKUP_ENABLED: 'false',
  SYSTEM_UPDATE_MODE: 'dry-run', STORAGE_PROVIDER: 'local', STORAGE_DIR: '/app/apps/api/storage',
  NOTIFICATION_WORKER_HEARTBEAT_PATH: '/drill-runtime/heartbeat.json',
  APP_RUNTIME_ROLE: 'notification-worker', APP_URL: 'http://127.0.0.1:3000',
  CORS_ORIGINS: 'http://127.0.0.1:3000',
});

function save(name, value) {
  fs.writeFileSync(`${output}/${name}.json`, JSON.stringify(value, null, 2));
  console.log(JSON.stringify({ name, ...value }));
}

async function audit(prisma) {
  const tables = await prisma.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const records = [];
  for (const { tablename } of tables) {
    const quoted = '"' + tablename.replaceAll('"', '""') + '"';
    const [row] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(coalesce(string_agg(h, '' ORDER BY h), '')) AS digest FROM (SELECT md5(row_to_json(t)::text) h FROM public.${quoted} t) s`);
    records.push({ table: tablename, ...row });
  }
  return { records, sha256: hash(JSON.stringify(records)) };
}

async function main() {
  assert.ok(process.env.POSTGRES_PASSWORD, 'Private configuration required');
  if (mode === 'worker-launch') {
    require('/app/apps/api/dist/main');
    return;
  }
  const prisma = new PrismaClient();
  try {
    assert.equal(await prisma.$queryRawUnsafe('SELECT current_database() AS name').then((r) => r[0].name), database);
    if (mode === 'fixture' || mode === 'reset-fixture') {
      if (mode === 'reset-fixture') {
        assert.equal(await prisma.notificationQueue.count(), 6);
        assert.equal(await prisma.notificationQueue.count({ where: { id: { startsWith: prefix } } }), 6);
        await prisma.notificationDelivery.deleteMany({ where: { notificationId: { startsWith: prefix } } });
        await prisma.notificationQueue.deleteMany({ where: { id: { startsWith: prefix } } });
        await prisma.notification.deleteMany({ where: { id: { startsWith: prefix } } });
      }
      assert.equal(await prisma.notificationQueue.count(), 0, 'Require clean restored queue');
      const tenant = await prisma.tenantOrg.findFirstOrThrow();
      const cases = [
        ['queued', 'CONSOLE', 'QUEUED'], ['stale', 'CONSOLE', 'SENDING'],
        ['guarded', 'EMAIL', 'QUEUED'], ['future', 'CONSOLE', 'FAILED'],
        ['cancelled', 'CONSOLE', 'FAILED'], ['dead', 'CONSOLE', 'DEAD_LETTER'],
      ];
      for (const [name, channel, status] of cases) {
        const id = prefix + name;
        await prisma.notification.create({ data: { id, tenantId: tenant.id, title: 'Isolated test', message: 'Synthetic notification', channel, status } });
        await prisma.notificationQueue.create({ data: {
          id, tenantId: tenant.id, notificationId: id, channel, status,
          payload: { tenantId: tenant.id, title: 'Isolated test', message: 'Synthetic notification' },
          updatedAt: name === 'stale' ? new Date(Date.now() - 20 * 60000) : new Date(),
          nextRetryAt: name === 'future' ? new Date(Date.now() + 24 * 3600000) : null,
          error: name === 'cancelled' ? 'Cancelled manually' : null,
        } });
      }
      fs.writeFileSync(`${output}/worker-before.json`, JSON.stringify(await audit(prisma), null, 2));
      save('worker-fixture', { cases: cases.length, synthetic: true, liveWrites: false });
      return;
    }
    if (mode === 'worker-check') {
      const heartbeat = JSON.parse(fs.readFileSync('/drill-runtime/heartbeat.json'));
      assert.equal(heartbeat.role, 'notification-worker');
      assert.equal(heartbeat.checked, 3);
      assert.equal(heartbeat.recovered, 1);
      const statuses = {};
      for (const name of ['queued', 'stale', 'guarded', 'future', 'cancelled', 'dead']) {
        const item = await prisma.notificationQueue.findUniqueOrThrow({ where: { id: prefix + name } });
        const deliveries = await prisma.notificationDelivery.findMany({ where: { notificationId: item.id } });
        const expected = { queued: 'DELIVERED', stale: 'DELIVERED', guarded: 'FAILED', future: 'FAILED', cancelled: 'FAILED', dead: 'DEAD_LETTER' }[name];
        assert.equal(item.status, expected, name);
        assert.equal(deliveries.length, ['queued', 'stale', 'guarded'].includes(name) ? 1 : 0, name);
        if (name === 'guarded') {
          assert.equal(item.retryCount, 1);
          assert.ok(item.error.includes('External communication providers are disabled'));
          assert.ok(item.nextRetryAt > new Date());
        }
        const notification = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } });
        assert.equal(notification.status, expected, name);
        statuses[name] = { status: item.status, deliveries: deliveries.length };
      }
      const before = JSON.parse(fs.readFileSync(`${output}/worker-before.json`));
      const after = await audit(prisma);
      const changed = after.records.filter((row) => JSON.stringify(row) !== JSON.stringify(before.records.find((r) => r.table === row.table))).map((r) => r.table);
      assert.deepEqual(changed.sort(), ['Notification', 'NotificationDelivery', 'NotificationQueue']);
      save('worker-result', { passed: true, actualCronTick: true, heartbeat: { checked: heartbeat.checked, recovered: heartbeat.recovered, checkedAt: heartbeat.checkedAt }, statuses, changedTables: changed, externalDelivery: false });
      return;
    }
    if (mode === 'web') {
      const phase = process.env.DRILL_PHASE;
      assert.ok(['current', 'rollback', 'forward'].includes(phase));
      const before = await audit(prisma);
      const predecessor = { rollback: 'current', forward: 'rollback' }[phase];
      if (predecessor) {
        const previous = JSON.parse(fs.readFileSync(`${output}/web-${predecessor}.json`));
        assert.equal(before.sha256, previous.after.sha256, 'Web switch must not mutate database');
      }
      let checks = 0;
      async function request(route, expected, options = {}) {
        const response = await fetch('http://127.0.0.1:3000' + route, { redirect: 'manual', signal: AbortSignal.timeout(10000), ...options });
        assert.equal(response.status, expected, route);
        checks++;
        return response;
      }
      const login = await request('/login', 200);
      const html = await login.text();
      assert.ok(html.includes('<html'));
      const assets = [...new Set([...html.matchAll(/(?:src|href)="([^" ]+\/_next\/[^" ]+|\/_next\/[^" ]+)"/g)].map((m) => m[1]))];
      assert.ok(assets.length > 0, 'Require rendered Next assets');
      for (const asset of assets) await request(asset.replaceAll('&amp;', '&'), 200);
      await request('/api/v1/health/ready', 200);
      await request('/api/v1/notifications', 401);
      const authResponse = await request('/api/v1/auth/login', 201, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ emailOrPhone: 'admin@homeland.vn', password: process.env.SEED_DEFAULT_PASSWORD }) });
      const json = await authResponse.json();
      const token = (json.data ?? json).accessToken;
      assert.ok(token);
      const headers = { authorization: 'Bearer ' + token };
      for (const route of ['/auth/me', '/notifications', '/payments/sepay/admin-config', '/finance/cashflow', '/finance/profit-loss', '/reports/deposit-liability']) await request('/api/v1' + route, 200, { headers });
      await request('/api/v1/auth/activity', 201, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}' });
      await request('/api/v1/sales/leads', 404, { headers });
      for (const route of ['/', '/rooms', '/contracts', '/deposits', '/invoices', '/finance', '/reports', '/settings']) await request(route, 200);
      await request('/api/v1/auth/logout', 201, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}' });
      const after = await audit(prisma);
      fs.writeFileSync(`${output}/web-${phase}.json`, JSON.stringify({ passed: true, checks, assets: assets.length, before, after }, null, 2));
      console.log(JSON.stringify({ phase, passed: true, checks, assets: assets.length, webSwitchDataUnchanged: !!predecessor, browserUat: false }));
      return;
    }
    throw new Error('Unexpected drill mode');
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => {
  console.error('FAIL isolated Web/worker assertion: ' + (error.code === 'ERR_ASSERTION' ? error.message : error.name));
  process.exitCode = 1;
});
