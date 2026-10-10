const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRuntimeAudit } = require('./runtime-audit-policy');

const report = (overrides = {}) => ({ metadata: { vulnerabilities: { info: 0, low: 1, moderate: 2, high: 0, critical: 0, total: 3, ...overrides } } });
test('audit preserves raw severity counts rather than suppressing findings', () => {
  const raw = report();
  const before = JSON.stringify(raw);
  assert.deepEqual(validateRuntimeAudit(raw), raw.metadata.vulnerabilities);
  assert.equal(JSON.stringify(raw), before);
});
test('high and critical runtime vulnerabilities block release', () => {
  assert.throws(() => validateRuntimeAudit(report({ high: 1, total: 4 })), /blocks release/);
  assert.throws(() => validateRuntimeAudit(report({ critical: 1, total: 4 })), /blocks release/);
});
test('unavailable, incomplete, negative, misleading or malformed audit reports cannot pass', () => {
  for (const raw of [null, {}, { error: { code: 'ENOTFOUND' } }, { metadata: { vulnerabilities: { high: 0, critical: 0 } } }, report({ high: -1 }), report({ high: '0' }), report({ total: 0 })]) {
    assert.throws(() => validateRuntimeAudit(raw));
  }
});
