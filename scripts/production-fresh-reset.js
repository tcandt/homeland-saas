const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const schemaPath = join('packages', 'database', 'prisma', 'schema.prisma');
const migrationsPath = join('packages', 'database', 'prisma', 'migrations');
const prismaCli = require.resolve('prisma/build/index.js');

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
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

// Run the same seed directly instead of asking a package manager to find tsx.
const seed = spawnSync(process.execPath, [require.resolve('tsx/cli'), join('packages', 'database', 'prisma', 'seed.ts')], {
  env: { ...process.env, SEED_MODE: 'production' },
  stdio: 'inherit',
});
if (seed.error) throw seed.error;
if (seed.status !== 0) process.exit(seed.status ?? 1);
console.log(`Fresh production database ready; baselined ${migrationNames.length} migrations.`);
