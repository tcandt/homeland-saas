const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const image = process.argv[2];
if (process.env.VERIFY_DISPOSABLE_NAS_IMAGE !== 'true' || !image || image.startsWith('-')) {
  throw new Error('Set VERIFY_DISPOSABLE_NAS_IMAGE=true and provide the locally built API image.');
}
const migrationCount = fs.readdirSync(path.resolve(__dirname, '../packages/database/prisma/migrations'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.resolve(__dirname, '../packages/database/prisma/migrations', entry.name, 'migration.sql')))
  .length;
if (migrationCount !== 36) throw new Error('Expected the reviewed 36-migration release inventory.');

const suffix = crypto.randomBytes(6).toString('hex');
const network = `homeland-bootstrap-check-${suffix}`;
const database = `${network}-postgres`;
const bootstrap = `${network}-bootstrap`;
const password = crypto.randomBytes(24).toString('hex');
const seedPassword = crypto.randomBytes(24).toString('hex');
const env = {
  ...process.env,
  POSTGRES_PASSWORD: password,
  DATABASE_URL: `postgresql://homeland_staging:${password}@postgres:5432/homeland_staging?schema=public`,
  SEED_DEFAULT_PASSWORD: seedPassword,
};
const docker = (args, options = {}) => execFileSync('docker', args, {
  env, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'], ...options,
});
const query = (sql) => docker(['exec', database, 'psql', '-U', 'homeland_staging', '-d', 'homeland_staging', '-Atc', sql]).trim();
const snapshot = () => crypto.createHash('sha256').update(docker([
  'exec', database, 'pg_dump', '-U', 'homeland_staging', '-d', 'homeland_staging',
  '--data-only', '--column-inserts', '--no-owner', '--no-privileges',
]).replace(/^\\(?:un)?restrict .*$/gm, '')).digest('hex');
const bootstrapArgs = [
  'run', '--rm', '--name', bootstrap, '--network', network,
  '-e', 'DATABASE_URL', '-e', 'SEED_DEFAULT_PASSWORD',
  '-e', 'NAS_STAGING_BOOTSTRAP=true', '-e', 'DEPLOY_ENV=staging',
  '-e', 'NAS_STAGING_BOOTSTRAP_CONFIRM=homeland_nas_staging',
  '-e', 'CI_DATABASE_BOOTSTRAP_MODE=NAS_STAGING',
  '-e', 'SEED_MODE=staging', '-e', 'NODE_ENV=production',
  '-e', 'COMMUNICATION_EXTERNAL_DELIVERY_ENABLED=false',
  '--entrypoint', 'node', image, 'scripts/ci-bootstrap-database.js',
];

let networkCreated = false;
let databaseCreated = false;
try {
  docker(['image', 'inspect', image]);
  docker(['network', 'create', '--internal', network]);
  networkCreated = true;
  // No host ports, host paths or persistent volumes: this database is disposable.
  docker(['run', '-d', '--name', database, '--network', network, '--network-alias', 'postgres',
    '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_PASSWORD',
    '-e', 'POSTGRES_USER=homeland_staging', '-e', 'POSTGRES_DB=homeland_staging',
    'pgvector/pgvector:pg16']);
  databaseCreated = true;
  docker(['exec', database, 'sh', '-c', 'for i in $(seq 1 60); do pg_isready -U homeland_staging -d homeland_staging >/dev/null && exit 0; sleep 1; done; exit 1']);
  const first = docker(bootstrapArgs);
  assert.match(first, /NAS staging bootstrap: INITIALIZED/);
  assert.equal(query('SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'), String(migrationCount));
  assert.equal(query("SELECT COUNT(*) FROM \"AuditLog\" WHERE id = 'nas-staging-bootstrap-v1'"), '1');
  assert.ok(Number(query('SELECT COUNT(*) FROM "User"')) >= 3);
  const before = snapshot();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.match(docker(bootstrapArgs), /NAS staging bootstrap: VERIFIED_EXISTING/);
    assert.equal(snapshot(), before, 'Restart changed existing database data.');
  }
  console.log(`PASS: production-pruned API image initializes ${migrationCount} migrations and seed; two audit-only restarts preserve all dumped data.`);
} catch (error) {
  const details = [error.message, error.stdout, error.stderr].filter(Boolean).join('\n');
  console.error(details.replaceAll(password, '[REDACTED]').replaceAll(seedPassword, '[REDACTED]'));
  process.exitCode = 1;
} finally {
  // Remove only the uniquely named resources created by this verifier.
  try { docker(['rm', '-f', bootstrap]); } catch {}
  if (databaseCreated) {
    try { docker(['rm', '-f', database]); } catch { process.exitCode = 1; }
  }
  if (networkCreated) {
    try { docker(['network', 'rm', network]); } catch { process.exitCode = 1; }
  }
}
