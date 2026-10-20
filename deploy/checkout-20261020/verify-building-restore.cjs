const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { makePlan, restoreSQL } = require('./restore-buildings.cjs');
const name = `homeland-inventory-test-${crypto.randomBytes(6).toString('hex')}`;
const docker = (args, input) => cp.execFileSync('/usr/local/bin/docker', args, { input, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
const query = (pg, sql) => docker(['exec', '-i', pg, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'homeland_staging', '-d', 'homeland_staging'], sql);
let created = false;
try {
  const source = {};
  for (const table of ['Building', 'Floor', 'Room', 'HunonicMeterMapping']) {
    source[table] = JSON.parse(query('homeland_release_320_postgres', `SELECT COALESCE(json_agg(to_jsonb(t)), '[]'::json) FROM "${table}" t;`).trim());
  }
  const plan = makePlan(source);
  const image = docker(['inspect', 'homeland_checkout_87aa2457_postgres', '--format', '{{.Image}}']).trim();
  const password = crypto.randomBytes(32).toString('hex');
  docker(['run', '-d', '--name', name, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_USER=homeland_staging', '-e', 'POSTGRES_DB=homeland_staging', image]);
  created = true;
  docker(['exec', name, 'sh', '-c', 'for i in $(seq 1 60); do pg_isready -U homeland_staging -d homeland_staging >/dev/null && exit 0; sleep 1; done; exit 1']);
  // Clone to a no-network/no-volume disposable DB; never execute the restore on live here.
  const dump = docker(['exec', 'homeland_checkout_87aa2457_postgres', 'pg_dump', '-U', 'homeland_staging', '-d', 'homeland_staging', '--no-owner', '--no-privileges']);
  query(name, dump);
  const result = query(name, restoreSQL(plan));
  const report = JSON.parse(result.trim().split('\n').at(-1));
  assert.equal(report.status, 'PASS');
  assert.equal(report.buildings, 4);
  assert.equal(report.floors, 16);
  assert.equal(report.rooms, 34);
  assert.equal(report.customers, 0);
  assert.equal(report.contracts, 0);
  let refused = false;
  try { query(name, restoreSQL(plan)); } catch { refused = true; }
  assert.ok(refused, 'Second application must fail closed');
  assert.equal(query(name, 'SELECT count(*) FROM "Room";').trim(), '34');
  console.log(JSON.stringify({ ...report, reapplicationRefused: true, disposableOnly: true }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (created) { try { docker(['rm', '-f', name]); } catch { process.exitCode = 1; } }
}
