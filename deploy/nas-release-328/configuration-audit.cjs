const a = require('node:assert/strict');

const identities = ['COMMIT_SHA', 'APP_VERSION', 'BUILD_ID', 'BUILD_TIME'];
function auditConfiguration(rollback, candidate) {
  const normalized = structuredClone(candidate);
  for (const name of ['api', 'notification_worker', 'web']) {
    const current = normalized.services[name];
    const previous = rollback.services[name];
    a.ok(current && previous, `Missing application service: ${name}`);
    a.match(current.image, /^sha256:[a-f0-9]{64}$/);
    current.image = previous.image;
    for (const key of identities) {
      a.ok(typeof current.environment[key] === 'string' && current.environment[key], `Missing build identity: ${name}.${key}`);
      if (Object.hasOwn(previous.environment, key)) current.environment[key] = previous.environment[key];
      else delete current.environment[key];
    }
  }
  a.deepEqual(normalized, rollback, 'Only application images and build identity may change');
  for (const service of Object.values(candidate.services)) {
    a.ok(!service.privileged && !service.network_mode && !service.cap_add, 'Unsafe service privileges');
    a.ok(!(service.volumes || []).some(mount => JSON.stringify(mount).includes('docker.sock')), 'Docker socket mount forbidden');
  }
  return { status: 'PASS', allowedChanges: ['application images', ...identities], settingsAndStoragePreserved: true };
}
module.exports = { auditConfiguration };
