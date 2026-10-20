const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = __dirname;
const configPath = path.join(root, 'config.cjs');
const configSource = fs.readFileSync(configPath, 'utf8');
const prepare = fs.readFileSync(path.join(root, 'prepare.sh'), 'utf8');
const activate = fs.readFileSync(path.join(root, 'activate.sh'), 'utf8');
const assetsSource = fs.readFileSync(path.join(root, 'assets.cjs'), 'utf8');
const dataSource = fs.readFileSync(path.join(root, 'data.cjs'), 'utf8');
const resumePrepare = fs.readFileSync(path.join(root, 'resume-prepare.sh'), 'utf8');

const digest = (character) => `sha256:${character.repeat(64)}`;
const policy = {
  DISABLE_SCHEDULED_JOBS: 'true',
  DISABLE_DEPOSIT_OUTBOX: 'true',
  RUN_DB_MIGRATIONS: 'false',
  SYSTEM_BACKUP_ENABLED: 'false',
  SYSTEM_UPDATE_ALLOW_SWITCH: 'false',
  ALLOW_REGISTRATION: 'false',
};
const row = (name, image, extra = {}) => ({
  Name: `/${name}`,
  Image: image,
  Config: { Env: Object.entries({ API_SECRET: 'source-api-secret', JWT_SECRET: 'source-jwt-secret', ...policy, ...extra })
    .map(([key, value]) => `${key}=${value}`) },
  Mounts: [],
});

