const fs = require('node:fs');
const a = require('node:assert/strict');
const key = 'AAAAC3NzaC1lZDI1NTE5AAAAIGEABPtstPfbQ7uaE0n/WPfpuikfUx2tRC7q/PdjsR88';
let removed = 0;
for (const file of ['/root/.ssh/authorized_keys', '/var/services/homes/tcandt/.ssh/authorized_keys']) {
  if (!fs.existsSync(file)) continue;
  const original = fs.readFileSync(file, 'utf8');
  const lines = original.split('\n');
  const retained = lines.filter(line => !line.split(/\s+/).includes(key));
  const count = lines.length - retained.length;
  if (count) {
    const before = fs.statSync(file);
    fs.writeFileSync(file, retained.join('\n'), { mode: 0o600 });
    fs.chmodSync(file, 0o600);
    fs.chownSync(file, before.uid, before.gid);
    a.ok(!fs.readFileSync(file, 'utf8').split(/\s+/).includes(key));
    removed += count;
  }
}
console.log(JSON.stringify({ temporaryKeyRemoved: removed, otherKeysPreserved: true }));
