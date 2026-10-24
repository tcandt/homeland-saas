const fs = require('node:fs');
const path = require('node:path');
const names = ['activate.sh', 'build.sh', 'ci.cjs', 'config.cjs', 'integrity.cjs', 'ops.test.cjs', 'preflight.cjs', 'revoke-key.cjs', 'status.cjs', 'ui.browser.cjs', 'verify.cjs'];
for (const name of names) {
  let source = fs.readFileSync(path.join(__dirname, '../nas-release-326', name), 'utf8');
  source = source.replaceAll('release-326', 'release-328').replaceAll('3.2.6', '3.2.9').replaceAll('3_2_6', '3_2_9').replaceAll('20261021', '20261024');
  if (['config.cjs', 'preflight.cjs', 'ops.test.cjs'].includes(name)) {
    source = source.replaceAll('3.2.3', '3.2.6')
      .replaceAll('sha256:ddf12736c2a1e8365a559363c51b15795b14e4ac11525e95278025ad163e1944', 'sha256:bd778691b756a1d815d253e916ec7755d51599be6ca282c0bdc3cd6290a1ab37')
      .replaceAll('sha256:d2c980c53af894e94068007d41d370e5762def3dca5cd869976c2cda0792175e', 'sha256:2f8859e507a6accf30c657054fac6b90f8bbb8415f0fb735d446de5325e07bc4');
    if (name === 'ops.test.cjs') source = source.replace("configure('3.2.7')", "configure('3.2.9')");
  }
  source = source.replace('# Bounded fail-forward: old billing code cannot interpret newly imported\r\n    # opening balances. Keep the new image set and retry its service startup.', '# Bounded fail-forward: users may have written data after publication.\r\n    # Keep the new image set and retry its service startup.');
  source = source.replace('# After publishing, never restore an older application automatically: a real\r\n# user may already have imported opening balances the old code cannot honor.', '# After publication, users may have written data using the new application.\r\n# Avoid restoring an older application automatically.');
  fs.writeFileSync(path.join(__dirname, name), source, { flag: 'wx' });
}
console.log('Prepared release 3.2.9 scripts.');
