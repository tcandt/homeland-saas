#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createPostgresCliEnv } = require('./postgres-cli');

function parseArguments(argv) {
  const options = {
    envFile: null,
    envManagedExternally: false,
    outputDir: '.codex-backups/production',
    storageDir: 'storage',
    skipDb: false,
    skipStorage: false,
    pgDump: process.env.PG_DUMP_PATH || 'pg_dump',
    type: 'manual',
    note: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--env-file') {
      options.envFile = argv[index + 1] || null;
      index += 1;
    } else if (argument === '--env-managed-externally') {
      options.envManagedExternally = true;
    } else if (argument === '--output-dir') {
      options.outputDir = argv[index + 1] || options.outputDir;
      index += 1;
    } else if (argument === '--storage-dir') {
      options.storageDir = argv[index + 1] || options.storageDir;
      index += 1;
    } else if (argument === '--pg-dump') {
      options.pgDump = argv[index + 1] || options.pgDump;
      index += 1;
    } else if (argument === '--type') {
      options.type = argv[index + 1];
      index += 1;
    } else if (argument === '--note') {
      options.note = argv[index + 1] || '';
      index += 1;
    } else if (argument === '--skip-db') {
      options.skipDb = true;
    } else if (argument === '--skip-storage') {
      options.skipStorage = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (options.envFile && options.envManagedExternally) {
    throw new Error('--env-file and --env-managed-externally cannot be used together.');
  }
  if (!['manual', 'daily_schedule', 'pre_update'].includes(options.type)) {
    throw new Error('Backup type is invalid.');
  }
  options.note = options.note.slice(0, 500);

  return options;
}

function loadEnvFile(envFile) {
  if (!envFile) return;
  const resolved = path.resolve(envFile);
  if (!fs.existsSync(resolved)) throw new Error(`Environment file not found: ${resolved}`);
  require('dotenv').config({ path: resolved });
}

function ensureInside(parent, child) {
  const parentResolved = path.resolve(parent);
  const childResolved = path.resolve(child);
  if (childResolved !== parentResolved && !childResolved.startsWith(parentResolved + path.sep)) {
    throw new Error(`Unsafe path outside backup root: ${childResolved}`);
  }
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function fileRecord(baseDir, filePath) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Backup file validation failed.');
  return {
    path: path.relative(baseDir, filePath).replace(/\\/g, '/'),
    size: stat.size,
    sha256: sha256File(filePath),
  };
}

function normalizePostgresCliUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  for (const key of ['schema', 'connection_limit', 'pool_timeout', 'pgbouncer', 'statement_cache_size']) {
    parsed.searchParams.delete(key);
  }
  return parsed.toString();
}

function copyFileWithParents(sourceRoot, targetRoot, sourcePath) {
  const relative = path.relative(sourceRoot, sourcePath);
  const targetPath = path.join(targetRoot, relative);
  ensureInside(targetRoot, targetPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  return targetPath;
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
    } else if (stat.isFile()) {
      files.push(current);
    }
  }
  return files.sort();
}

function runPgDump(options, backupDir, deps = {}) {
  if (options.skipDb) return null;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required unless --skip-db is used.');

  const dumpPath = path.join(backupDir, 'database.dump');
  ensureInside(backupDir, dumpPath);
  const { env } = createPostgresCliEnv(databaseUrl, deps.env || process.env);
  const result = (deps.spawnSync || spawnSync)(options.pgDump, ['--format=custom', '--no-owner', '--no-acl', '--file', dumpPath], {
    stdio: 'pipe',
    encoding: 'utf8',
    env,
  });

  if (result.status !== 0) {
    throw new Error('Database dump command failed.');
  }

  return fileRecord(backupDir, dumpPath);
}

function copyEnvironmentFile(options, backupDir) {
  if (!options.envFile) return null;
  const source = path.resolve(options.envFile);
  if (!fs.existsSync(source)) throw new Error(`Environment file not found: ${source}`);
  const target = path.join(backupDir, '.env');
  ensureInside(backupDir, target);
  fs.copyFileSync(source, target);
  return fileRecord(backupDir, target);
}

function copyStorage(options, backupDir) {
  if (options.skipStorage) return { copied: false, files: [], incompleteReason: 'Storage backup was explicitly skipped.' };

  const sourceRoot = path.resolve(options.storageDir);
  if (!fs.existsSync(sourceRoot)) return { copied: false, files: [], incompleteReason: 'Storage source is unavailable.' };
  const pending = [sourceRoot];
  while (pending.length > 0) {
    const current = pending.pop();
    const currentStat = fs.lstatSync(current);
    if (currentStat.isSymbolicLink()) return { copied: false, files: [], incompleteReason: 'Storage source contains a symbolic link.' };
    if (currentStat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) pending.push(path.join(current, entry));
    }
  }

  const targetRoot = path.join(backupDir, 'storage');
  ensureInside(backupDir, targetRoot);
  fs.mkdirSync(targetRoot, { recursive: true });

  const files = walkFiles(sourceRoot).map((sourcePath) => {
    const targetPath = copyFileWithParents(sourceRoot, targetRoot, sourcePath);
    return fileRecord(targetRoot, targetPath);
  });

  const manifestPath = path.join(backupDir, 'storage-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ sourceRoot, files }, null, 2));
  return { copied: true, files, manifest: fileRecord(backupDir, manifestPath) };
}

