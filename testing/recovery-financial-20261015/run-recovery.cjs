const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const runId = `run-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const output = path.join(__dirname, 'artifacts', runId);
const donor = `homeland_finrec_20261015_donor_${runId.slice(-8)}`;
const image = 'homeland-api:3.0.2-573bc663';
const password = crypto.randomBytes(18).toString('hex');
const sourceDb = 'homeland_staging';
const targetDb = 'homeland_finrec_20261015_restore_drill';
const sourceUrl = `postgresql://homeland_staging:${password}@postgres:5432/${sourceDb}`;

function docker(args, env = process.env) {
  const result = spawnSync('docker', args, { cwd: root, encoding: 'utf8', env, stdio: 'pipe', timeout: 900000 });
  if (result.status !== 0) throw new Error(`docker command failed (${args[0]} ${args[1] || ''})`);
  return String(result.stdout || '').trim();
}
function waitReady() {
  for (let i = 0; i < 60; i += 1) {
    const result = spawnSync('docker', ['exec', donor, 'pg_isready', '-U', 'homeland_staging', '-d', sourceDb], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
    if (result.status === 0) return;
    spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 1000'], { stdio: 'ignore' });
  }
  throw new Error('isolated donor postgres did not become ready');
}
function run() {
  fs.mkdirSync(output, { recursive: true });
  const childEnv = { ...process.env, DATABASE_URL: sourceUrl, POSTGRES_PASSWORD: password, SEED_DEFAULT_PASSWORD: crypto.randomBytes(20).toString('hex') };
  try {
    docker(['run', '-d', '--name', donor, '--network', 'none', '--hostname', 'postgres', '--add-host', 'postgres:127.0.0.1', '--memory', '512m', '--tmpfs', '/var/lib/postgresql/data:rw,size=512m', '-e', 'POSTGRES_USER=homeland_staging', '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_DB=homeland_staging', 'pgvector/pgvector:pg16'], childEnv);
    waitReady();
    docker(['run', '--rm', '--network', `container:${donor}`, '--name', `${donor}_bootstrap`, '--memory', '768m', '-e', 'DATABASE_URL', '-e', 'SEED_DEFAULT_PASSWORD', '-e', 'CI_DATABASE_BOOTSTRAP_MODE=NAS_STAGING', '-e', 'NAS_STAGING_BOOTSTRAP=true', '-e', 'NAS_STAGING_BOOTSTRAP_CONFIRM=homeland_nas_staging', '-e', 'DEPLOY_ENV=staging', '-e', 'NODE_ENV=production', '-e', 'SEED_MODE=production', '--entrypoint', 'node', image, 'scripts/ci-bootstrap-database.js'], childEnv);
    const mounts = ['--mount', `type=bind,src=${path.join(__dirname, 'fixture.cjs')},dst=/app/testing/recovery-financial-20261015/fixture.cjs,readonly`, '--mount', `type=bind,src=${path.join(__dirname, 'inner.cjs')},dst=/app/testing/recovery-financial-20261015/inner.cjs,readonly`, '--mount', `type=bind,src=${output},dst=/drill-output`];
    docker(['run', '--rm', '--network', `container:${donor}`, '--name', `${donor}_drill`, '--memory', '768m', '-e', 'DATABASE_URL', '-e', 'TARGET_DATABASE_NAME', ...mounts, '--entrypoint', 'node', image, '/app/testing/recovery-financial-20261015/inner.cjs'], { ...childEnv, TARGET_DATABASE_NAME: targetDb });
    const summaryPath = path.join(output, 'summary.json');
    if (!fs.existsSync(summaryPath)) throw new Error('drill summary was not created');
    process.stdout.write(fs.readFileSync(summaryPath, 'utf8'));
  } catch (error) {
    if (!fs.existsSync(path.join(output, 'summary.json'))) fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({ status: 'BLOCKED', reason: error.message }, null, 2));
    process.stderr.write('Financial recovery drill blocked; inspect sanitized summary.json.\n'); process.exitCode = 1;
  } finally { try { docker(['rm', '-f', donor]); } catch {} }
}
run();
