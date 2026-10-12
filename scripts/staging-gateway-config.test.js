const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildConfig } = require('./staging-gateway-config');
test('requires an injection-safe full random admission secret', () => {
  for (const invalid of ['', 'short', 'a'.repeat(63), 'a'.repeat(64) + ';', undefined]) {
    assert.throws(() => buildConfig(invalid), /32-byte/);
  }
});
test('cookie admission does not consume the application Authorization header', () => {
  const config = buildConfig('a'.repeat(64));
  const app = config.slice(config.indexOf('    location / {'));
  assert.match(app, /if \(\$staging_admitted = 0\) \{ return 403; \}/);
  assert.doesNotMatch(app, /auth_basic|proxy_set_header Authorization/);
  assert.match(config, /Secure; HttpOnly; SameSite=Strict; Max-Age=14400/);
  assert.doesNotMatch(config, /Set-Cookie[^\n]+always/);
});
test('only four exact existing health routes bypass admission; no broad API bypass', () => {
  const config = buildConfig('b'.repeat(64));
  assert.equal((config.match(/location = \/api\/v1\/health/g) || []).length, 4);
  assert.doesNotMatch(config, /location \/api|location ~|location \^~/);
  assert.match(config, /location = \/__staging\/access[\s\S]+auth_basic_user_file/);
});
