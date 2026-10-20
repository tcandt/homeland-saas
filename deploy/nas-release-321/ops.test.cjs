const test = require('node:test');
const a = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'config.cjs'), 'utf8');
const digest = character => `sha256:${character.repeat(64)}`;
function configure(oldVersion = '3.2.0') {
  const root = '/volume1/docker/homeland/release-321-20261021';
  const sha = 'a'.repeat(40);
  const policy = { APP_VERSION: oldVersion, DATABASE_URL: 'postgresql://preserved',
    CUSTOM_SETTING: 'preserved', RUN_DB_MIGRATIONS: 'false', SYSTEM_BACKUP_ENABLED: 'false',
    SYSTEM_UPDATE_ALLOW_SWITCH: 'false', ALLOW_REGISTRATION: 'false',
    DISABLE_SCHEDULED_JOBS: 'true', DISABLE_DEPOSIT_OUTBOX: 'true' };
  const row = (image, environment) => ({ Image: image, State: { Status: 'running' },
    Config: { Labels: { 'com.docker.compose.project': 'homeland_checkout_87aa2457' },
      Env: Object.entries(environment).map(([key, value]) => `${key}=${value}`) } });
  const oldApi = 'sha256:2063224877317507abffb19e6f096a96a9f231fd8dffd91689fd90ee43f0eae9';
  const oldWeb = 'sha256:ae856a6a4860938630366036ffbfcc7acc40ce6f5f33503efb5a7dc204fc82bb';
  const rows = { live_api: row(oldApi, policy), live_worker: row(oldApi, policy), live_web: row(oldWeb, policy),
    [digest('b')]: row(digest('b'), { APP_VERSION: '3.2.1', COMMIT_SHA: sha, BUILD_ID: 'nas-3.2.1', BUILD_TIME: 'time' }),
    [digest('c')]: row(digest('c'), { APP_VERSION: '3.2.1', COMMIT_SHA: sha, BUILD_ID: 'nas-3.2.1', BUILD_TIME: 'time' }) };
  const compose = { name: 'homeland_checkout_87aa2457', services: {
    api: { container_name: 'live_api', volumes: ['storage:/app/storage'] },
    notification_worker: { container_name: 'live_worker', volumes: ['storage:/app/storage'] },
    web: { container_name: 'live_web', ports: ['127.0.0.1:3002:3000'] },
    postgres: { image: digest('d'), volumes: ['database:/var/lib/postgresql/data'] },
    redis: { image: digest('e') },
  }, volumes: { database: { external: true, name: 'existing-db' }, storage: { external: true, name: 'existing-storage' } } };
  const writes = new Map();
  const files = { [`${root}/source.sha`]: sha, [`${root}/api-image.id`]: digest('b'), [`${root}/web-image.id`]: digest('c'),
    '/volume1/docker/homeland/release-4fc77db1/checkout-87aa2457/compose.private.json': JSON.stringify(compose) };
  vm.runInNewContext(source, { structuredClone, console: { log() {} }, require(name) {
    if (name === 'node:assert/strict') return a;
    if (name === 'node:fs') return { readFileSync(file) { a.ok(file in files, file); return files[file]; },
      writeFileSync(file, value, options) { a.equal(options.flag, 'wx'); a.equal(options.mode, 0o600); writes.set(file, value); } };
    if (name === 'node:child_process') return { execFileSync(binary, args) {
      a.equal(binary, '/usr/local/bin/docker'); a.equal(args[0], 'inspect'); a.ok(rows[args[1]]); return JSON.stringify([rows[args[1]]]);
    } };
    throw new Error(name);
  } });
  return { original: compose, candidate: JSON.parse(writes.get(`${root}/compose.private.json`)),
    rollback: JSON.parse(writes.get(`${root}/rollback.private.json`)),
    audit: JSON.parse(writes.get(`${root}/docker-compose.audit.yml`)) };
}
test('changes only application images and build identity, preserving live settings and volumes', () => {
  const { original, candidate, rollback, audit } = configure();
  a.deepEqual(candidate.volumes, original.volumes);
  for (const name of ['postgres', 'redis']) a.deepEqual(candidate.services[name], original.services[name]);
  for (const name of ['api', 'notification_worker', 'web']) {
    a.equal(candidate.services[name].environment.DATABASE_URL, 'postgresql://preserved');
    a.equal(candidate.services[name].environment.CUSTOM_SETTING, 'preserved');
    a.equal(candidate.services[name].environment.APP_VERSION, '3.2.1');
    a.equal(rollback.services[name].environment.APP_VERSION, '3.2.0');
    a.ok(Object.values(audit.services[name].environment).every(value => value === 'REDACTED'));
  }
});
test('blocks same-version and downgrade deployments', () => {
  a.throws(() => configure('3.2.1'), /version must increase/);
  a.throws(() => configure('3.2.2'), /version must increase/);
});
test('activation never resets schema or volumes and only rolls back before publication', () => {
  const script = fs.readFileSync(path.join(__dirname, 'activate.sh'), 'utf8');
  a.ok(!/down\b|volume rm|migrate deploy|db push|TRUNCATE|DROP TABLE/.test(script));
  a.ok(script.includes('pg_dump'));
  a.ok(script.includes('test "$published" = false'));
  a.ok(script.indexOf('published=true') < script.indexOf('up -d --no-deps web'));
  a.ok(script.indexOf('chmod 600 before-update.private.dump') < script.indexOf('pg_dump'));
  a.ok(script.includes('while test "$attempt" -lt 2'));
  const build = fs.readFileSync(path.join(__dirname, 'build.sh'), 'utf8');
  a.ok(build.includes('get-tar-commit-id < source.tar'));
});
