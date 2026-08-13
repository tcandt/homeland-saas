const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatHumanReport,
  parseArguments,
  runProductionPreflight,
} = require('./production-preflight');

const valid = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://service:private-database-value@db.internal:5432/homeland',
  REDIS_URL: 'rediss://service:private-redis-value@redis.internal:6379',
  APP_URL: 'https://api.homeland.example',
  NEXT_PUBLIC_API_URL: 'https://api.homeland.example/api/v1',
  CORS_ORIGINS: 'https://homeland.example,https://admin.homeland.example',
  JWT_SECRET: 'private-jwt-value-with-at-least-32-characters',
  ALLOW_REGISTRATION: 'false',
  NEXT_PUBLIC_ALLOW_REGISTRATION: 'false',
  ENABLE_SWAGGER: 'false',
  DISABLE_SCHEDULED_JOBS: 'false',
};

test('passes a structurally complete production configuration without claiming LIVE readiness', () => {
  const result = runProductionPreflight(valid);
  assert.equal(result.configReady, true);
  assert.equal(result.liveReady, false);
  assert.deepEqual(result.summary, { passed: 11, failed: 0, total: 11 });
  assert.ok(result.manualAcceptance.length >= 7);
});

test('rejects development defaults, open registration, Swagger, and disabled sync', () => {
  const result = runProductionPreflight({
    ...valid,
    NODE_ENV: 'development',
    JWT_SECRET: 'homeland_super_secret_key_change_in_production',
    ALLOW_REGISTRATION: 'true',
    NEXT_PUBLIC_ALLOW_REGISTRATION: 'true',
    ENABLE_SWAGGER: 'true',
    DISABLE_SCHEDULED_JOBS: 'true',
  });
  assert.equal(result.configReady, false);
  assert.equal(result.summary.failed, 6);
});

test('rejects public HTTP, wildcard CORS, and loopback services by default', () => {
  const result = runProductionPreflight({
    ...valid,
    DATABASE_URL: 'postgresql://service:private@127.0.0.1:5432/homeland',
    REDIS_URL: 'redis://localhost:6379',
    APP_URL: 'http://api.homeland.example',
    NEXT_PUBLIC_API_URL: 'http://api.homeland.example/api/v1',
    CORS_ORIGINS: 'https://*.homeland.example',
  });
  assert.equal(result.configReady, false);
  assert.equal(result.summary.failed, 5);
});

test('supports an explicit loopback mode for isolated release verification', () => {
  const result = runProductionPreflight({
    ...valid,
    DATABASE_URL: 'postgresql://service:private@127.0.0.1:5432/homeland',
    REDIS_URL: 'redis://localhost:6379',
    APP_URL: 'http://127.0.0.1:3101',
    NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3101/api/v1',
    CORS_ORIGINS: 'http://127.0.0.1:3100',
  }, { allowLoopback: true });
  assert.equal(result.configReady, true);
});

test('human report never includes configured secret values', () => {
  const report = formatHumanReport(runProductionPreflight(valid));
  assert.equal(report.includes('private-database-value'), false);
  assert.equal(report.includes('private-redis-value'), false);
  assert.equal(report.includes(valid.JWT_SECRET), false);
  assert.match(report, /LIVE status: BLOCKED/);
});

test('parses supported CLI arguments and rejects unknown arguments', () => {
  assert.deepEqual(parseArguments(['--env-file', 'production.env', '--json', '--allow-loopback']), {
    allowLoopback: true,
    json: true,
    envFile: 'production.env',
  });
  assert.throws(() => parseArguments(['--unsafe']), /Unknown argument/);
});
