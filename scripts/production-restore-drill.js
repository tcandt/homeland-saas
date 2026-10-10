#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { runRestoreCheck } = require('./production-restore-check');
const { createPostgresCliEnv, parsePostgresUrl } = require('./postgres-cli');

function defaultPrismaCli() {
  const localCli = path.resolve('node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
  return fs.existsSync(localCli) ? localCli : 'prisma';
}

function parseArguments(argv) {
  const options = {
    manifest: '.codex-backups/production/latest-manifest.json',
    maxAgeHours: 24,
    requireOffHost: false,
    pgRestore: process.env.PG_RESTORE_PATH || 'pg_restore',
    psql: process.env.PSQL_PATH || 'psql',
    prisma: process.env.PRISMA_CLI_PATH || defaultPrismaCli(),
    schema: 'packages/database/prisma/schema.prisma',
    databaseUrl: process.env.RESTORE_DRILL_DATABASE_URL || '',
    confirmTargetDb: '',
    skipMigrateStatus: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--manifest') {
      options.manifest = argv[index + 1] || options.manifest;
      index += 1;
    } else if (argument === '--max-age-hours') {
      options.maxAgeHours = Number(argv[index + 1]);
      index += 1;
    } else if (argument === '--require-off-host') {
      options.requireOffHost = true;
    } else if (argument === '--pg-restore') {
      options.pgRestore = argv[index + 1] || options.pgRestore;
      index += 1;
    } else if (argument === '--psql') {
      options.psql = argv[index + 1] || options.psql;
      index += 1;
    } else if (argument === '--prisma') {
      options.prisma = argv[index + 1] || options.prisma;
      index += 1;
    } else if (argument === '--schema') {
      options.schema = argv[index + 1] || options.schema;
      index += 1;
    } else if (argument === '--database-url') {
      options.databaseUrl = argv[index + 1] || options.databaseUrl;
      index += 1;
    } else if (argument === '--confirm-target-db') {
      options.confirmTargetDb = argv[index + 1] || '';
      index += 1;
    } else if (argument === '--skip-migrate-status') {
      options.skipMigrateStatus = true;
    } else if (argument === '--json') {
      options.json = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!Number.isFinite(options.maxAgeHours) || options.maxAgeHours <= 0) {
    throw new Error('--max-age-hours must be a positive number.');
  }

  return options;
}

function pass(id, message) {
  return { id, status: 'PASS', message };
}

function fail(id, message) {
  return { id, status: 'FAIL', message };
}

function inferBackupDir(manifestPath, manifest) {
  const manifestDir = path.dirname(manifestPath);
  if (path.basename(manifestPath) === 'latest-manifest.json' && manifest.id) {
    return path.join(manifestDir, manifest.id);
  }
  return manifestDir;
}

function parseDatabaseIdentity(databaseUrl) {
  try {
    const parsed = parsePostgresUrl(databaseUrl);
    const databaseName = parsed.databaseName;
    return {
      protocol: parsed.protocol,
      host: parsed.host,
      port: parsed.port || null,
      databaseName,
      maskedUrl: `${parsed.protocol}//${parsed.username ? '***@' : ''}${parsed.host}${parsed.port ? `:${parsed.port}` : ''}/${databaseName}`,
    };
  } catch {
    throw new Error('Restore drill database URL is invalid.');
  }
}

function normalizePostgresCliUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  for (const key of ['schema', 'connection_limit', 'pool_timeout', 'pgbouncer', 'statement_cache_size']) {
    parsed.searchParams.delete(key);
  }
  return parsed.toString();
}

function validateRestoreTarget(databaseUrl, confirmTargetDb, sourceDatabaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    return fail('restore_target', 'Missing --database-url or RESTORE_DRILL_DATABASE_URL.');
  }

  let identity;
  try {
    identity = parseDatabaseIdentity(databaseUrl);
  } catch {
    return fail('restore_target', 'Restore target database URL is invalid.');
  }
  const databaseName = identity.databaseName;
  if (!['localhost', '127.0.0.1', '::1'].includes(identity.host.toLowerCase())) {
    return fail('restore_target', 'Restore target must use a local database host.');
  }
  const safeName = /(restore|drill|test|tmp|scratch)/i.test(databaseName);
  const bannedName = /^(homeland|postgres|production|prod)$/i.test(databaseName);
  const confirmed = confirmTargetDb && confirmTargetDb === databaseName;

  if (!databaseName) {
    return fail('restore_target', 'Restore target database name is empty.');
  }
  if (bannedName || !safeName) {
    return fail(
      'restore_target',
      `Restore target database "${databaseName}" must include restore/test/drill/tmp/scratch and must not be a production-like name.`,
    );
  }
  if (!confirmed) {
    return fail('restore_target', `Pass --confirm-target-db ${databaseName} to confirm the isolated restore target.`);
  }

  if (sourceDatabaseUrl) {
    try {
      const source = parseDatabaseIdentity(sourceDatabaseUrl);
      const normalizeHost = (host) => ['localhost', '127.0.0.1', '::1'].includes(host.toLowerCase()) ? 'loopback' : host.toLowerCase();
      if (normalizeHost(source.host) === normalizeHost(identity.host)
        && String(source.port || '5432') === String(identity.port || '5432')
        && source.databaseName === identity.databaseName) {
        return fail('restore_target', 'Restore target must differ from DATABASE_URL.');
      }
    } catch {
      return fail('restore_target', 'Source database configuration is invalid.');
    }
  }

  return pass('restore_target', `Restore target is explicitly confirmed: ${identity.maskedUrl}.`);
}

