const fs = require('node:fs');
const path = require('node:path');
const names = ['activate.sh', 'build.sh', 'ci.cjs', 'config.cjs', 'integrity.cjs', 'ops.test.cjs', 'preflight.cjs', 'revoke-key.cjs', 'status.cjs', 'ui.browser.cjs', 'verify.cjs'];
for (const name of names) {
  let source = fs.readFileSync(path.join(__dirname, '../nas-release-323', name), 'utf8');
  source = source.replaceAll('release-323', 'release-326').replaceAll('3.2.3', '3.2.6').replaceAll('3_2_3', '3_2_6');
  if (['config.cjs', 'preflight.cjs', 'ops.test.cjs'].includes(name)) {
    source = source.replaceAll('3.2.2', '3.2.3')
      .replaceAll('sha256:93b14189378d6465ca9bc5a9128ae82120f631d964c3a2d187a919b10d59906c', 'sha256:ddf12736c2a1e8365a559363c51b15795b14e4ac11525e95278025ad163e1944')
      .replaceAll('sha256:bb5cdc390825f7b5bd638f9ba9e4f9ef0a1182e2ae6fd35a65ebd783eefcda08', 'sha256:d2c980c53af894e94068007d41d370e5762def3dca5cd869976c2cda0792175e');
    // The negative test must still exercise a downgrade from the new release.
    if (name === 'ops.test.cjs') source = source.replace("configure('3.2.4')", "configure('3.2.7')");
  }
  fs.writeFileSync(path.join(__dirname, name), source, { flag: 'wx' });
}
console.log('Prepared release3.2.6 scripts; existing deployment scripts unchanged.');
