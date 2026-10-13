const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { fingerprint, readCanonicalInventory } = require('./baseline-v2-inventory');

const root = path.resolve(__dirname, '..');
const schema = path.join(root, 'packages/database/prisma/schema.prisma');
const migrationsRoot = path.join(root, 'packages/database/prisma/migrations');
const historicalManifestPath = path.join(root, 'packages/database/prisma/baseline/migration-manifest.json');
const baselineV2Root = path.join(root, 'packages/database/prisma/baseline-v2');
const baselineV2ManifestPath = path.join(baselineV2Root, 'baseline-v2.manifest.json');
const baselineV2Sql = path.join(baselineV2Root, 'baseline-v2.sql');
const preludeSql = path.join(root, 'packages/database/prisma/baseline/enable-pgvector.sql');
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
const historicalManifest = JSON.parse(fs.readFileSync(historicalManifestPath, 'utf8'));
const supplementalManifest = JSON.parse(fs.readFileSync(path.join(root, 'packages/database/prisma/baseline/supplemental-migration-manifest.json'), 'utf8'));
const baselineV2Manifest = JSON.parse(fs.readFileSync(baselineV2ManifestPath, 'utf8'));
const reviewedMigrations = historicalManifest.migrations.map(({ name, sha256 }) => [name, sha256]);

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const migrationFile = (name) => path.join(migrationsRoot, name, 'migration.sql');

function runPrisma(args) {
  execFileSync(process.execPath, [prismaCli, ...args], { cwd: root, env: process.env, stdio: 'inherit' });
}

function validateMigrationInventory(historical, supplemental, directories, readHash) {
  if (historical.length !== 18 || supplemental.length !== 4 || directories.length < 22) throw new Error('Baseline migration manifest coverage drift.');
  const historicalNames = historical.map((migration) => migration.name);
  if (JSON.stringify([...historicalNames].sort()) !== JSON.stringify(historicalNames)) throw new Error('Historical migration ordering drift.');
  const covered = new Set();
  for (const [index, migration] of historical.entries()) {
    if (migration.order !== index + 1) throw new Error(`Historical migration order drift: ${migration.name}.`);
  }
  for (const migration of [...historical, ...supplemental]) {
    if (!/^\d{14}_[a-z0-9_]+$/.test(migration.name) || !/^[a-f0-9]{64}$/.test(migration.sha256) || covered.has(migration.name) || !directories.includes(migration.name) || readHash(migration.name) !== migration.sha256) {
      throw new Error(`Baseline migration checksum/coverage drift: ${migration.name}.`);
    }
    covered.add(migration.name);
  }
  const latestHistorical = historicalNames.at(-1);
  if (directories.some((name) => !covered.has(name) && name <= latestHistorical)) {
    throw new Error('Forward migration ordering drift after BASELINE-V2 history.');
  }
}