function resolvePrismaInvocation(command, args, platform = process.platform) {
  const cli = String(command || '');
  if (platform !== 'win32' || !/\.(?:cmd|bat)$/i.test(cli)) {
    return { command: cli, args };
  }

  const localBatchCli = path.resolve('node_modules', '.bin', 'prisma.cmd');
  const localPrismaEntrypoint = path.resolve('node_modules', 'prisma', 'build', 'index.js');
  if (path.resolve(cli).toLowerCase() !== localBatchCli.toLowerCase() || !fs.existsSync(localPrismaEntrypoint)) {
    throw new Error('Windows batch Prisma launchers are not supported for restore drills. Use the bundled Prisma CLI or set PRISMA_CLI_PATH to a non-batch executable.');
  }

  return { command: process.execPath, args: [localPrismaEntrypoint, ...args] };
}

function runCommand(id, command, args, options = {}) {
  const result = (options.spawnSync || spawnSync)(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    env: options.env || process.env,
  });

  if (result.status !== 0) {
    return fail(id, `${id} command failed.`);
  }

  return pass(id, options.successMessage || `${command} completed successfully.`);
}

function isHarmlessTransactionTimeoutCompatibilityWarning(result) {
  return false;
}

function checkEmptyRestoreTarget(options, deps = {}) {
  const { env } = createPostgresCliEnv(options.databaseUrl, deps.env || process.env);
  const query = `BEGIN TRANSACTION READ ONLY;
    WITH user_namespace AS (SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema')
    SELECT CASE WHEN
      EXISTS (SELECT 1 FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('public', 'information_schema'))
      OR EXISTS (SELECT 1 FROM pg_class WHERE relnamespace IN (SELECT oid FROM user_namespace))
      OR EXISTS (SELECT 1 FROM pg_type WHERE typnamespace IN (SELECT oid FROM user_namespace))
      OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace IN (SELECT oid FROM user_namespace))
      OR EXISTS (SELECT 1 FROM pg_operator WHERE oprnamespace IN (SELECT oid FROM user_namespace))
      OR EXISTS (SELECT 1 FROM pg_opclass WHERE opcnamespace IN (SELECT oid FROM user_namespace))
      OR EXISTS (SELECT 1 FROM pg_opfamily WHERE opfnamespace IN (SELECT oid FROM user_namespace))
      OR EXISTS (SELECT 1 FROM pg_collation WHERE collnamespace IN (SELECT oid FROM user_namespace))
      OR EXISTS (SELECT 1 FROM pg_conversion WHERE connamespace IN (SELECT oid FROM user_namespace))
      OR EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgnamespace IN (SELECT oid FROM user_namespace))
      OR EXISTS (SELECT 1 FROM pg_ts_dict WHERE dictnamespace IN (SELECT oid FROM user_namespace))
      OR EXISTS (SELECT 1 FROM pg_ts_parser WHERE prsnamespace IN (SELECT oid FROM user_namespace))
      OR EXISTS (SELECT 1 FROM pg_ts_template WHERE tmplnamespace IN (SELECT oid FROM user_namespace))
      OR EXISTS (SELECT 1 FROM pg_extension WHERE extname <> 'plpgsql')
      OR EXISTS (SELECT 1 FROM pg_language WHERE lanname NOT IN ('internal', 'c', 'sql', 'plpgsql'))
      OR EXISTS (SELECT 1 FROM pg_event_trigger)
      OR EXISTS (SELECT 1 FROM pg_foreign_data_wrapper)
      OR EXISTS (SELECT 1 FROM pg_foreign_server)
      OR EXISTS (SELECT 1 FROM pg_publication)
      OR EXISTS (SELECT 1 FROM pg_subscription)
    THEN 'NONEMPTY' ELSE 'EMPTY' END; ROLLBACK;`;
  const result = (deps.spawnSync || spawnSync)(options.psql || 'psql', [
    '--no-psqlrc',
    '--set=ON_ERROR_STOP=1',
    '--quiet',
    '--tuples-only',
    '--no-align',
    '--command',
    query,
  ], { stdio: 'pipe', encoding: 'utf8', env });
  if (result.status !== 0) return fail('restore_target_empty', 'Target database emptiness check failed.');
  if (String(result.stdout || '').trim() !== 'EMPTY') return fail('restore_target_empty', 'Target database is not empty.');
  return pass('restore_target_empty', 'Target database is empty and safe to restore.');
}

