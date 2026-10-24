const fs = require('node:fs');
const cp = require('node:child_process');
const a = require('node:assert/strict');
const crypto = require('node:crypto');
const { auditConfiguration } = require('./configuration-audit.cjs');
const root = '/volume1/docker/homeland/release-3212-20261024';
const docker = args => cp.execFileSync('/usr/local/bin/docker', args, { encoding: 'utf8' });
const sha = fs.readFileSync(`${root}/source.sha`, 'utf8').trim();
a.match(sha, /^[a-f0-9]{40}$/);
const version = '3.2.12';
const c = JSON.parse(fs.readFileSync('/volume1/docker/homeland/release-326-20261021/compose.private.json'));
a.equal(c.name, 'homeland_checkout_87aa2457');
a.deepEqual(c.services.web.ports, ['127.0.0.1:3002:3000']);
const inspect = name => JSON.parse(docker(['inspect', name]))[0];
const env = row => Object.fromEntries(row.Config.Env.map(line => {
  const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)];
}));
const originals = {};
for (const key of ['api', 'notification_worker', 'web']) {
  const service = c.services[key];
  const live = inspect(service.container_name);
  a.equal(live.Config.Labels['com.docker.compose.project'], c.name);
  a.equal(live.State.Status, 'running');
  originals[key] = { image: live.Image, environment: env(live) };
  service.image = live.Image;
  service.environment = env(live);
}
a.equal(originals.api.image, 'sha256:bd778691b756a1d815d253e916ec7755d51599be6ca282c0bdc3cd6290a1ab37');
a.equal(originals.web.image, 'sha256:2f8859e507a6accf30c657054fac6b90f8bbb8415f0fb735d446de5325e07bc4');
a.equal(originals.notification_worker.image, originals.api.image);
const oldVersion = originals.api.environment.APP_VERSION.replace(/^v/, '');
a.match(oldVersion, /^\d+\.\d+\.\d+$/);
const before = oldVersion.split('.').map(Number);
a.ok(version.split('.').map(Number).reduce((result, value, i) => result || Math.sign(value - before[i]), 0) > 0, 'Release version must increase');
a.equal(originals.api.environment.COMMUNICATION_IMMEDIATE_DELIVERY, 'true');
const save = (name, data) => fs.writeFileSync(`${root}/${name}`, data, { flag: 'wx', mode: 0o600 });
save('rollback.private.json', JSON.stringify(c, null, 2));
const rollback = structuredClone(c);
for (const key of ['api', 'notification_worker', 'web']) {
  const role = key === 'web' ? 'web' : 'api';
  const image = fs.readFileSync(`${root}/${role}-image.id`, 'utf8').trim();
  a.match(image, /^sha256:[a-f0-9]{64}$/);
  const imageEnv = env(inspect(image));
  a.equal(imageEnv.COMMIT_SHA, sha);
  a.equal(imageEnv.APP_VERSION, version);
  const service = c.services[key];
  service.image = image;
  for (const name of ['COMMIT_SHA', 'APP_VERSION', 'BUILD_ID', 'BUILD_TIME']) service.environment[name] = imageEnv[name];
  if (key !== 'web') {
    for (const name of ['RUN_DB_MIGRATIONS', 'SYSTEM_BACKUP_ENABLED', 'SYSTEM_UPDATE_ALLOW_SWITCH', 'ALLOW_REGISTRATION']) a.equal(service.environment[name], 'false');
    a.equal(service.environment.DISABLE_SCHEDULED_JOBS, 'true');
    a.equal(service.environment.DISABLE_DEPOSIT_OUTBOX, 'true');
  }
}
const configurationAudit = auditConfiguration(rollback, c);
save('compose.private.json', JSON.stringify(c, null, 2));
save('api.private.env', Object.entries(c.services.api.environment).map(([key, value]) => {
  a.ok(!/[\r\n]/.test(String(value))); return `${key}=${value}`;
}).join('\n') + '\n');
const redacted = structuredClone(c);
for (const service of Object.values(redacted.services)) {
  a.ok(!service.privileged && !service.network_mode && !service.cap_add);
  a.ok(!(service.volumes || []).some(mount => mount.includes('docker.sock')));
  if (service.environment) service.environment = Object.fromEntries(Object.keys(service.environment).map(key => [key, 'REDACTED']));
}
save('docker-compose.audit.yml', JSON.stringify(redacted, null, 2));
save('configuration-audit.json', JSON.stringify(configurationAudit, null, 2));
save('configuration-audit.sha', ['compose.private.json', 'rollback.private.json', 'api.private.env', 'docker-compose.audit.yml', 'configuration-audit.json', 'source.sha', 'api-image.id', 'web-image.id', 'ci-gate.json'].map(name =>
  `${crypto.createHash('sha256').update(fs.readFileSync(`${root}/${name}`)).digest('hex')}  ${name}`
).join('\n') + '\n');
console.log(JSON.stringify({ version, source: sha, project: c.name, databaseAndVolumesPreserved: true }));