function runConfig() {
  const inspect = [
    row('homeland_release_320_api', digest('a'), { DATABASE_URL: 'postgresql://source:source-password@old-postgres/source', REDIS_URL: 'redis://old-redis:6379' }),
    row('homeland_release_320_worker', digest('a'), { DATABASE_URL: 'postgresql://source:source-password@old-postgres/source', REDIS_URL: 'redis://old-redis:6379', COMMUNICATION_IMMEDIATE_DELIVERY: 'false' }),
    row('homeland_release_320_web', digest('b'), { NEXT_PUBLIC_API_URL: 'https://homeland.ductinh.one/api' }),
    row('homeland_release_320_postgres', digest('c')),
    row('homeland_release_320_redis', digest('d')),
  ];
  inspect[0].Config.Labels = { 'com.docker.compose.project': 'homeland_release_320' };
  inspect[0].Mounts = [{ Destination: '/app/apps/api/storage', Name: 'homeland_release_320_storage' }];
  inspect[2].HostConfig = { PortBindings: { '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '3002' }] } };
  const files = new Map([
    ['/release/source-inspect.private.json', JSON.stringify(inspect)],
    ['/release/api-image.id', digest('e')],
    ['/release/web-image.id', digest('f')],
  ]);
  const writes = new Map();
  const fakeFs = {
    readFileSync(file) {
      const value = files.get(String(file));
      if (value === undefined) throw new Error(`unexpected read: ${file}`);
      return value;
    },
    writeFileSync(file, value, options) {
      assert.equal(options.mode, 0o600);
      assert.equal(options.flag, 'wx');
      writes.set(String(file), String(value));
    },
  };
  const sandbox = {
    require(name) {
      if (name === 'node:fs') return fakeFs;
      if (name === 'node:crypto') return crypto;
      if (name === 'node:assert/strict') return assert;
      throw new Error(`unexpected require: ${name}`);
    },
    console: { log() {} },
  };
  vm.runInNewContext(configSource, sandbox, { filename: 'config.cjs' });
  return {
    compose: JSON.parse(writes.get('/release/compose.private.json')),
    apiEnv: Object.fromEntries(writes.get('/release/api.private.env').trim().split('\n').map(line => line.split(/=(.*)/s))),
  };
}

function runAssets(mode, snapshot, sourceFiles, targetFiles = new Map(), realpaths = new Map()) {
  const writes = [];
  const files = new Map([
    ['/release/retained.private.json', JSON.stringify(snapshot)],
    ...sourceFiles,
    ...targetFiles,
  ]);
  const fakeFs = {
    readFileSync(file) {
      const value = files.get(String(file));
      if (value === undefined) throw new Error(`missing file: ${file}`);
      return Buffer.isBuffer(value) ? value : String(value);
    },
    realpathSync(file) {
      const value = realpaths.get(String(file)) || String(file);
      if (!files.has(String(file)) && !files.has(value)) throw new Error(`missing realpath: ${file}`);
      return value;
    },
    lstatSync(file) {
      if (!files.has(String(file))) throw new Error(`missing stat: ${file}`);
      return { isFile: () => true };
    },
    mkdirSync() {},
    writeFileSync(file, value, options) {
      assert.equal(options.mode, 0o644);
      assert.equal(options.flag, 'wx');
      if (files.has(String(file))) throw new Error(`already exists: ${file}`);
      files.set(String(file), Buffer.from(value));
      writes.push(String(file));
    },
  };
  const logs = [];
  vm.runInNewContext(assetsSource, {
    require(name) {
      if (name === 'node:fs') return fakeFs;
      if (name === 'node:path') return path.posix;
      if (name === 'node:crypto') return crypto;
      if (name === 'node:assert/strict') return assert;
      throw new Error(`unexpected require: ${name}`);
    },
    process: { argv: ['node', 'assets.cjs', mode] },
    console: { log(value) { logs.push(value); } },
  }, { filename: 'assets.cjs' });
  return { files, writes, manifest: JSON.parse(logs.at(-1)) };
}

async function runRestoreMappings(mappings) {
  const calls = [];
  let completed;
  const done = new Promise(resolve => { completed = resolve; });
  const prisma = {
    hunonicMeterMapping: { count: async () => 0 },
    $executeRaw(strings, ...values) {
      calls.push({ sql: strings.join('?'), values });
      return Promise.resolve();
    },
    $disconnect() {
      completed();
      return Promise.resolve();
    },
  };
  vm.runInNewContext(dataSource, {
    require(name) {
      if (name === 'node:fs') return { readFileSync: () => JSON.stringify({ HunonicMeterMapping: mappings }) };
      if (name === 'node:crypto') return crypto;
      if (name === 'node:assert/strict') return assert;
      if (name === '/app/node_modules/@prisma/client') return { PrismaClient: class { constructor() { return prisma; } } };
      throw new Error(`unexpected require: ${name}`);
    },
    process: { argv: ['node', 'data.cjs', 'restore-mappings'] },
    console: { log() {}, error() {} },
  }, { filename: 'data.cjs' });
  await done;
  return calls;
}

const { compose, apiEnv } = runConfig();
const candidate = compose.name;
const service = name => compose.services[name];
const sourceShaPattern = /\b[0-9a-f]{40}\b/i;

test('config creates an isolated candidate project from source inspect data', () => {
  assert.match(candidate, /^homeland_checkout_[a-z0-9]+$/);
  assert.equal(service('api').container_name, `${candidate}_api`);
  assert.equal(service('notification_worker').container_name, `${candidate}_worker`);
  assert.equal(service('web').container_name, `${candidate}_web`);
});

test('config uses generated credentials and a candidate-only database URL', () => {
  const databaseUrl = service('api').environment.DATABASE_URL;
  assert.match(databaseUrl, /^postgresql:\/\/homeland_staging:[a-f0-9]{64}@postgres:5432\/homeland_staging\?schema=public$/);
  assert.equal(service('notification_worker').environment.DATABASE_URL, databaseUrl);
  assert.notEqual(databaseUrl, 'postgresql://source:source-password@old-postgres/source');
  assert.equal(service('api').environment.REDIS_URL, 'redis://redis:6379');
});

test('config preserves API secrets while overriding only candidate runtime connection metadata', () => {
  for (const key of ['API_SECRET', 'JWT_SECRET']) assert.equal(service('api').environment[key], `source-${key.toLowerCase().replace('_', '-')}`);
  assert.equal(apiEnv.API_SECRET, 'source-api-secret');
  assert.equal(apiEnv.JWT_SECRET, 'source-jwt-secret');
  assert.equal(service('api').environment.RUN_DB_MIGRATIONS, 'false');
  assert.match(service('api').environment.COMMIT_SHA, sourceShaPattern);
  assert.match(service('api').environment.BUILD_ID, /^checkout-[a-z0-9]+$/);
});

test('config retains API and worker safety policy values', () => {
  for (const name of ['api', 'notification_worker']) {
    for (const [key, value] of Object.entries(policy)) assert.equal(service(name).environment[key], value, `${name}.${key}`);
  }
  assert.equal(service('notification_worker').environment.COMMUNICATION_IMMEDIATE_DELIVERY, 'false');
});

test('config publishes only candidate web on loopback port 3004', () => {
  assert.deepEqual(service('web').ports, ['127.0.0.1:3004:3000']);
  for (const name of ['api', 'notification_worker', 'postgres', 'redis']) assert.equal(service(name).ports, undefined);
});

test('config allocates fresh external candidate volumes', () => {
  for (const name of ['database', 'storage', 'runtime']) {
    assert.deepEqual(compose.volumes[name], { external: true, name: `${candidate}_${name}` });
  }
});

test('config declares no unsafe host bind mounts', () => {
  for (const name of ['postgres', 'api', 'notification_worker']) {
    for (const mount of service(name).volumes || []) {
      assert.ok(!mount.startsWith('/') && !mount.includes(':/volume1/'), `${name}: ${mount}`);
    }
  }
});

test('config writes private artifacts atomically with restrictive mode', () => {
  assert.match(configSource, /mode:\s*0o600,\s*flag:\s*'wx'/);
  assert.match(configSource, /api\.private\.env/);
  assert.match(configSource, /compose\.private\.json/);
});

test('prepare retains an explicit configuration whitelist and omits business tables', () => {
  const retained = ['TenantOrg', 'Owner', 'User', 'Role', 'Permission', 'UserRole', 'RolePermission', 'AppSetting', 'ChartOfAccount', 'CashAccount', 'BankAccount', 'NotificationTemplate', 'NotificationTemplateVersion', 'NotificationPreference', 'AiPromptTemplate', 'AiModelConfig', 'DocumentTemplate', '_prisma_migrations'];
  for (const table of retained) {
    const selector = table === '_prisma_migrations' ? `-t ${table}` : `-t '"${table}"'`;
    assert.match(prepare, new RegExp(selector));
  }
  for (const businessTable of ['Invoice', 'InvoiceItem', 'Payment', 'Contract', 'Customer', 'Deposit']) assert.doesNotMatch(prepare, new RegExp(`-t '"${businessTable}"'`));
});

test('prepare applies migrations only on the candidate network and never the source database', () => {
  const migrationStart = prepare.lastIndexOf('"$d" run --rm', prepare.indexOf('migrate deploy'));
  const migration = prepare.slice(migrationStart, prepare.indexOf('\n', prepare.indexOf('migrate deploy')));
  assert.match(migration, new RegExp(`--network ${candidate}_default`));
  assert.match(migration, /--env-file "\$r\/api\.private\.env"/);
  assert.doesNotMatch(migration, /homeland_release_320_default|oldpg|source/i);
});

test('activation marks the candidate authoritative before publishing web traffic', () => {
  const committed = activate.indexOf('committed=true');
  const publish = activate.indexOf('compose up -d --no-deps web');
  assert.ok(committed >= 0 && publish > committed);
  assert.ok(activate.indexOf('"$d" stop homeland_release_320_web') < committed);
});

test('activation rollback only restores source traffic before authority transfer', () => {
  const recover = activate.slice(activate.indexOf('recover() {'), activate.indexOf('trap recover EXIT'));
  assert.match(recover, /test "\$committed" = false/);
  assert.match(recover, /start homeland_release_320_api homeland_release_320_worker homeland_release_320_web/);
  assert.ok(activate.indexOf('committed=true') < activate.indexOf('compose up -d --no-deps web'));
});

test('stop-recovery flags are armed before either source workload stop', () => {
  const prepareFlag = prepare.indexOf('source_stopped=true');
  const prepareStop = prepare.indexOf('"$d" stop homeland_release_320_worker homeland_release_320_api');
  const activateFlag = activate.indexOf('source_stopped=true');
  const activateStop = activate.indexOf('"$d" stop homeland_release_320_worker homeland_release_320_api');
  assert.ok(prepareFlag >= 0 && prepareStop > prepareFlag);
  assert.ok(activateFlag >= 0 && activateStop > activateFlag);
});

test('assets copies only AppSetting referenced settings assets and records a content manifest', () => {
  const snapshot = { AppSetting: [{ tenantId: 'tenant-a', value: {
    logo: 'document-storage://tenant-a/settings/logo.png',
    nested: ['document-storage://tenant-a/avatars/avatar.jpg', 'document-storage://tenant-a/business/license.pdf'],
    ignored: 'document-storage://tenant-a/contracts/contract.pdf',
  } }] };
  const sourceFiles = new Map([
    ['/source/tenant-a/settings/logo.png', Buffer.from('logo')],
    ['/source/tenant-a/avatars/avatar.jpg', Buffer.from('avatar')],
    ['/source/tenant-a/business/license.pdf', Buffer.from('license')],
  ]);
  const copy = runAssets('copy', snapshot, sourceFiles);
  assert.deepEqual(copy.writes.sort(), [
    '/target/tenant-a/avatars/avatar.jpg',
    '/target/tenant-a/business/license.pdf',
    '/target/tenant-a/settings/logo.png',
  ]);
  assert.deepEqual(copy.manifest.referencedSettingsAssets.map(item => item.relative), [
    'tenant-a/avatars/avatar.jpg', 'tenant-a/business/license.pdf', 'tenant-a/settings/logo.png',
  ]);
  assert.equal(copy.files.has('/target/tenant-a/contracts/contract.pdf'), false);

  const verify = runAssets('verify', snapshot, sourceFiles, new Map(
    [...copy.files].filter(([file]) => file.startsWith('/target/')),
  ));
  assert.deepEqual(verify.manifest, copy.manifest);
});

test('assets rejects traversal and symlink escapes before target writes', () => {
  assert.throws(() => runAssets('copy', { AppSetting: [{ value: 'document-storage://tenant-a/settings/../secret.txt' }] }, new Map()), /AssertionError/);
  assert.throws(() => runAssets(
    'copy',
    { AppSetting: [{ value: 'document-storage://tenant-a/settings/logo.png' }] },
    new Map([['/source/tenant-a/settings/logo.png', Buffer.from('logo')]]),
    new Map(),
    new Map([['/source/tenant-a/settings/logo.png', '/outside/secret.txt']]),
  ), /AssertionError/);
});

test('assets rejects an AppSetting reference outside its tenant storage prefix', () => {
  assert.throws(() => runAssets(
    'copy',
    { AppSetting: [{ tenantId: 'tenant-a', value: 'document-storage://tenant-b/settings/logo.png' }] },
    new Map([['/source/tenant-b/settings/logo.png', Buffer.from('foreign')]]),
  ), /AssertionError/);
});

test('ops gate derives candidate identity from generated compose metadata', () => {
  assert.equal(prepare.match(new RegExp(`newpg=${candidate}_postgres`)) !== null, true);
});

test('restore mappings passes original JSON, nulls, and timestamps directly to PostgreSQL', async () => {
  const mappings = [{
    id: 'mapping-1', tenantId: 'tenant-a', providerMeterId: 'provider-1',
    buildingId: null, roomId: null, lastStatus: null, lastReadingKwh: null,
    lastAmountVnd: null, lastSyncedAt: null, raw: null,
    createdAt: '2026-10-20T01:02:03.456Z', updatedAt: '2026-10-20T04:05:06.789Z',
  }];
  const [call] = await runRestoreMappings(mappings);
  assert.match(call.sql, /INSERT INTO "HunonicMeterMapping"/);
  assert.match(call.sql, /jsonb_populate_recordset\(NULL::"HunonicMeterMapping", \?::jsonb\)/);
  assert.deepEqual(JSON.parse(call.values[0]), mappings);
  assert.doesNotMatch(dataSource, /hunonicMeterMapping\.createMany|new Date\(.*HunonicMeterMapping/);
});

test('resume prepare fails closed before candidate restore work', () => {
  assert.match(prepare, /test "\$\(stat -c '%a' "\$r"\)" = 700/);
  assert.match(resumePrepare, /test "\$\(stat -c '%a' "\$r"\)" = 700/);
  assert.match(resumePrepare, /test "\$\(cat prepare\.exit\)" = 1/);
  assert.match(resumePrepare, /test ! -e resume\.started/);
  assert.match(resumePrepare, /test ! -e migrate\.log/);
  assert.match(resumePrepare, /test "\$\(cat runtime\.exit\)" = 0/);
  assert.match(resumePrepare, /test "\$\(cat build\.exit\)" = 0/);
  const countGuard = resumePrepare.indexOf('SELECT count(*) FROM "HunonicMeterMapping"');
  const restore = resumePrepare.indexOf('/release/data.cjs restore-mappings');
  assert.ok(countGuard >= 0 && restore > countGuard);
  assert.match(resumePrepare, new RegExp(`--network ${candidate}_default`));
});
