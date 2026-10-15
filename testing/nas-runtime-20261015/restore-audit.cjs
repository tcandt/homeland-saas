const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { createPostgresCliEnv } = require('/app/scripts/postgres-cli');

const mode = process.argv[2];
const fresh = process.env.DRILL_VARIANT === 'fresh';
const database = fresh ? 'homeland_restore_drill_20261015_fresh' : 'homeland_restore_drill_20261015';
let backupId = '2026-10-15T03-13-43-459Z-ef8e262b-f9ad-4394-aa94-665e3233c8d8';
const backupRoot = '/backup';
const output = '/drill-output';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function sql(url, query) {
  const { env } = createPostgresCliEnv(url, process.env);
  const result = spawnSync('psql', ['--no-psqlrc', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query],
    { env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('Read-only SQL audit failed');
  return result.stdout.trim();
}

function audit(url) {
  const tables = sql(url, "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
    .split('\n').filter(Boolean);
  const records = tables.map((table) => {
    const quoted = '"' + table.replaceAll('"', '""') + '"';
    const [count, digest] = sql(url, `SELECT count(*), md5(coalesce(string_agg(h, '' ORDER BY h), '')) FROM (SELECT md5(row_to_json(t)::text) h FROM public.${quoted} t) s`).split('|');
    return { table, count: Number(count), digest };
  });
  const columns = sql(url, "SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,coalesce(column_default,'') FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position");
  const constraints = sql(url, "SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname");
  const indexes = sql(url, "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname");
  const functions = sql(url, "SELECT p.proname,pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e') ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)");
  return { tables: records, fullDataSha256: hash(JSON.stringify(records)), schemaSha256: hash(JSON.stringify({ columns, constraints, indexes, functions })) };
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD || '');
  if (!password) throw new Error('Missing private database credential');
  if (mode === 'private-env') {
    const keys = ['POSTGRES_PASSWORD', 'JWT_SECRET', 'INTERNAL_API_TOKEN', 'SEED_DEFAULT_PASSWORD'];
    const lines = keys.map((key) => {
      const value = process.env[key];
      if (!value || /[\r\n\0]/.test(value)) throw new Error('Invalid private configuration');
      return key + '=' + value;
    });
    fs.writeFileSync('/drill-private/env', lines.join('\n') + '\n', { mode: 0o600, flag: 'wx' });
    console.log('PASS private drill configuration generated; no release metadata inherited');
    return;
  }
  const drillUrl = `postgresql://homeland_drill:${password}@127.0.0.1:5432/${database}`;
  if (mode === 'launch') {
    Object.assign(process.env, {
      DATABASE_URL: drillUrl, REDIS_URL: 'redis://127.0.0.1:6379',
      NODE_ENV: 'production', DEPLOY_ENV: 'staging', APP_RUNTIME_ROLE: 'api', PORT: '3001',
      RUN_DB_MIGRATIONS: 'false', ALLOW_REGISTRATION: 'false',
      DISABLE_SCHEDULED_JOBS: 'true', DISABLE_DEPOSIT_OUTBOX: 'true',
      COMMUNICATION_IMMEDIATE_DELIVERY: 'false', COMMUNICATION_EXTERNAL_DELIVERY_ENABLED: 'false',
      SYSTEM_BACKUP_ENABLED: 'false', SYSTEM_UPDATE_MODE: 'dry-run',
      STORAGE_PROVIDER: 'local', STORAGE_DIR: '/app/apps/api/storage',
      APP_URL: 'http://127.0.0.1:3000', CORS_ORIGINS: 'http://127.0.0.1:3000',
    });
    require('/app/apps/api/dist/main');
    return;
  }
  if (mode === 'checkpoint') {
    const label = process.env.AUDIT_LABEL;
    const previous = { 'current-started': 'baseline', 'rollback-started': 'current-tested', 'forward-started': 'rollback-tested' };
    if (!['baseline', 'current-started', 'current-tested', 'rollback-started', 'rollback-tested', 'forward-started', 'forward-tested'].includes(label)) throw new Error('Invalid checkpoint');
    const result = audit(drillUrl);
    const reference = previous[label] && JSON.parse(fs.readFileSync(path.join(output, previous[label] + '.json')));
    const unchanged = reference ? JSON.stringify(reference) === JSON.stringify(result) : null;
    fs.writeFileSync(path.join(output, label + '.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ mode, label, fullDataSha256: result.fullDataSha256, schemaSha256: result.schemaSha256, unchangedSince: previous[label] || null, unchanged }));
    if (unchanged === false) throw new Error('Application startup changed restored data');
    return;
  }
  if (mode === 'smoke') {
    const phase = process.env.DRILL_PHASE;
    if (!['current', 'rollback', 'forward'].includes(phase)) throw new Error('Invalid smoke phase');
    let checks = 0;
    async function request(route, expected, options = {}) {
      const response = await fetch('http://127.0.0.1:3001/api/v1' + route, { redirect: 'error', signal: AbortSignal.timeout(5000), ...options,
        headers: { 'content-type': 'application/json', ...options.headers } });
      if (response.status !== expected) {
        console.log(JSON.stringify({ failedRoute: route, expectedStatus: expected, actualStatus: response.status }));
        throw new Error('Unexpected application HTTP status');
      }
      const json = await response.json();
      checks++;
      return json?.data ?? json;
    }
    const ready = await request('/health/ready', 200);
    const build = await request('/health/build-info', 200, { headers: { 'x-internal-token': process.env.INTERNAL_API_TOKEN } });
    if (build.commit !== process.env.EXPECTED_DRILL_COMMIT || build.deploymentEnvironment !== 'staging') {
      console.log(JSON.stringify({ expectedCommit: process.env.EXPECTED_DRILL_COMMIT, actualCommit: build.commit, environment: build.deploymentEnvironment }));
      throw new Error('Immutable identity mismatch');
    }
    for (const email of ['admin@homeland.vn', 'manager@homeland.local', 'finance@homeland.local']) {
      const auth = await request('/auth/login', 201, { method: 'POST', body: JSON.stringify({ emailOrPhone: email, password: process.env.SEED_DEFAULT_PASSWORD }) });
      if (!auth.accessToken) throw new Error('Missing session');
      const headers = { authorization: 'Bearer ' + auth.accessToken };
      const me = await request('/auth/me', 200, { headers });
      if (JSON.stringify(me.roles).includes('SALES')) throw new Error('Retired role present');
      await request('/notifications', 200, { headers });
      if (email === 'admin@homeland.vn') {
        for (const route of ['/rooms', '/customers', '/contracts', '/deposits', '/invoices', '/finance/cashflow', '/finance/profit-loss', '/reports/deposit-liability']) await request(route, 200, { headers });
        await request('/sales/leads', 404, { headers });
      }
      await request('/auth/logout', 201, { method: 'POST', headers, body: '{}' });
    }
    const result = { phase, checks, commit: build.commit, database: database, ready: !!ready, passed: true };
    fs.writeFileSync(path.join(output, phase + '-smoke.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    return;
  }
  if (mode === 'snapshot') {
    const url = `postgresql://homeland_staging:${password}@postgres:5432/homeland_staging`;
    const before = audit(url);
    const { runBackup, parseArguments } = require('/app/scripts/production-backup');
    process.env.DATABASE_URL = url;
    delete process.env.BACKUP_RCLONE_DEST;
    const manifest = runBackup(parseArguments(['--env-managed-externally', '--output-dir', backupRoot, '--storage-dir', '/source-storage']));
    if (manifest.status !== 'SUCCESS') throw new Error('Snapshot failed');
    const after = audit(url);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Source changed during snapshot');
    fs.writeFileSync(path.join(output, 'source-before.json'), JSON.stringify(before, null, 2));
    fs.writeFileSync(path.join(output, 'snapshot-info.json'), JSON.stringify({ backupId: manifest.id, sourceUnchanged: true }, null, 2));
    console.log(JSON.stringify({ mode, backupId: manifest.id, sourceUnchanged: true, fullDataSha256: before.fullDataSha256 }));
    return;
  }
  if (mode === 'source-before' || mode === 'source-after') {
    const url = `postgresql://homeland_staging:${password}@postgres:5432/homeland_staging`;
    const result = audit(url);
    fs.writeFileSync(path.join(output, `${mode}.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ mode, tables: result.tables.length, fullDataSha256: result.fullDataSha256, schemaSha256: result.schemaSha256 }));
    return;
  }
  if (mode !== 'restore') throw new Error('Unexpected mode');
  if (fresh) {
    backupId = JSON.parse(fs.readFileSync(path.join(output, 'snapshot-info.json'))).backupId;
    if (!/^[0-9TZ-]+-[a-f0-9-]{36}$/.test(backupId)) throw new Error('Invalid snapshot identity');
  }
  const url = drillUrl;
  const { runRestoreDrill, parseArguments } = require('/app/scripts/production-restore-drill');
  const manifestPath = path.join(backupRoot, backupId, 'manifest.json');
  const start = Date.now();
  const options = parseArguments(['--manifest', manifestPath, '--confirm-target-db', database]);
  options.databaseUrl = url;
  const result = runRestoreDrill(options);
  fs.writeFileSync(path.join(output, 'restore-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ mode, ready: result.ready, restored: result.restored, summary: result.summary, checks: result.checks }));
  if (!result.ready) throw new Error('Guarded restore failed');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  const storage = '/drill-storage';
  if (fs.readdirSync(storage).length) throw new Error('Restore storage must be empty');
  for (const record of manifest.storage.files) {
    const source = path.join(backupRoot, backupId, 'storage', record.path);
    const target = path.resolve(storage, record.path);
    if (!target.startsWith(storage + path.sep)) throw new Error('Unsafe storage path');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    if (hash(fs.readFileSync(target)) !== record.sha256) throw new Error('Restored file checksum mismatch');
  }
  const restored = audit(url);
  const source = JSON.parse(fs.readFileSync(path.join(output, 'source-before.json')));
  const changedTables = restored.tables.filter((t) => JSON.stringify(t) !== JSON.stringify(source.tables.find((s) => s.table === t.table))).map((t) => t.table);
  const report = { backupId, elapsedMs: Date.now() - start, restoredTables: restored.tables.length,
    restoredRows: restored.tables.reduce((sum, t) => sum + t.count, 0),
    schemaMatchesLiveSource: restored.schemaSha256 === source.schemaSha256,
    fullDataMatchesLiveSource: restored.fullDataSha256 === source.fullDataSha256,
    changedTables, verifiedStorageFiles: manifest.storage.files.length,
    financialFixturePresent: restored.tables.some((t) => ['Invoice', 'Payment', 'Deposit', 'DepositLedgerEntry'].includes(t.table) && t.count > 0),
    offHostVerified: false };
  fs.writeFileSync(path.join(output, 'restored-audit.json'), JSON.stringify(restored, null, 2));
  fs.writeFileSync(path.join(output, 'restore-summary.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (!report.schemaMatchesLiveSource || (fresh && !report.fullDataMatchesLiveSource)) throw new Error('Restored data differs');
}

main().catch(() => { console.error('NAS restore audit failed; inspect non-secret drill reports.'); process.exitCode = 1; });
