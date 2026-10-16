const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const yaml = require('yaml');
const config = yaml.parse(fs.readFileSync(path.join(__dirname, 'docker-compose.yml'), 'utf8'), { merge: true });

test('preview is a separate project and uses only the explicitly prepared database', () => {
  assert.equal(config.name, 'homeland_nas_staging_v4');
  assert.deepEqual(config.volumes.prepared_database, { external: true, name: 'homeland_nas_staging_v4_db_20261016' });
  assert.deepEqual(config.services.postgres.volumes, ['prepared_database:/var/lib/postgresql/data']);
  for (const service of Object.values(config.services)) assert.match(service.container_name, /^homeland_nas_staging_v4_/);
  for (const name of ['storage', 'backups', 'runtime']) assert.equal(config.volumes[name], null);
});

test('only Web binds the loopback preview port; no public origin or internal port', () => {
  for (const name of ['postgres', 'redis', 'bootstrap', 'api', 'notification_worker']) assert.equal(config.services[name].ports, undefined);
  assert.deepEqual(config.services.web.ports, ['127.0.0.1:3002:3000']);
  assert.equal(config.services.web.environment.INTERNAL_API_ORIGIN, 'http://api:3001');
});

test('provider, scheduler and automatic migration writes remain disabled', () => {
  for (const name of ['api', 'notification_worker']) {
    const env = config.services[name].environment;
    assert.equal(env.DEPLOY_ENV, 'staging');
    for (const key of ['COMMUNICATION_EXTERNAL_DELIVERY_ENABLED', 'COMMUNICATION_IMMEDIATE_DELIVERY', 'RUN_DB_MIGRATIONS', 'ALLOW_REGISTRATION']) assert.equal(env[key], 'false');
    assert.equal(env.DISABLE_SCHEDULED_JOBS, 'true');
    assert.equal(env.DISABLE_DEPOSIT_OUTBOX, 'true');
    assert.match(env.JWT_SECRET, /:\?/);
    assert.match(env.INTERNAL_API_TOKEN, /:\?/);
  }
});

test('all API roles use the same candidate and bootstrap must pass before readiness', () => {
  for (const name of ['api', 'notification_worker', 'bootstrap']) assert.equal(config.services[name].image, 'homeland-api:e1decc81');
  assert.equal(config.services.web.image, 'homeland-web:e1decc81');
  const boot = config.services.bootstrap;
  assert.equal(boot.environment.CI_DATABASE_BOOTSTRAP_MODE, 'NAS_STAGING');
  assert.equal(boot.environment.NAS_STAGING_BOOTSTRAP_CONFIRM, 'homeland_nas_staging');
  assert.deepEqual(boot.command, ['scripts/ci-bootstrap-database.js']);
  assert.equal(config.services.api.depends_on.bootstrap.condition, 'service_completed_successfully');
  assert.equal(config.services.web.depends_on.api.condition, 'service_healthy');
});
