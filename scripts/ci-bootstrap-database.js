const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const schema = path.join(root, 'packages/database/prisma/schema.prisma');
const migrationsRoot = path.join(root, 'packages/database/prisma/migrations');
const prismaCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const generatedSchemaSql = path.join(root, '.tmp-ci-bootstrap-schema.sql');

const reviewedMigrations = [
  ['20260706150701_auth_foundation', 'de6f66324ab7c6caa449ceeb86b1cbf5bbcd96f69b95840ae19bd7a371683d1e'], // gitleaks:allow - reviewed migration checksum
  ['20260708000000_remove_legacy_ended_status', '61d1658b84113de9a4709b102f6eafbb1eda9e734de0a456b3037ef67573e759'], // gitleaks:allow - reviewed migration checksum
  ['20260708042302_expand_contract_status', '4f9a58f6e09dca855127be278fe182b7915e1009ff4946f056de64c2eca396fb'], // gitleaks:allow - reviewed migration checksum
  ['20260708065702_migrate_legacy_contract_statuses', '62bea64fae79dde0f483fcaf8297ff2ca6b5da61cc04c743a96748450e2e46cc'], // gitleaks:allow - reviewed migration checksum
  ['20260809000000_add_hunonic_meter_sync', '44e4cdbc0085fdfcfea64c1f1ed8e3fe4bd8bc372791eef8e59865b603917b97'], // gitleaks:allow - reviewed migration checksum
  ['20260809020000_add_owner_expense_allocation', 'c6f8205e5e52061868461cac99b25926dda5eb464c747f04c433754c875834fc'], // gitleaks:allow - reviewed migration checksum
  ['20260813050000_add_forced_password_change', 'baf6e36dde03d858f8e7f5933f50eea84dff99d96b19571fce0cfbe452d84eca'], // gitleaks:allow - reviewed migration checksum
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

async function assertEmptyDatabase() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    if (Number(rows[0]?.count || 0) !== 0) {
      throw new Error('CI database bootstrap refuses to run because the disposable database is not empty.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  assertDisposableCiDatabase();
  await assertEmptyDatabase();

  for (const [name, expectedHash] of reviewedMigrations) {
    verifyMigration(name, expectedHash);
  }

  if (fs.existsSync(generatedSchemaSql)) {
    throw new Error('CI schema bootstrap output already exists; refusing to overwrite it.');
  }

  // Historical databases were baselined after several tables already existed,
  // so the immutable migration chain cannot create a fresh database. Build the
  // current datamodel only on an empty disposable CI database, then record the
  // reviewed migration checksums without changing the historical SQL files.
  runPrisma([
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema-datamodel', schema,
    '--script',
    '--output', generatedSchemaSql,
  ]);
  runPrisma(['db', 'execute', '--file', generatedSchemaSql, '--schema', schema]);

  for (const [name] of reviewedMigrations) {
    runPrisma(['migrate', 'resolve', '--applied', name, '--schema', schema]);
  }

  runPrisma(['migrate', 'status', '--schema', schema]);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = { assertDisposableCiDatabase, assertEmptyDatabase, reviewedMigrations };
