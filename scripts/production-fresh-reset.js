const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const schemaPath = join('packages', 'database', 'prisma', 'schema.prisma');
const migrationsPath = join('packages', 'database', 'prisma', 'migrations');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function runPrisma(args) {
  const result = spawnSync(npxCommand, ['prisma', ...args], {
    env: { ...process.env, SEED_MODE: 'production' },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// The historical migration chain contains legacy transitions that are not
// replayable on an empty database. Build the exact current schema first, then
// baseline every reviewed migration so future `migrate deploy` runs normally.
runPrisma(['db', 'push', '--schema', schemaPath, '--force-reset']);

const migrationNames = readdirSync(migrationsPath, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (migrationNames.length === 0) {
  throw new Error('No Prisma migrations were found to baseline.');
}

for (const migrationName of migrationNames) {
  runPrisma(['migrate', 'resolve', '--schema', schemaPath, '--applied', migrationName]);
}

runPrisma(['db', 'seed', '--schema', schemaPath]);
console.log(`Fresh production database ready; baselined ${migrationNames.length} migrations.`);
