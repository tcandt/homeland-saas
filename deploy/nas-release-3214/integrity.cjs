const fs = require('node:fs');
const cp = require('node:child_process');
const a = require('node:assert/strict');
const root = '/volume1/docker/homeland/release-3214-20261024';
const state = {};
for (const table of ['Building', 'Floor', 'Room', 'AppSetting', 'HunonicMeterMapping', '_prisma_migrations']) {
  const sql = `SELECT count(*), md5(COALESCE(string_agg(row::text, '' ORDER BY row::text), '')) FROM (SELECT to_jsonb(t) AS row FROM "${table}" t) x`;
  state[table] = cp.execFileSync('/usr/local/bin/docker', ['exec', 'homeland_checkout_87aa2457_postgres', 'psql', '-U', 'homeland_staging', '-d', 'homeland_staging', '-Atc', sql], { encoding: 'utf8' }).trim();
}
const file = `${root}/protected-data.before.json`;
if (process.argv[2] === 'before') fs.writeFileSync(file, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
else {
  a.deepEqual(state, JSON.parse(fs.readFileSync(file, 'utf8')), 'Protected data changed during image update');
  console.log(JSON.stringify({ status: 'PASS', protectedTables: Object.keys(state), fullRowHashesUnchanged: true }));
}
