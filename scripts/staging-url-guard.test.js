const test = require('node:test');
const assert = require('node:assert/strict');
const { assertStagingUrl } = require('./staging-url-guard');
const origins = 'https://staging.example.test,https://staging-api.example.test:8443';
test('only exact approved HTTPS origins are accepted', () => {
  assert.equal(assertStagingUrl('https://staging.example.test/', origins), 'https://staging.example.test');
  assert.equal(assertStagingUrl('https://staging-api.example.test:8443', origins), 'https://staging-api.example.test:8443');
});
test('rejects transport, host, port, userinfo and path confusion before token requests', () => {
  for (const url of [
    'http://staging.example.test', 'https://evil.test', 'https://staging.example.test.evil.test',
    'https://staging.example.test:8443', 'https://staging.example.test@evil.test',
    'https://user:secret@staging.example.test', 'https://staging.example.test/api',
    'https://staging.example.test?x=1', 'https://staging.example.test#fragment',
  ]) assert.throws(() => assertStagingUrl(url, origins), /BLOCKED/);
});
test('requires canonical approved origin configuration', () => {
  for (const config of ['', 'http://staging.example.test', 'https://staging.example.test/', 'https://staging.example.test/path']) {
    assert.throws(() => assertStagingUrl('https://staging.example.test', config), /BLOCKED/);
  }
});
