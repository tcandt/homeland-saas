const fs = require('node:fs');
const a = require('node:assert/strict');
const cp = require('node:child_process');
const { randomUUID } = require('node:crypto');
const key = 'AAAAC3NzaC1lZDI1NTE5AAAAIGEABPtstPfbQ7uaE0n/WPfpuikfUx2tRC7q/PdjsR88'; // gitleaks:allow -- public SSH key, used only for revocation
const currentKey = 'AAAAC3NzaC1lZDI1NTE5AAAAICEAXMlC7y5sNi4l5l4goZi5mTjUCrq6LZ39aK+ZNjRE'; // gitleaks:allow -- public SSH key, used only for revocation
function revokeUnlocked(file, io = fs) {
  if (!io.existsSync(file)) return 0;
  const lockPath = `${file}.revoke.lock`;
  let lockDescriptor;
  let lockOwned = false;
  let descriptor;
  let owned = false;
  let temporary;
  try {
    lockDescriptor = io.openSync(lockPath, 'wx', 0o600);
    lockOwned = true;
    io.fchmodSync(lockDescriptor, 0o600);
    const before = io.lstatSync(file);
    a.ok(before.isFile(), 'authorized_keys must be a regular file');
    const original = io.readFileSync(file, 'utf8');
    const lines = original.split('\n');
    const retained = lines.filter(line => ![key, currentKey].some(value => line.split(/\s+/).includes(value)));
    const count = lines.length - retained.length;
    if (!count) return 0;
    const content = retained.join('\n');
    temporary = `${file}.revoke-${randomUUID()}`;
    descriptor = io.openSync(temporary, 'wx', 0o600);
    owned = true;
    io.fchownSync(descriptor, before.uid, before.gid);
    io.fchmodSync(descriptor, 0o600);
    io.writeFileSync(descriptor, content, 'utf8');
    io.fsyncSync(descriptor);
    io.closeSync(descriptor);
    descriptor = undefined;
    a.equal(io.readFileSync(temporary, 'utf8'), content, 'retained keys verification failed');
    const latest = io.lstatSync(file);
    a.ok(latest.isFile() && latest.ino === before.ino && latest.dev === before.dev &&
      latest.size === before.size && latest.mtimeMs === before.mtimeMs &&
      io.readFileSync(file, 'utf8') === original, 'authorized_keys changed during revocation');
    // The kernel lock held by the parent wrapper prevents cooperating writers
    // from changing the target while this compare-and-rename completes. The
    // sidecar remains as a second guard for callers that use this helper with
    // an injected filesystem in tests.
    io.renameSync(temporary, file);
    owned = false;
    const published = io.readFileSync(file, 'utf8');
    a.equal(published, content, 'authorized_keys changed during revocation');
    return count;
  } finally {
    if (descriptor !== undefined) io.closeSync(descriptor);
    if (owned && temporary) io.unlinkSync(temporary);
    if (lockDescriptor !== undefined) io.closeSync(lockDescriptor);
    if (lockOwned) io.unlinkSync(lockPath);
  }
}
function revokeFile(file, io = fs) {
  // On NAS/Linux, hold an advisory kernel lock for the complete read,
  // compare, and rename sequence. The deployment owner must ensure all SSH
  // key writers use the same lock; otherwise no user-space implementation can
  // prevent an unrelated process from replacing the file concurrently.
  if (io === fs && process.platform !== 'win32' && process.env.HOMELAND_REVOKE_LOCKED !== '1') {
    const result = cp.spawnSync('flock', ['-n', file, process.execPath, __filename, '--locked', file], { encoding: 'utf8' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error((result.stderr || '').trim() || `flock failed for ${file}`);
    const count = Number((result.stdout || '').trim());
    a.ok(Number.isInteger(count) && count >= 0, 'invalid revocation result');
    return count;
  }
  return revokeUnlocked(file, io);
}
module.exports = { revokeFile };
if (!module.parent) {
  if (process.argv[2] === '--locked') {
    process.env.HOMELAND_REVOKE_LOCKED = '1';
    console.log(revokeUnlocked(process.argv[3]));
    return;
  }
  let removed = 0;
  for (const file of ['/root/.ssh/authorized_keys', '/var/services/homes/tcandt/.ssh/authorized_keys']) {
    removed += revokeFile(file);
  }
  console.log(JSON.stringify({ temporaryKeyRemoved: removed, otherKeysPreserved: true }));
}