function assertHistoricalManifest() {
  const directories = fs.readdirSync(migrationsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (supplementalManifest.version !== 'BASELINE-V2-SUPPLEMENT-01') throw new Error('Supplemental baseline manifest version drift.');
  validateMigrationInventory(historicalManifest.migrations, supplementalManifest.migrations, directories, (name) => sha256(migrationFile(name)));
}

function assertBaselineV2Artifact() {
  const artifacts = baselineV2Manifest.artifacts;
  if (baselineV2Manifest.version !== 'BASELINE-V2' || baselineV2Manifest.sourceCoverage?.historicalMigrationCount !== 18) throw new Error('BASELINE-V2 manifest source coverage is incomplete.');
  if (!baselineV2Manifest.inventory || !baselineV2Manifest.canonicalFingerprint) throw new Error('BASELINE-V2 manifest lacks canonical inventory/fingerprint.');
  if (artifacts?.baselineSql?.sha256 !== sha256(baselineV2Sql) || artifacts?.preludeSql?.sha256 !== sha256(preludeSql)) throw new Error('BASELINE-V2 artifact checksum drift. Regenerate and review the manifest; do not resolve migrations.');
  if (baselineV2Manifest.canonicalFingerprint !== fingerprint(baselineV2Manifest.inventory)) throw new Error('BASELINE-V2 canonical inventory checksum drift.');
}

function assertDisposableCiDatabase() {
  if (process.env.CI !== 'true' || process.env.GITHUB_ACTIONS !== 'true' || process.env.CI_DATABASE_BOOTSTRAP !== 'true' || process.env.RUN_DESTRUCTIVE_E2E !== 'true') throw new Error('CI database bootstrap is restricted to the destructive GitHub Actions integration job.');
  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  if (databaseUrl.protocol !== 'postgresql:' || !new Set(['localhost', '127.0.0.1']).has(databaseUrl.hostname) || databaseUrl.port !== '5433' || databaseUrl.username !== 'homeland' || databaseUrl.pathname !== '/homeland') throw new Error('CI database bootstrap requires the disposable localhost:5433/homeland database.');
}

function assertDisposableLocalDatabase(env = process.env) {
  const databaseUrl = new URL(env.DATABASE_URL || '');
  if (env.LOCAL_DATABASE_BOOTSTRAP !== 'true' || env.LOCAL_DATABASE_BOOTSTRAP_CONFIRM !== 'homeland_release_baseline_test' || databaseUrl.protocol !== 'postgresql:' || !new Set(['localhost', '127.0.0.1']).has(databaseUrl.hostname) || databaseUrl.port !== '5436' || databaseUrl.username !== 'homeland_test' || databaseUrl.pathname !== '/homeland_release_baseline_test') {
    throw new Error('Local bootstrap requires the explicitly confirmed disposable localhost:5436/homeland_release_baseline_test database.');
  }
}

function assertNasStagingDatabase(env = process.env) {
  const databaseUrl = new URL(env.DATABASE_URL || '');
  const allowed = env.NAS_STAGING_BOOTSTRAP === 'true'
    && env.DEPLOY_ENV === 'staging'
    && env.NAS_STAGING_BOOTSTRAP_CONFIRM === 'homeland_nas_staging'
    && databaseUrl.protocol === 'postgresql:'
    && databaseUrl.hostname === 'postgres'
    && databaseUrl.port === '5432'
    && databaseUrl.username === 'homeland_staging'
    && databaseUrl.pathname === '/homeland_staging';
  if (!allowed) {
    throw new Error('NAS staging bootstrap requires NAS_STAGING_BOOTSTRAP=true, DEPLOY_ENV=staging, confirmation homeland_nas_staging, and the internal postgres/homeland_staging database.');
  }
}

async function queryRows(prisma, sql) { return prisma.$queryRawUnsafe(sql); }

async function assertEmptyDatabase(prisma) {
  const rows = await queryRows(prisma, `SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
  if (Number(rows[0]?.count || 0) !== 0) throw new Error('BASELINE-V2 fresh path requires a truly empty public schema; database is not empty.');
}

function describeInventoryDrift(expected, actual) {
  for (const key of Object.keys(expected)) {
    const expectedValue = JSON.stringify(expected[key]);
    const actualValue = JSON.stringify(actual[key]);
    if (expectedValue !== actualValue) {
      if (Array.isArray(expected[key]) && Array.isArray(actual[key]) && expected[key].every((value) => typeof value === 'string') && actual[key].every((value) => typeof value === 'string')) {
        const missing = expected[key].filter((value) => !actual[key].includes(value));
        const unexpected = actual[key].filter((value) => !expected[key].includes(value));
        return `${key} inventory differs (missing=${missing.slice(0, 5).join(',') || 'none'}; unexpected=${unexpected.slice(0, 5).join(',') || 'none'})`;
      }
      return `${key} inventory differs (expected=${expected[key].length}; actual=${actual[key].length})`;
    }
  }
  return 'canonical inventory differs';
}

async function assertCanonicalFingerprint(prisma) {
  const actual = await readCanonicalInventory(prisma);
  const actualFingerprint = fingerprint(actual);
  if (actualFingerprint !== baselineV2Manifest.canonicalFingerprint || JSON.stringify(actual) !== JSON.stringify(baselineV2Manifest.inventory)) throw new Error(`BASELINE-V2 schema drift: ${describeInventoryDrift(baselineV2Manifest.inventory, actual)}.`);
  return actualFingerprint;
}

async function contractStatusAudit(prisma) {
  const [labels, contractColumn, ended, indexes] = await Promise.all([
    queryRows(prisma, `SELECT e.enumlabel AS label FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace JOIN pg_enum e ON e.enumtypid = t.oid WHERE n.nspname = 'public' AND t.typname = 'ContractStatus' ORDER BY e.enumsortorder`),
    queryRows(prisma, `SELECT is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Contract' AND column_name = 'status'`),
    queryRows(prisma, `SELECT COUNT(*)::int AS count FROM "Contract" WHERE "status"::text = 'ENDED'`),
    queryRows(prisma, `SELECT relname AS name FROM pg_class WHERE relkind = 'i' AND relname IN ('Contract_tenantId_roomId_status_idx', 'Contract_tenantId_customerId_status_idx', 'Contract_tenantId_status_endDate_idx') ORDER BY relname`),
  ]);
  const expected = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED', 'CANCELLED'];
  if (JSON.stringify(labels.map((row) => row.label)) !== JSON.stringify(expected)) throw new Error('ContractStatus enum drift.');
  if (contractColumn.length !== 1 || contractColumn[0].is_nullable !== 'NO' || !String(contractColumn[0].column_default).includes("'DRAFT'")) throw new Error('Contract.status null/default drift.');
  if (Number(ended[0]?.count || 0) !== 0) throw new Error('Contract data drift: ENDED status rows block BASELINE-V2 equivalence.');
  if (indexes.length !== 3) throw new Error('Contract status index drift.');
  return { labels: expected, endedRows: 0, statusIndexes: indexes.map((row) => row.name) };
}

