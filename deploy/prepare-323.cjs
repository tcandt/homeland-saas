const fs = require('node:fs');
const path = require('node:path');
const out = path.join(__dirname, 'nas-release-323');
fs.mkdirSync(out, { recursive: true });
for (const file of ['build.sh', 'activate.sh', 'config.cjs', 'verify.cjs', 'ci.cjs', 'status.cjs', 'integrity.cjs', 'ops.test.cjs', 'learning-runtime.sh']) {
  let source = fs.readFileSync(path.join(__dirname, 'nas-release-322', file), 'utf8')
    .replaceAll('release-322-20261021-r3', 'release-323-20261021')
    .replaceAll('3.2.3', '3.2.4').replaceAll('3.2.2', '3.2.3').replaceAll('3.2.1', '3.2.2')
    .replaceAll('3_2_2', '3_2_3');
  if (['config.cjs', 'ops.test.cjs'].includes(file)) {
    source = source
      .replaceAll('sha256:8f99a37dc3fb23c2cef11d1fc93966447f0dc42a20b7fe0931fc9591a8760d1b', 'sha256:93b14189378d6465ca9bc5a9128ae82120f631d964c3a2d187a919b10d59906c')
      .replaceAll('sha256:e3087c3932a66b8eba5773e304290c147cf37f75989536610978998661352c6b', 'sha256:bb5cdc390825f7b5bd638f9ba9e4f9ef0a1182e2ae6fd35a65ebd783eefcda08');
  }
  if (file === 'config.cjs') source = source.replace("const save =", "a.equal(originals.api.environment.COMMUNICATION_IMMEDIATE_DELIVERY, 'true');\nconst save =");
  if (file === 'ops.test.cjs') source = source.replace("CUSTOM_SETTING: 'preserved',", "CUSTOM_SETTING: 'preserved', COMMUNICATION_IMMEDIATE_DELIVERY: 'true',");
  fs.writeFileSync(path.join(out, file), source.replaceAll('\r\n', '\n'), { flag: 'wx' });
}
