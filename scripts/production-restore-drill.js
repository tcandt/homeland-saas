#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { runRestoreCheck } = require('./production-restore-check');

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
    const parsed = new URL(databaseUrl);
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('?')[0]);
    return {
      protocol: parsed.protocol,
      host: parsed.hostname,
      port: parsed.port || null,
      databaseName,
      maskedUrl: `${parsed.protocol}//${parsed.username ? '***@' : ''}${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}/${databaseName}`,
    };
  } catch {
    throw new Error('Restore drill database URL is invalid.');
  }
}

function validateRestoreTarget(databaseUrl, confirmTargetDb) {
  if (!databaseUrl) {
    return fail('restore_target', 'Missing --database-url or RESTORE_DRILL_DATABASE_URL.');
  }

  const identity = parseDatabaseIdentity(databaseUrl);
  const databaseName = identity.databaseName;
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

  return pass('restore_target', `Restore target is explicitly confirmed: ${identity.maskedUrl}.`);
}

function runCommand(id, command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    env: options.env || process.env,
  });

  if (result.status !== 0) {
    const output = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    return fail(id, output || `${command} exited with ${result.status}.`);
  }

  return pass(id, options.successMessage || `${command} completed successfully.`);
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

  const targetCheck = validateRestoreTarget(options.databaseUrl, options.confirmTargetDb);
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

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const backupDir = inferBackupDir(manifestPath, manifest);
  const dumpPath = path.resolve(backupDir, manifest.database.path || '');
  const spawn = deps.spawnSync || spawnSync;

  const restoreResult = spawn(options.pgRestore, [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-acl',
    '--dbname',
    options.databaseUrl,
    dumpPath,
  ], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  checks.push(
    restoreResult.status === 0
      ? pass('pg_restore_drill', 'Database dump restored into the isolated drill database.')
      : fail('pg_restore_drill', [restoreResult.stderr, restoreResult.stdout].filter(Boolean).join('\n').trim() || 'pg_restore drill failed.'),
  );

  if (!options.skipMigrateStatus && restoreResult.status === 0) {
    checks.push(runCommand('prisma_migrate_status', options.prisma, [
      'migrate',
      'status',
      `--schema=${options.schema}`,
    ], {
      env: { ...process.env, DATABASE_URL: options.databaseUrl },
      successMessage: 'Prisma migration status can inspect the restored database.',
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
    process.stderr.write(`Production restore drill failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  formatHumanReport,
  parseArguments,
  parseDatabaseIdentity,
  runRestoreDrill,
  validateRestoreTarget,
};
