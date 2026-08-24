const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

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
  INTERNAL_API_TOKEN: 'private-internal-token-with-32-characters',
  API_BODY_LIMIT: '2mb',
  DOCUMENT_UPLOAD_LIMIT_BYTES: '20971520',
  STORAGE_DIR: path.resolve('production-storage'),
  STORAGE_PROVIDER: 'local',
  COMMUNICATION_IMMEDIATE_DELIVERY: 'false',
  APP_RUNTIME_ROLE: 'notification-worker',
  ALLOW_REGISTRATION: 'false',
  NEXT_PUBLIC_ALLOW_REGISTRATION: 'false',
  ENABLE_SWAGGER: 'false',
  DISABLE_SCHEDULED_JOBS: 'false',
};

test('passes a structurally complete production configuration without claiming LIVE readiness', () => {
  const result = runProductionPreflight(valid);
  assert.equal(result.configReady, true);
  assert.equal(result.liveReady, false);
  assert.deepEqual(result.summary, { passed: 20, failed: 0, total: 20 });
  assert.ok(result.manualAcceptance.length >= 7);
});

test('rejects missing internal token and unsafe request limits', () => {
  const result = runProductionPreflight({
    ...valid,
    INTERNAL_API_TOKEN: 'short',
    API_BODY_LIMIT: '50mb',
    DOCUMENT_UPLOAD_LIMIT_BYTES: String(100 * 1024 * 1024),
    STORAGE_DIR: 'storage',
    COMMUNICATION_IMMEDIATE_DELIVERY: 'maybe',
    APP_RUNTIME_ROLE: 'invalid-role',
  });
  assert.equal(result.configReady, false);
  assert.equal(result.summary.failed, 6);
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

test('rejects api-only runtime when immediate delivery is disabled', () => {
  const result = runProductionPreflight({
    ...valid,
    APP_RUNTIME_ROLE: 'api',
    COMMUNICATION_IMMEDIATE_DELIVERY: 'false',
  });
  assert.equal(result.configReady, false);
  assert.equal(result.checks.find((check) => check.id === 'notification_queue_consumer').status, 'FAIL');
});

test('requires S3-compatible configuration when object storage mode is enabled', () => {
  const result = runProductionPreflight({
    ...valid,
    STORAGE_PROVIDER: 'r2',
    STORAGE_DIR: '',
    S3_ENDPOINT: '',
    S3_BUCKET: '',
    S3_ACCESS_KEY_ID: '',
    S3_SECRET_ACCESS_KEY: '',
  });
  assert.equal(result.configReady, false);
  assert.equal(result.checks.find((check) => check.id === 'object_storage_config').status, 'FAIL');
});

test('accepts structurally valid S3-compatible configuration for object storage mode', () => {
  const result = runProductionPreflight({
    ...valid,
    STORAGE_PROVIDER: 's3',
    STORAGE_DIR: '',
    S3_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
    S3_BUCKET: 'homeland-production',
    S3_ACCESS_KEY_ID: 'access-key',
    S3_SECRET_ACCESS_KEY: 'secret-key',
  });
  assert.equal(result.configReady, true);
  assert.equal(result.checks.find((check) => check.id === 'object_storage_config').status, 'PASS');
});

test('accepts a same-origin web API path without weakening the public API HTTPS check', () => {
  const result = runProductionPreflight({ ...valid, NEXT_PUBLIC_API_URL: '/api/v1' });
  assert.equal(result.configReady, true);
  assert.equal(result.checks.find((check) => check.id === 'next_public_api_url').message, 'NEXT_PUBLIC_API_URL uses a same-origin path.');
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
