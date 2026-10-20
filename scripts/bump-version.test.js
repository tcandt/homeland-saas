const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

function fixture(work) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-version-test-'));
  for (const dir of ['scripts', 'apps/api', 'apps/web']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'bump-version.js'), path.join(root, 'scripts/bump-version.js'));
  for (const file of ['package.json', 'apps/api/package.json', 'apps/web/package.json']) {
    fs.writeFileSync(path.join(root, file), JSON.stringify({ version: '3.2.0' }));
  }
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ version: '3.2.0', packages: { '': {}, 'apps/api': {}, 'apps/web': {} } }));
  const run = (...args) => cp.spawnSync(process.execPath, [path.join(root, 'scripts/bump-version.js'), ...args], { encoding: 'utf8' });
  try { work(root, run); } finally { fs.rmSync(root, { recursive: true }); }
}
test('default release increments patch and keeps manifests/lockfile in sync', () => fixture((root, run) => {
  assert.equal(run().status, 0);
  for (const file of ['package.json', 'apps/api/package.json', 'apps/web/package.json', 'package-lock.json']) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, file))).version, '3.2.1');
  }
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')));
  for (const pkg of Object.values(lock.packages)) assert.equal(pkg.version, '3.2.1');
  assert.equal(run().status, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version, '3.2.2');
}));
test('rejects same, older and malformed explicit release versions before writing', () => fixture((root, run) => {
  for (const version of ['3.2.0', '3.1.9', 'invalid']) {
    assert.notEqual(run(version).status, 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version, '3.2.0');
  }
  assert.equal(run('sync').status, 0);
}));
test('rejects an incomplete lockfile before changing version manifests', () => fixture((root, run) => {
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ packages: {} }));
  assert.notEqual(run().status, 0);
  for (const file of ['package.json', 'apps/api/package.json', 'apps/web/package.json']) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, file))).version, '3.2.0');
  }
}));
