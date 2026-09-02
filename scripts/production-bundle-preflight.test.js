const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatHumanReport,
  parseArguments,
  runProductionBundlePreflight,
} = require('./production-bundle-preflight');

const valid = {
  APP_VERSION: 'v1.1.4',
  API_TAG: 'v1.1.4',
  WEB_TAG: '64f2666',
  COMMIT_SHA: '64f26661abc1234',
  BUILD_ID: 'public-production',
  BUILD_TIME: '2026-08-24T00:00:00Z',
  APP_URL: 'https://homeland.example.com',
  CORS_ORIGINS: 'https://homeland.example.com',
  POSTGRES_PASSWORD: 'very-strong-postgres-password',
  JWT_SECRET: 'very-strong-jwt-secret-with-32-plus-characters', // gitleaks:allow
  INTERNAL_API_TOKEN: 'very-strong-internal-token-with-32-plus-characters',
  MAINTENANCE_BYPASS_KEY: 'very-strong-bypass-key',
  RUN_DB_MIGRATIONS: 'false',
  STORAGE_PROVIDER: 'local',
  STORAGE_DIR: '/app/storage',
};

test('passes a structurally valid production bundle configuration', () => {
  const result = runProductionBundlePreflight(valid);
  assert.equal(result.ready, true);
  assert.equal(result.summary.failed, 0);
});

test('rejects mutable tags and weak secrets', () => {
  const result = runProductionBundlePreflight({
    ...valid,
    API_TAG: 'latest',
    WEB_TAG: '',
    POSTGRES_PASSWORD: 'replace-with-strong-postgres-password',
    JWT_SECRET: 'short',
    INTERNAL_API_TOKEN: 'short',
  });
  assert.equal(result.ready, false);
  assert.ok(result.summary.failed >= 5);
});

test('requires object storage credentials when provider is r2', () => {
  const result = runProductionBundlePreflight({
    ...valid,
    STORAGE_PROVIDER: 'r2',
    STORAGE_DIR: '',
    S3_ENDPOINT: '',
    S3_BUCKET: '',
    S3_ACCESS_KEY_ID: '',
    S3_SECRET_ACCESS_KEY: '',
  });
  assert.equal(result.ready, false);
  assert.equal(result.checks.find((check) => check.id === 'object_storage_config').status, 'FAIL');
});

test('human report avoids printing secrets and parser handles supported flags', () => {
  const report = formatHumanReport(runProductionBundlePreflight(valid));
  assert.equal(report.includes(valid.JWT_SECRET), false);
  assert.deepEqual(parseArguments(['--env-file', 'prod.env', '--json']), {
    envFile: 'prod.env',
    json: true,
  });
});
