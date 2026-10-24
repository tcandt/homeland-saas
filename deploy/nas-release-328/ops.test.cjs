const test = require('node:test');
const a = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { auditConfiguration } = require('./configuration-audit.cjs');
const source = fs.readFileSync(path.join(__dirname, 'config.cjs'), 'utf8');
const digest = character => `sha256:${character.repeat(64)}`;
function configure(oldVersion = '3.2.6') {
  const root = '/volume1/docker/homeland/release-3212-20261024';
  const sha = 'a'.repeat(40);
  const policy = { APP_VERSION: oldVersion, DATABASE_URL: 'postgresql://preserved',
    CUSTOM_SETTING: 'preserved', COMMUNICATION_IMMEDIATE_DELIVERY: 'true', RUN_DB_MIGRATIONS: 'false', SYSTEM_BACKUP_ENABLED: 'false',
    SYSTEM_UPDATE_ALLOW_SWITCH: 'false', ALLOW_REGISTRATION: 'false',
    DISABLE_SCHEDULED_JOBS: 'true', DISABLE_DEPOSIT_OUTBOX: 'true' };
  const row = (image, environment) => ({ Image: image, State: { Status: 'running' },
    Config: { Labels: { 'com.docker.compose.project': 'homeland_checkout_87aa2457' },
      Env: Object.entries(environment).map(([key, value]) => `${key}=${value}`) } });
  const oldApi = 'sha256:bd778691b756a1d815d253e916ec7755d51599be6ca282c0bdc3cd6290a1ab37';
  const oldWeb = 'sha256:2f8859e507a6accf30c657054fac6b90f8bbb8415f0fb735d446de5325e07bc4';
  const rows = { live_api: row(oldApi, policy), live_worker: row(oldApi, policy), live_web: row(oldWeb, policy),
    [digest('b')]: row(digest('b'), { APP_VERSION: '3.2.12', COMMIT_SHA: sha, BUILD_ID: 'nas-3.2.12', BUILD_TIME: 'time' }),
    [digest('c')]: row(digest('c'), { APP_VERSION: '3.2.12', COMMIT_SHA: sha, BUILD_ID: 'nas-3.2.12', BUILD_TIME: 'time' }) };
  const compose = { name: 'homeland_checkout_87aa2457', services: {
    api: { container_name: 'live_api', volumes: ['storage:/app/storage'] },
    notification_worker: { container_name: 'live_worker', volumes: ['storage:/app/storage'] },
    web: { container_name: 'live_web', ports: ['127.0.0.1:3002:3000'] },
    postgres: { image: digest('d'), volumes: ['database:/var/lib/postgresql/data'] },
    redis: { image: digest('e') },
  }, volumes: { database: { external: true, name: 'existing-db' }, storage: { external: true, name: 'existing-storage' } } };
  const writes = new Map();
  const files = { [`${root}/source.sha`]: sha, [`${root}/api-image.id`]: digest('b'), [`${root}/web-image.id`]: digest('c'),
    [`${root}/ci-gate.json`]: JSON.stringify({ sha, conclusion: 'success' }),
    '/volume1/docker/homeland/release-326-20261021/compose.private.json': JSON.stringify(compose) };
  vm.runInNewContext(source, { structuredClone, console: { log() {} }, require(name) {
    if (name === 'node:assert/strict') return a;
    if (name === 'node:crypto') return crypto;
    if (name === './configuration-audit.cjs') return { auditConfiguration };
    if (name === 'node:fs') return { readFileSync(file) { if (writes.has(file)) return writes.get(file); a.ok(file in files, file); return files[file]; },
      writeFileSync(file, value, options) { a.equal(options.flag, 'wx'); a.equal(options.mode, 0o600); writes.set(file, value); } };
    if (name === 'node:child_process') return { execFileSync(binary, args) {
      a.equal(binary, '/usr/local/bin/docker'); a.equal(args[0], 'inspect'); a.ok(rows[args[1]]); return JSON.stringify([rows[args[1]]]);
    } };
    throw new Error(name);
  } });
  return { original: compose, candidate: JSON.parse(writes.get(`${root}/compose.private.json`)),
    rollback: JSON.parse(writes.get(`${root}/rollback.private.json`)),
    audit: JSON.parse(writes.get(`${root}/docker-compose.audit.yml`)), writes, files, root };
}
test('changes only application images and build identity, preserving live settings and volumes', () => {
  const { original, candidate, rollback, audit } = configure();
  a.deepEqual(candidate.volumes, original.volumes);
  for (const name of ['postgres', 'redis']) a.deepEqual(candidate.services[name], original.services[name]);
  for (const name of ['api', 'notification_worker', 'web']) {
    a.equal(candidate.services[name].environment.DATABASE_URL, 'postgresql://preserved');
    a.equal(candidate.services[name].environment.CUSTOM_SETTING, 'preserved');
    a.equal(candidate.services[name].environment.APP_VERSION, '3.2.12');
    a.equal(rollback.services[name].environment.APP_VERSION, '3.2.6');
    a.ok(Object.values(audit.services[name].environment).every(value => value === 'REDACTED'));
  }
});
test('blocks same-version and downgrade deployments', () => {
  a.throws(() => configure('3.2.12'), /version must increase/);
  a.throws(() => configure('3.3.0'), /version must increase/);
});

