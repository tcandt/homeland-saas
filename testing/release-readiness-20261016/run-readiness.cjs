const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const donor = `homeland_readiness_gate_20261016_${crypto.randomBytes(4).toString('hex')}`;
const image = 'homeland-api:0fa87a71';
const password = crypto.randomBytes(24).toString('hex');
const env = { ...process.env, POSTGRES_PASSWORD: password, DATABASE_URL: `postgresql://homeland_staging:${password}@postgres:5432/homeland_staging`, SEED_DEFAULT_PASSWORD: crypto.randomBytes(24).toString('hex') };
const source = fs.readFileSync(path.join(root, 'apps/api/src/health.controller.ts'), 'utf8');
const sql = source.match(/const rows = await this\.prisma\.\$queryRaw<Array<\{ compatible: boolean \}>>`([\s\S]*?)`;/)?.[1];
if (!sql || !sql.includes('20261014130000_retire_sales_role_and_leads')) throw Error('Missing current readiness SQL');
function docker(args, input) {
  const result = spawnSync('docker', args, { cwd: root, encoding: 'utf8', env, input, timeout: 240000, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw Error(`Controlled Docker ${args[0]} failed; output withheld`);
  return result.stdout.trim();
}
function main() {
  try {
    docker(['run', '-d', '--name', donor, '--network', 'none', '--hostname', 'postgres', '--add-host', 'postgres:127.0.0.1', '--memory', '512m', '--tmpfs', '/var/lib/postgresql/data:rw,size=512m', '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_USER=homeland_staging', '-e', 'POSTGRES_DB=homeland_staging', 'pgvector/pgvector:pg16']);
    let ready = false;
    for (let i = 0; i < 40; i++) {
      const probe = spawnSync('docker', ['exec', donor, 'pg_isready', '-U', 'homeland_staging', '-d', 'homeland_staging'], { encoding: 'utf8' });
      if (probe.status === 0) { ready = true; break; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 750);
    }
    if (!ready) throw Error('Isolated PostgreSQL did not become ready');
    const base = ['run', '--rm', '-i', '--network', `container:${donor}`, '--memory', '768m', '-e', 'DATABASE_URL', '-e', 'SEED_DEFAULT_PASSWORD', '-e', 'CI_DATABASE_BOOTSTRAP_MODE=NAS_STAGING', '-e', 'NAS_STAGING_BOOTSTRAP=true', '-e', 'NAS_STAGING_BOOTSTRAP_CONFIRM=homeland_nas_staging', '-e', 'DEPLOY_ENV=staging', '-e', 'NODE_ENV=production', '-e', 'SEED_MODE=staging', '-e', 'SEED_FORCE_PASSWORD_CHANGE=false', '--entrypoint', 'node', image];
    const boot = docker([...base, 'scripts/ci-bootstrap-database.js']);
    if (!boot.includes('NAS staging bootstrap: INITIALIZED')) throw Error('Bootstrap completion was not positively verified');
    const inner = `
const assert=require('assert/strict');const {PrismaClient}=require('@prisma/client');
const sql=${JSON.stringify(sql)};
(async()=>{const p=new PrismaClient();const checks=[];try{
const bootstrap=require('/app/scripts/ci-bootstrap-database');await bootstrap.auditNasRelease(p);await bootstrap.assertNasSeedCompleted(p);checks.push('fresh-bootstrap-35-checksums-schema-marker');
assert.equal((await p.$queryRawUnsafe(sql))[0].compatible,true);checks.push('current-release-ready');
for(const [name,mutation] of [
['unapplied-latest',\`UPDATE "_prisma_migrations" SET rolled_back_at=now() WHERE migration_name='20261014130000_retire_sales_role_and_leads'\`],
['unfinished-migration',\`UPDATE "_prisma_migrations" SET finished_at=NULL WHERE migration_name='20261014130000_retire_sales_role_and_leads'\`],
['stale-sales-table',\`CREATE TABLE "SalesLead" (id text)\`],
['unexpected-role-label',\`ALTER TYPE "RoleCode" ADD VALUE 'SALES'\`],
['missing-role-type',\`ALTER TYPE "RoleCode" RENAME TO "RoleCode_missing"\`]
]){try{await p.$transaction(async tx=>{await tx.$executeRawUnsafe(mutation);assert.notEqual((await tx.$queryRawUnsafe(sql))[0].compatible,true,name);throw new Error('rollback-expected')});throw new Error('Missing rollback')}catch(e){if(e.message!=='rollback-expected')throw e}assert.equal((await p.$queryRawUnsafe(sql))[0].compatible,true);checks.push(name+'-blocked-and-rolled-back')}
await bootstrap.auditNasRelease(p);await bootstrap.assertNasSeedCompleted(p);checks.push('final-release-audit-unchanged');
console.log(JSON.stringify({status:'PASS',node:process.version,checks,total:checks.length,scope:'isolated-local-PG16-no-published-port-no-application-volumes'}));
}finally{await p.$disconnect()}})().catch(()=>{console.error('Isolated readiness assertion failed');process.exitCode=1});`;
    console.log(docker([...base, '-'], inner));
  } finally {
    if (!/^homeland_readiness_gate_20261016_[a-f0-9]{8}$/.test(donor)) throw Error('Unsafe cleanup target');
    docker(['rm', '-f', donor]);
  }
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
