const fs = require('node:fs');
const cp = require('node:child_process');
const a = require('node:assert/strict');
const root = '/volume1/docker/homeland/release-322-20261021-r3';
const docker = args => cp.execFileSync('/usr/local/bin/docker', args, { encoding: 'utf8' });
const sha = fs.readFileSync(`${root}/source.sha`, 'utf8').trim();
a.match(sha, /^[a-f0-9]{40}$/);
const version = '3.2.2';
const c = JSON.parse(fs.readFileSync('/volume1/docker/homeland/release-4fc77db1/checkout-87aa2457/compose.private.json'));
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
a.equal(originals.api.image, 'sha256:8f99a37dc3fb23c2cef11d1fc93966447f0dc42a20b7fe0931fc9591a8760d1b');
a.equal(originals.web.image, 'sha256:e3087c3932a66b8eba5773e304290c147cf37f75989536610978998661352c6b');
a.equal(originals.notification_worker.image, originals.api.image);
const oldVersion = originals.api.environment.APP_VERSION.replace(/^v/, '');
a.match(oldVersion, /^\d+\.\d+\.\d+$/);
const before = oldVersion.split('.').map(Number);
a.ok(version.split('.').map(Number).reduce((result, value, i) => result || Math.sign(value - before[i]), 0) > 0, 'Release version must increase');
const save = (name, data) => fs.writeFileSync(`${root}/${name}`, data, { flag: 'wx', mode: 0o600 });
save('rollback.private.json', JSON.stringify(c, null, 2));
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
console.log(JSON.stringify({ version, source: sha, project: c.name, databaseAndVolumesPreserved: true }));