test('acceptance permits the login hydration shell but rejects incorrect API identity', async () => {
  const script = fs.readFileSync(path.join(__dirname, 'verify.cjs'), 'utf8');
  for (const version of ['3.2.12', '3.2.6']) {
    const state = { exitCode: 0, env: {} };
    const output = [];
    class PrismaClient {
      building = { count: async () => 4 };
      room = { count: async () => 34 };
      $queryRawUnsafe = async () => [{ count: 37 }];
      $disconnect = async () => {};
    }
    await vm.runInNewContext(script, {
      require: name => name === 'node:assert/strict' ? a : name === 'node:fs'
        ? { readFileSync: () => 'a'.repeat(40) } : { PrismaClient },
      process: state, AbortSignal,
      console: { log: text => output.push(JSON.parse(text)), error: () => {} },
      fetch: async url => ({
        status: url.endsWith('/contracts/import-existing') ? 401 : 200,
        json: async () => ({ data: { version, commit: 'a'.repeat(40), buildId: 'nas-3.2.12' } }),
        text: async () => '<script src="/_next/static/login.js"></script><div>Loading</div>',
      }),
    });
    a.equal(state.exitCode, version === '3.2.12' ? 0 : 1);
    a.equal(output.length, version === '3.2.12' ? 1 : 0);
    if (output.length) a.equal(output[0].checks.length, 2);
  }
});

test('configuration audit rejects unrelated environment, service and storage changes', () => {
  const { rollback, candidate } = configure();
  for (const mutate of [
    value => { value.services.api.environment.CUSTOM_SETTING = 'changed'; },
    value => { value.services.redis.image = digest('f'); },
    value => { value.volumes.database.name = 'replacement-db'; },
    value => { value.services.api.volumes.push('/var/run/docker.sock:/var/run/docker.sock'); },
  ]) {
    const altered = structuredClone(candidate);
    mutate(altered);
    a.throws(() => auditConfiguration(rollback, altered));
  }
});

test('configuration manifest hashes every activation input', () => {
  const { writes, files, root } = configure();
  const entries = writes.get(`${root}/configuration-audit.sha`).trim().split('\n');
  a.equal(entries.length, 9);
  const names = entries.map(entry => {
    const [hash, name] = entry.split('  ');
    const content = writes.has(`${root}/${name}`) ? writes.get(`${root}/${name}`) : files[`${root}/${name}`];
    a.equal(hash, crypto.createHash('sha256').update(content).digest('hex'));
    return name;
  });
  a.deepEqual(names, ['compose.private.json', 'rollback.private.json', 'api.private.env', 'docker-compose.audit.yml', 'configuration-audit.json', 'source.sha', 'api-image.id', 'web-image.id', 'ci-gate.json']);
});
test('activation never resets schema or volumes and only rolls back before publication', () => {
  const script = fs.readFileSync(path.join(__dirname, 'activate.sh'), 'utf8');
  a.ok(!/down\b|volume rm|migrate deploy|db push|TRUNCATE|DROP TABLE/.test(script));
  a.ok(script.includes('pg_dump'));
  a.ok(script.includes('test "$published" = false'));
  a.ok(script.indexOf('published=true') < script.indexOf('up -d --no-deps web'));
  a.ok(script.indexOf('chmod 600 before-update.private.dump') < script.indexOf('pg_dump'));
  a.ok(script.includes('while test "$attempt" -lt 2'));
  a.ok(script.indexOf('sha256sum -c configuration-audit.sha') < script.indexOf('compose stop'));
  const build = fs.readFileSync(path.join(__dirname, 'build.sh'), 'utf8');
  a.ok(build.includes('get-tar-commit-id < source.tar'));
});
