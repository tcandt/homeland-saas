const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseArguments, runCleanup } = require('./cleanup-workspace');

test('cleanup dry-run reports removable paths without deleting them', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-cleanup-'));
  const target = path.join(root, '.codex-runtime');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'heartbeat.json'), '{"ok":true}', 'utf8');

  const result = runCleanup({ apply: false, json: false }, root);
  assert.equal(result.applied, false);
  assert.ok(result.actions.some((action) => action.path === '.codex-runtime'));
  assert.equal(fs.existsSync(target), true);
});

test('cleanup apply removes matching targets', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-cleanup-'));
  const target = path.join(root, 'apps', 'api', 'dist');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'main.js'), 'console.log("ok")', 'utf8');

  const result = runCleanup({ apply: true, json: false }, root);
  assert.equal(result.applied, true);
  assert.ok(result.actions.some((action) => action.path === 'apps/api/dist'));
  assert.equal(fs.existsSync(target), false);
});

test('cleanup parser accepts apply/json flags', () => {
  assert.deepEqual(parseArguments(['--apply', '--json']), { apply: true, json: true });
});
