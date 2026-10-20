const fs = require('node:fs');
const assert = require('node:assert/strict');
const config = JSON.parse(fs.readFileSync('/volume1/docker/homeland/release-4fc77db1/checkout-87aa2457/compose.private.json'));
for (const service of Object.values(config.services)) {
  assert.match(service.image, /^sha256:[a-f0-9]{64}$/);
  assert.ok(!service.privileged && !service.network_mode && !service.cap_add);
  assert.ok(!(service.volumes || []).some(x => x.includes('docker.sock')));
  if (service.environment) service.environment = Object.fromEntries(Object.keys(service.environment).map(key => [key, 'REDACTED']));
}
assert.deepEqual(config.services.web.ports, ['127.0.0.1:3004:3000']);
assert.ok(Object.entries(config.services).filter(([key]) => key !== 'web').every(([, service]) => !service.ports));
console.log(JSON.stringify(config));
