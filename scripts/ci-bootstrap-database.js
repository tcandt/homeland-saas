const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const schema = path.join(root, 'packages/database/prisma/schema.prisma');
const migrationsRoot = path.join(root, 'packages/database/prisma/migrations');
const prismaCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const contractMigrations = [
  ['20260706150701_auth_foundation', 'de6f66324ab7c6caa449ceeb86b1cbf5bbcd96f69b95840ae19bd7a371683d1e'],
  ['20260708042302_expand_contract_status', '4f9a58f6e09dca855127be278fe182b7915e1009ff4946f056de64c2eca396fb'],
  ['20260708065702_migrate_legacy_contract_statuses', '62bea64fae79dde0f483fcaf8297ff2ca6b5da61cc04c743a96748450e2e46cc'],
  ['20260708000000_remove_legacy_ended_status', '61d1658b84113de9a4709b102f6eafbb1eda9e734de0a456b3037ef67573e759'],
];

function assertDisposableCiDatabase() {
  if (
    process.env.CI !== 'true'
    || process.env.GITHUB_ACTIONS !== 'true'
    || process.env.CI_DATABASE_BOOTSTRAP !== 'true'
    || process.env.RUN_DESTRUCTIVE_E2E !== 'true'
  ) {
    throw new Error('CI database bootstrap is restricted to the destructive GitHub Actions integration job.');
  }

  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  const allowedHosts = new Set(['localhost', '127.0.0.1']);
  if (
    databaseUrl.protocol !== 'postgresql:'
    || !allowedHosts.has(databaseUrl.hostname)
    || databaseUrl.port !== '5433'
    || databaseUrl.username !== 'homeland'
    || databaseUrl.pathname !== '/homeland'
  ) {
    throw new Error('CI database bootstrap requires the disposable localhost:5433/homeland database.');
  }
}

function runPrisma(args) {
  execFileSync(prismaCommand, ['prisma', ...args], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
}

function migrationFile(name) {
  return path.join(migrationsRoot, name, 'migration.sql');
}

function verifyMigration(name, expectedHash) {
  const file = migrationFile(name);
  const actualHash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (actualHash !== expectedHash) {
    throw new Error(`Refusing CI bootstrap because ${name} no longer matches its reviewed checksum.`);
  }
  return file;
}

function main() {
  assertDisposableCiDatabase();

  // The legacy-removal migration was committed later with an earlier timestamp.
  // Apply the immutable SQL files in their logical order, then let Prisma deploy
  // the remaining migrations normally.
  for (const [name, expectedHash] of contractMigrations) {
    const file = verifyMigration(name, expectedHash);
    runPrisma(['db', 'execute', '--file', file, '--schema', schema]);
    runPrisma(['migrate', 'resolve', '--applied', name, '--schema', schema]);
  }

  runPrisma(['migrate', 'deploy', '--schema', schema]);
  runPrisma(['migrate', 'status', '--schema', schema]);
}

if (require.main === module) {
  main();
}

module.exports = { assertDisposableCiDatabase, contractMigrations };
