const { test } = require('node:test');
const assert = require('node:assert/strict');
const { admissionStorageState } = require('./staging-admission');
const env = { E2E_STAGING_ADMISSION_COOKIE: 'homeland_staging_access=' + 'a'.repeat(64), E2E_STAGING_ORIGINS: 'https://staging.example.test' };
test('admission uses a secure scoped cookie, not Authorization or global headers', () => {
  const options = admissionStorageState('https://staging.example.test', env);
  assert.equal(options.storageState.cookies[0].domain, 'staging.example.test');
  assert.equal(options.storageState.cookies[0].secure, true);
  assert.equal(options.storageState.cookies[0].httpOnly, true);
  assert.equal(options.storageState.cookies[0].sameSite, 'Strict');
  assert.equal(options.extraHTTPHeaders, undefined);
});
test('no cookie sent to HTTP or unapproved HTTPS targets', () => {
  assert.deepEqual(admissionStorageState('http://127.0.0.1:43294', env), {});
  assert.throws(() => admissionStorageState('https://evil.example', env), /approved/);
  assert.throws(() => admissionStorageState('https://staging.example.test', { ...env, E2E_STAGING_ADMISSION_COOKIE: 'malformed' }), /Invalid/);
  assert.deepEqual(admissionStorageState('https://staging.example.test', {}), {});
});