async function getMigrationState(prisma) {
  const table = await queryRows(prisma, `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations') AS present`);
  if (!table[0]?.present) return { present: false, applied: [], failed: 0 };
  const [applied, failed] = await Promise.all([
    queryRows(prisma, `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`),
    queryRows(prisma, `SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`),
  ]);
  return { present: true, applied: applied.map((row) => row.migration_name), failed: Number(failed[0]?.count || 0) };
}

async function assertExactlyHistoricalState(prisma) {
  const state = await getMigrationState(prisma);
  const expected = reviewedMigrations.map(([name]) => name).sort();
  if (!state.present || state.failed !== 0 || JSON.stringify(state.applied) !== JSON.stringify(expected)) throw new Error('Existing database migration history is not exactly the verified historical 18/18 state. BASELINE-V2 will not resolve or conceal it.');
}

async function resolveHistoricalAfterFreshVerification(prisma) {
  const state = await getMigrationState(prisma);
  if (state.present && (state.applied.length || state.failed)) throw new Error('Fresh BASELINE-V2 cannot resolve onto pre-existing migration state.');
  for (const [name] of reviewedMigrations) runPrisma(['migrate', 'resolve', '--applied', name, '--schema', schema]);
  await assertExactlyHistoricalState(prisma);
}

async function freshApprovedBaseline(prisma) {
  await assertEmptyDatabase(prisma);
  runPrisma(['db', 'execute', '--file', preludeSql, '--schema', schema]);
  runPrisma(['db', 'execute', '--file', baselineV2Sql, '--schema', schema]);
  await assertCanonicalFingerprint(prisma);
  await contractStatusAudit(prisma);
  await resolveHistoricalAfterFreshVerification(prisma);
  // These independently checksum-locked additive SQL files postdate the frozen
  // historical manifest but have backdated names. Prove that they leave the
  // reviewed canonical schema unchanged before recording THEIR own history.
  // This function is reachable only after the truly-empty database guard.
  for (const { name } of supplementalManifest.migrations) {
    runPrisma(['db', 'execute', '--file', migrationFile(name), '--schema', schema]);
  }
  await assertCanonicalFingerprint(prisma);
  await contractStatusAudit(prisma);
  await assertExactlyHistoricalState(prisma);
  for (const { name } of supplementalManifest.migrations) runPrisma(['migrate', 'resolve', '--applied', name, '--schema', schema]);
  const state = await getMigrationState(prisma);
  const expected = [...reviewedMigrations.map(([name]) => name), ...supplementalManifest.migrations.map(({ name }) => name)].sort();
  if (state.failed !== 0 || JSON.stringify(state.applied) !== JSON.stringify(expected)) throw new Error('Fresh supplemental baseline history drift.');
}

async function existingVerifiedBaseline(prisma) {
  // Existing path is audit-only: never execute BASELINE-V2 and never migrate resolve.
  const findings = [];
  for (const audit of [
    () => assertCanonicalFingerprint(prisma),
    () => contractStatusAudit(prisma),
    () => assertExactlyHistoricalState(prisma),
  ]) {
    try { await audit(); } catch (error) { findings.push(error instanceof Error ? error.message : String(error)); }
  }
  if (findings.length) throw new Error(`Existing BASELINE-V2 audit blocked: ${findings.join(' | ')}`);
}

async function main() {
  if (process.env.NAS_STAGING_BOOTSTRAP === 'true') assertNasStagingDatabase();
  else if (process.env.LOCAL_DATABASE_BOOTSTRAP === 'true') assertDisposableLocalDatabase();
  else assertDisposableCiDatabase();
  assertHistoricalManifest();
  assertBaselineV2Artifact();
  const mode = process.env.CI_DATABASE_BOOTSTRAP_MODE || 'FRESH';
  if (!['FRESH', 'EXISTING'].includes(mode)) throw new Error('CI_DATABASE_BOOTSTRAP_MODE must be FRESH or EXISTING.');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    if (mode === 'FRESH') await freshApprovedBaseline(prisma); else await existingVerifiedBaseline(prisma);
    // Prisma exits non-zero while expected forward migrations are pending. The
    // baseline verification above has already proved the historical state, so
    // deploy them first and retain the status command as the final gate only.
    runPrisma(['migrate', 'deploy', '--schema', schema]);
    runPrisma(['migrate', 'status', '--schema', schema]);
  } finally { await prisma.$disconnect(); }
}

if (require.main === module) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

module.exports = { assertBaselineV2Artifact, assertCanonicalFingerprint, assertHistoricalManifest, assertDisposableLocalDatabase, assertNasStagingDatabase, validateMigrationInventory, contractStatusAudit, historicalManifest, supplementalManifest, reviewedMigrations };
