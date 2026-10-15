const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('yaml');

const directory = path.resolve(__dirname, '../deploy/nas-staging-49c185d0');
for (const relative of ['docker-compose.nas-staging.yml', 'nas-root/docker-compose.nas-staging.yml']) {
  test(`NAS staging safety contract: ${relative}`, () => {
    const config = yaml.parse(fs.readFileSync(path.join(directory, relative), 'utf8'));
    const { services } = config;
    assert.equal(services.bootstrap.environment.CI_DATABASE_BOOTSTRAP_MODE, 'NAS_STAGING');
    assert.deepEqual(services.bootstrap.entrypoint, ['node']);
    assert.deepEqual(services.bootstrap.command, ['scripts/ci-bootstrap-database.js']);
    assert.equal(services.bootstrap.environment.NAS_STAGING_BOOTSTRAP_CONFIRM, 'homeland_nas_staging');
    for (const name of ['postgres', 'redis', 'api', 'notification_worker']) assert.equal(services[name].ports, undefined);
    assert.deepEqual(services.web.ports, ['127.0.0.1:3000:3000']);
    assert.match(services.api.healthcheck.test[1], /\/health\/ready/);
    for (const name of ['api', 'notification_worker']) {
      assert.equal(services[name].environment.DEPLOY_ENV, 'staging');
      assert.equal(services[name].environment.COMMUNICATION_EXTERNAL_DELIVERY_ENABLED, 'false');
      assert.equal(services[name].environment.STORAGE_DIR, '/app/apps/api/storage');
      assert.equal(services[name].environment.NOTIFICATION_WORKER_HEARTBEAT_PATH, '/app/.codex-runtime/notification-worker-heartbeat.json');
      assert.ok(services[name].volumes.includes('homeland_nas_staging_runtime:/app/.codex-runtime'));
      assert.ok(services[name].volumes.includes('homeland_nas_staging_storage:/app/apps/api/storage'));
    }
    assert.equal(services.api.depends_on.bootstrap.condition, 'service_completed_successfully');
    assert.equal(services.web.depends_on.api.condition, 'service_healthy');
  });
}

test('Deploy-only bootstrap executes the guarded script without shell argv splitting', () => {
  const { services } = yaml.parse(fs.readFileSync(path.join(directory, 'deploy-only/docker-compose.yml'), 'utf8'));
  assert.deepEqual(services.bootstrap.entrypoint, ['node']);
  assert.deepEqual(services.bootstrap.command, ['scripts/ci-bootstrap-database.js']);
  assert.equal(services.bootstrap.environment.NAS_STAGING_BOOTSTRAP_CONFIRM, 'homeland_nas_staging');
});

test('Deploy-only services pin the verified seed-runtime image and truthful component identities', () => {
  const { services } = yaml.parse(fs.readFileSync(path.join(directory, 'deploy-only/docker-compose.yml'), 'utf8'));
  for (const name of ['bootstrap', 'api', 'notification_worker']) {
    assert.equal(services[name].image, 'homeland-api:3.0.2-573bc663');
  }
  assert.equal(services.api.environment.COMMIT_SHA, '573bc6636266313a04cb2d7b1fbcdef3223eec7b');
  assert.equal(services.api.environment.APP_VERSION, '3.0.2-573bc663');
  assert.equal(services.api.environment.BUILD_ID, 'release-573bc663');
  assert.equal(services.web.image, 'homeland-web:3.0.2-e9e24274');
  assert.equal(services.web.environment.NEXT_PUBLIC_COMMIT_SHA, 'e9e242741a556822abe2febcb61fb80824c5e236');
});

test('NAS-root artifact differs only in root-relative paths', () => {
  const canonical = fs.readFileSync(path.join(directory, 'docker-compose.nas-staging.yml'), 'utf8');
  const artifact = fs.readFileSync(path.join(directory, 'nas-root/docker-compose.nas-staging.yml'), 'utf8');
  assert.deepEqual(yaml.parse(artifact), yaml.parse(canonical.replaceAll('context: ../..', 'context: .').replaceAll('../../tai-lieu', './tai-lieu')));
});

test('Dedicated Homeland tunnel uses private token file and no public origin port', () => {
  const config = yaml.parse(fs.readFileSync(path.join(directory, 'cloudflared/docker-compose.yml'), 'utf8'));
  assert.equal(config.name, 'homeland_nas_staging_tunnel');
  assert.deepEqual(Object.keys(config.services), ['cloudflared']);
  const tunnel = config.services.cloudflared;
  assert.equal(tunnel.container_name, 'homeland_nas_staging_cloudflared');
  assert.equal(tunnel.network_mode, 'host');
  assert.equal(tunnel.ports, undefined);
  assert.deepEqual(tunnel.env_file, ['.env']);
  assert.deepEqual(tunnel.command, ['tunnel', '--no-autoupdate', 'run']);
  assert.equal(tunnel.environment, undefined);
});
