const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = '/release';
const inspect = JSON.parse(fs.readFileSync(`${root}/source-inspect.private.json`));
const get = name => { const row = inspect.find(x => x.Name === `/${name}`); assert.ok(row, name); return row; };
const env = row => Object.fromEntries(row.Config.Env.map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; }));
const api = get('homeland_release_320_api');
const worker = get('homeland_release_320_worker');
const web = get('homeland_release_320_web');
const postgres = get('homeland_release_320_postgres');
const redis = get('homeland_release_320_redis');
const apiImage = fs.readFileSync(`${root}/api-image.id`, 'utf8').trim();
const webImage = fs.readFileSync(`${root}/web-image.id`, 'utf8').trim();
assert.ok([apiImage, webImage, postgres.Image, redis.Image].every(x => /^sha256:[a-f0-9]{64}$/.test(x)));
assert.equal(api.Config.Labels['com.docker.compose.project'], 'homeland_release_320');
assert.equal(api.Mounts.find(x => x.Destination === '/app/apps/api/storage')?.Name, 'homeland_release_320_storage');
assert.equal(web.HostConfig.PortBindings['3000/tcp'][0].HostIp, '127.0.0.1');
assert.equal(web.HostConfig.PortBindings['3000/tcp'][0].HostPort, '3002');
const password = crypto.randomBytes(32).toString('hex');
const databaseUrl = `postgresql://homeland_staging:${password}@postgres:5432/homeland_staging?schema=public`;
const runtime = row => ({ ...env(row), DATABASE_URL: databaseUrl, REDIS_URL: 'redis://redis:6379',
  COMMIT_SHA: '87aa24573fe3d7e0a5bbea7a44d042cf854c4e5d', BUILD_ID: 'checkout-87aa2457',
  RUN_DB_MIGRATIONS: 'false' });
for (const row of [api, worker]) {
  const e = env(row);
  assert.equal(e.DISABLE_SCHEDULED_JOBS, 'true');
  assert.equal(e.DISABLE_DEPOSIT_OUTBOX, 'true');
  assert.equal(e.RUN_DB_MIGRATIONS, 'false');
  assert.equal(e.SYSTEM_BACKUP_ENABLED, 'false');
  assert.equal(e.SYSTEM_UPDATE_ALLOW_SWITCH, 'false');
  assert.equal(e.ALLOW_REGISTRATION, 'false');
}
assert.equal(env(worker).COMMUNICATION_IMMEDIATE_DELIVERY, 'false');
const check = (command, seconds = 10) => ({ test: ['CMD-SHELL', command], interval: `${seconds}s`, timeout: '5s', retries: 30 });
const common = { restart: 'unless-stopped' };
const mounts = ['storage:/app/apps/api/storage', 'runtime:/app/.codex-runtime'];
const compose = { name: 'homeland_checkout_87aa2457', services: {
  postgres: { ...common, image: postgres.Image, container_name: 'homeland_checkout_87aa2457_postgres',
    environment: { POSTGRES_USER: 'homeland_staging', POSTGRES_DB: 'homeland_staging', POSTGRES_PASSWORD: password },
    volumes: ['database:/var/lib/postgresql/data'], healthcheck: check('pg_isready -U homeland_staging -d homeland_staging', 5) },
  redis: { ...common, image: redis.Image, container_name: 'homeland_checkout_87aa2457_redis' },
  api: { ...common, image: apiImage, container_name: 'homeland_checkout_87aa2457_api', environment: runtime(api),
    volumes: mounts, depends_on: { postgres: { condition: 'service_healthy' }, redis: { condition: 'service_started' } },
    healthcheck: check('wget -qO- http://127.0.0.1:3001/api/v1/health/ready >/dev/null') },
  notification_worker: { ...common, image: apiImage, container_name: 'homeland_checkout_87aa2457_worker',
    environment: runtime(worker), volumes: mounts, depends_on: { api: { condition: 'service_healthy' } } },
  web: { ...common, image: webImage, container_name: 'homeland_checkout_87aa2457_web',
    environment: env(web), ports: ['127.0.0.1:3004:3000'], depends_on: { api: { condition: 'service_healthy' } },
    healthcheck: check('wget -qO- http://127.0.0.1:3000/login >/dev/null') },
}, volumes: Object.fromEntries(['database', 'storage', 'runtime'].map(x => [x, { external: true, name: `homeland_checkout_87aa2457_${x}` }])) };
fs.writeFileSync(`${root}/compose.private.json`, JSON.stringify(compose, null, 2), { mode: 0o600, flag: 'wx' });
fs.writeFileSync(`${root}/api.private.env`, Object.entries(runtime(api)).map(([k, v]) => {
  assert.ok(!String(v).includes('\n') && !String(v).includes('\r')); return `${k}=${v}`;
}).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
console.log('PRIVATE_CONFIG_CREATED; source policy and signing environment preserved; new isolated volumes/network');
