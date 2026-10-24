const cp = require('node:child_process');
const a = require('node:assert/strict');
const docker = args => cp.execFileSync('/usr/local/bin/docker', args, { encoding: 'utf8' });
const api = JSON.parse(docker(['inspect', 'homeland_checkout_87aa2457_api']))[0];
const env = Object.fromEntries(api.Config.Env.map(line => {
  const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)];
}));
a.equal(env.APP_VERSION, '3.2.14');
a.equal(env.COMMUNICATION_IMMEDIATE_DELIVERY, 'true');
for (const key of ['RUN_DB_MIGRATIONS', 'SYSTEM_BACKUP_ENABLED', 'SYSTEM_UPDATE_ALLOW_SWITCH']) a.equal(env[key], 'false');
for (const key of ['DISABLE_SCHEDULED_JOBS', 'DISABLE_DEPOSIT_OUTBOX']) a.equal(env[key], 'true');
a.equal(api.State.Status, 'running');
const counts = docker(['exec', 'homeland_checkout_87aa2457_postgres', 'psql', '-U', 'homeland_staging', '-d', 'homeland_staging', '-Atc',
  'SELECT (SELECT count(*) FROM "Building" WHERE "deletedAt" IS NULL), (SELECT count(*) FROM "Room" WHERE "deletedAt" IS NULL), (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)']).trim();
a.equal(counts, '4|34|37');
console.log(JSON.stringify({ status: 'PASS', version: env.APP_VERSION, immediateDelivery: true, backgroundDrainDisabled: true, buildings: 4, rooms: 34, migrations: 37 }));
