const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const smoke = path.join(__dirname, 'api-smoke.cjs');
function load(context, origin) {
  const env = { ...process.env };
  delete env.PREVIEW_SMOKE_CONTEXT;
  delete env.PREVIEW_SMOKE_ORIGIN;
  if (context !== undefined) env.PREVIEW_SMOKE_CONTEXT = context;
  if (origin !== undefined) env.PREVIEW_SMOKE_ORIGIN = origin;
  return spawnSync(process.execPath, ['-e', `require(${JSON.stringify(smoke)})`], { env, encoding: 'utf8' }).status;
}
test('missing context or origin is refused without making requests', () => {
  assert.notEqual(load(), 0);
  assert.notEqual(load('v4-api-container'), 0);
});
test('host/public origin cannot be confused with a v4 API namespace', () => {
  assert.notEqual(load('v4-api-container', 'https://homeland.ductinh.one'), 0);
  assert.notEqual(load('v4-api-container', 'http://127.0.0.1:3002'), 0);
});
test('only explicitly selected container routes are accepted', () => {
  assert.equal(load('v4-api-container', 'http://127.0.0.1:3001'), 0);
  assert.equal(load('v4-api-to-web', 'http://web:3000'), 0);
  assert.notEqual(load('v4-api-to-web', 'http://127.0.0.1:3001'), 0);
});