function maybeCopyOffHost(backupDir, backupId, deps = {}) {
  const location = resolveOffHostLocation(backupId);
  if (!location) return null;

  const result = (deps.spawnSync || spawnSync)('rclone', ['copy', backupDir, location], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error('Off-host backup copy failed.');
  }
  const verified = (deps.spawnSync || spawnSync)('rclone', ['check', '--download', backupDir, location], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (verified.status !== 0) throw new Error('Off-host backup verification failed.');
  return location;
}

function resolveOffHostLocation(backupId) {
  const destination = process.env.BACKUP_RCLONE_DEST;
  return destination ? `${destination.replace(/\/+$/, '')}/${backupId}` : null;
}

function runBackup(options, deps = {}) {
  loadEnvFile(options.envFile);

  const startedAt = new Date();
  const backupId = `${startedAt.toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}`;
  const outputRoot = path.resolve(options.outputDir);
  const backupDir = path.join(outputRoot, backupId);
  ensureInside(outputRoot, backupDir);
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.mkdirSync(backupDir, { mode: 0o700 });

  const manifest = {
    id: backupId,
    status: 'RUNNING',
    complete: false,
    startedAt: startedAt.toISOString(),
    completedAt: null,
    type: options.type || 'manual',
    note: options.note || '',
    version: process.env.APP_VERSION || null,
    commitSha: process.env.COMMIT_SHA || null,
    database: null,
    envFile: null,
    envManagedExternally: options.envManagedExternally === true,
    storage: null,
    offHostLocation: null,
    errors: [],
  };
  let resultManifest = manifest;

  try {
    manifest.envFile = copyEnvironmentFile(options, backupDir);
    manifest.database = runPgDump(options, backupDir, deps);
    manifest.storage = copyStorage(options, backupDir);
    const incomplete = [
      !manifest.database && 'Database component is incomplete.',
      !manifest.envFile && !manifest.envManagedExternally && 'Environment component is incomplete.',
      (!manifest.storage || manifest.storage.copied !== true) && (manifest.storage?.incompleteReason || 'Storage component is incomplete.'),
    ].filter(Boolean);
    if (incomplete.length > 0) {
      manifest.status = 'INCOMPLETE';
      manifest.errors.push(...incomplete);
      process.exitCode = 1;
    } else {
      manifest.status = 'SUCCESS';
      manifest.complete = true;
    }
  } catch (error) {
    manifest.status = 'FAILED';
    manifest.errors.push('Backup execution failed.');
    process.exitCode = 1;
  } finally {
    manifest.completedAt = new Date().toISOString();
    const manifestPath = path.join(backupDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    if (manifest.status === 'SUCCESS') {
      try {
        const offHostLocation = maybeCopyOffHost(backupDir, backupId, deps);
        if (offHostLocation) {
          const receipt = { backupId, status: 'VERIFIED', manifestSha256: sha256File(manifestPath), location: offHostLocation, verifiedAt: new Date().toISOString() };
          const receiptPath = path.join(backupDir, 'off-host-receipt.json');
          fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), { flag: 'wx' });
          try {
            const spawn = deps.spawnSync || spawnSync;
            const copy = spawn('rclone', ['copyto', receiptPath, `${offHostLocation}/off-host-receipt.json`], { stdio: 'pipe', encoding: 'utf8' });
            if (copy.status !== 0) throw new Error();
            const check = spawn('rclone', ['check', '--download', backupDir, offHostLocation], { stdio: 'pipe', encoding: 'utf8' });
            if (check.status !== 0) throw new Error();
          } catch {
            fs.writeFileSync(receiptPath, JSON.stringify({ ...receipt, status: 'FAILED' }, null, 2));
            throw new Error('Off-host receipt verification failed.');
          }
          resultManifest = { ...manifest, offHostLocation };
        }
      } catch {
        resultManifest = { ...manifest, status: 'FAILED', complete: false, errors: [...manifest.errors, 'Off-host backup copy failed.'] };
        fs.writeFileSync(manifestPath, JSON.stringify(resultManifest, null, 2));
        process.exitCode = 1;
      }
    }
    const latestPath = path.join(outputRoot, 'latest-manifest.json');
    if (fs.existsSync(latestPath) && fs.lstatSync(latestPath).isSymbolicLink()) {
      throw new Error('Backup index path is unsafe.');
    }
    const latestTempPath = path.join(outputRoot, `.latest-${crypto.randomUUID()}.json`);
    fs.writeFileSync(latestTempPath, JSON.stringify(resultManifest, null, 2), { flag: 'wx', mode: 0o600 });
    try {
      // Rename replaces the index itself; it never follows a swapped symlink.
      fs.renameSync(latestTempPath, latestPath);
    } finally {
      if (fs.existsSync(latestTempPath)) fs.unlinkSync(latestTempPath);
    }
    process.stdout.write(`${JSON.stringify({ manifestPath, status: resultManifest.status }, null, 2)}\n`);
  }

  return resultManifest;
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  runBackup(options);
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write('Production backup failed.\n');
    process.exitCode = 1;
  }
}

module.exports = {
  normalizePostgresCliUrl,
  parseArguments,
  runBackup,
  walkFiles,
};
