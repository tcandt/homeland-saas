const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const snapshot = JSON.parse(fs.readFileSync('/release/retained.private.json'));
const paths = new Set();
function visit(value, tenantId) {
  if (typeof value === 'string' && value.startsWith('document-storage://')) {
    const relative = value.slice('document-storage://'.length);
    const parts = relative.split('/');
    assert.ok(parts.length >= 3 && parts.every(x => x && x !== '.' && x !== '..' && !x.includes('\\')));
    assert.equal(parts[0], tenantId, 'Settings asset tenant mismatch');
    if (['avatars', 'business', 'settings'].includes(parts[1])) paths.add(relative);
  } else if (Array.isArray(value)) value.forEach(child => visit(child, tenantId));
  else if (value && typeof value === 'object') Object.values(value).forEach(child => visit(child, tenantId));
}
snapshot.AppSetting.forEach(row => visit(row.value, row.tenantId));
const manifest = [];
for (const relative of [...paths].sort()) {
  const source = path.resolve('/source', relative);
  const target = path.resolve('/target', relative);
  assert.ok(source.startsWith('/source/') && target.startsWith('/target/'));
  assert.equal(fs.realpathSync(source), source, 'Settings asset source symlink forbidden');
  assert.ok(fs.lstatSync(source).isFile());
  const buffer = fs.readFileSync(source);
  if (process.argv[2] === 'copy') {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buffer, { mode: 0o644, flag: 'wx' });
  } else assert.equal(process.argv[2], 'verify');
  assert.ok(fs.realpathSync(target).startsWith('/target/'));
  assert.deepEqual(fs.readFileSync(target), buffer);
  manifest.push({ relative, sha256: crypto.createHash('sha256').update(buffer).digest('hex') });
}
console.log(JSON.stringify({ status: 'PASS', referencedSettingsAssets: manifest }));