function runRestoreDrill(options, deps = {}) {
  const manifestPath = path.resolve(options.manifest);
  const checks = [];

  const restoreCheckRunner = deps.runRestoreCheck || runRestoreCheck;
  const restoreCheck = restoreCheckRunner({
    manifest: options.manifest,
    maxAgeHours: options.maxAgeHours,
    requireOffHost: options.requireOffHost,
    pgRestore: options.pgRestore,
    skipPgRestoreList: false,
    json: false,
  });
  checks.push(...restoreCheck.checks);

  const targetCheck = validateRestoreTarget(options.databaseUrl, options.confirmTargetDb, deps.sourceDatabaseUrl || process.env.DATABASE_URL);
  checks.push(targetCheck);

  if (!restoreCheck.ready || targetCheck.status === 'FAIL') {
    const failed = checks.filter((check) => check.status === 'FAIL').length;
    return {
      ready: false,
      restored: false,
      backupId: restoreCheck.backupId || null,
      backupDir: restoreCheck.backupDir || null,
      summary: { passed: checks.length - failed, failed, total: checks.length },
      checks,
    };
  }

  const emptyTargetCheck = checkEmptyRestoreTarget(options, deps);
  checks.push(emptyTargetCheck);
  if (emptyTargetCheck.status === 'FAIL') {
    const failed = checks.filter((check) => check.status === 'FAIL').length;
    return { ready: false, restored: false, backupId: restoreCheck.backupId || null, backupDir: restoreCheck.backupDir || null, summary: { passed: checks.length - failed, failed, total: checks.length }, checks };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const backupDir = inferBackupDir(manifestPath, manifest);
  const dumpPath = path.resolve(backupDir, manifest.database.path || '');
  const { env: restoreEnv } = createPostgresCliEnv(options.databaseUrl, deps.env || process.env);
  const spawn = deps.spawnSync || spawnSync;

  const restoreResult = spawn(options.pgRestore, [
    '--no-owner',
    '--no-acl',
    '--exit-on-error',
    '--single-transaction',
    '--dbname',
    restoreEnv.PGDATABASE,
    dumpPath,
  ], {
    stdio: 'pipe',
    encoding: 'utf8',
    env: restoreEnv,
  });
  checks.push(
    restoreResult.status === 0
      ? pass('pg_restore_drill', 'Database dump restored into the isolated drill database.')
      : fail('pg_restore_drill', 'Database restore command failed.'),
  );

  if (!options.skipMigrateStatus && restoreResult.status === 0) {
    const prismaInvocation = resolvePrismaInvocation(options.prisma, [
      'migrate',
      'status',
      `--schema=${options.schema}`,
    ], deps.platform || process.platform);
    checks.push(runCommand('prisma_migrate_status', prismaInvocation.command, prismaInvocation.args, {
      env: { ...process.env, DATABASE_URL: options.databaseUrl },
      successMessage: 'Prisma migration status can inspect the restored database.',
      spawnSync: spawn,
    }));
  } else if (options.skipMigrateStatus) {
    checks.push(pass('prisma_migrate_status', 'Prisma migration status check skipped.'));
  }

  const failed = checks.filter((check) => check.status === 'FAIL').length;
  return {
    ready: failed === 0,
    restored: restoreResult.status === 0,
    backupId: restoreCheck.backupId || manifest.id || null,
    backupDir,
    target: parseDatabaseIdentity(options.databaseUrl),
    summary: { passed: checks.length - failed, failed, total: checks.length },
    checks,
  };
}

function formatHumanReport(result) {
  const lines = ['HomeLand production restore drill', ''];
  if (result.backupId) lines.push(`Backup ID: ${result.backupId}`);
  if (result.backupDir) lines.push(`Backup dir: ${result.backupDir}`);
  if (result.target) lines.push(`Target: ${result.target.maskedUrl}`);
  if (result.backupId || result.backupDir || result.target) lines.push('');
  for (const check of result.checks) {
    lines.push(`[${check.status}] ${check.id}: ${check.message}`);
  }
  lines.push('', `Restore drill: ${result.ready ? 'PASS' : 'FAIL'} (${result.summary.passed}/${result.summary.total})`);
  return lines.join('\n');
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  const result = runRestoreDrill(options);
  process.stdout.write(`${options.json ? JSON.stringify(result, null, 2) : formatHumanReport(result)}\n`);
  process.exitCode = result.ready ? 0 : 1;
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write('Production restore drill failed.\n');
    process.exitCode = 1;
  }
}

module.exports = {
  normalizePostgresCliUrl,
  resolvePrismaInvocation,
  isHarmlessTransactionTimeoutCompatibilityWarning,
  formatHumanReport,
  parseArguments,
  parseDatabaseIdentity,
  runRestoreDrill,
  validateRestoreTarget,
  checkEmptyRestoreTarget,
};
