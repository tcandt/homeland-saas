#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArguments(argv) {
  const options = {
    envFile: null,
    envManagedExternally: false,
    outputDir: '.codex-backups/production',
    storageDir: 'storage',
    skipDb: false,
    skipStorage: false,
    pgDump: process.env.PG_DUMP_PATH || 'pg_dump',
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
  const stat = fs.statSync(filePath);
  return {
    path: path.relative(baseDir, filePath).replace(/\\/g, '/'),
    size: stat.size,
    sha256: sha256File(filePath),
  };
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

function runPgDump(options, backupDir) {
  if (options.skipDb) return null;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required unless --skip-db is used.');

  const dumpPath = path.join(backupDir, 'database.dump');
  ensureInside(backupDir, dumpPath);
  const result = spawnSync(options.pgDump, ['--format=custom', '--no-owner', '--no-acl', '--file', dumpPath, databaseUrl], {
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`pg_dump failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
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
  if (options.skipStorage) return { copied: false, files: [] };

  const sourceRoot = path.resolve(options.storageDir);
  if (!fs.existsSync(sourceRoot)) return { copied: false, files: [] };

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

function maybeCopyOffHost(backupDir, backupId) {
  const destination = process.env.BACKUP_RCLONE_DEST;
  if (!destination) return null;

  const result = spawnSync('rclone', ['copy', backupDir, `${destination.replace(/\/+$/, '')}/${backupId}`], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`rclone copy failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
  }
  return `${destination.replace(/\/+$/, '')}/${backupId}`;
}

function runBackup(options) {
  loadEnvFile(options.envFile);

  const startedAt = new Date();
  const backupId = startedAt.toISOString().replace(/[:.]/g, '-');
  const outputRoot = path.resolve(options.outputDir);
  const backupDir = path.join(outputRoot, backupId);
  ensureInside(outputRoot, backupDir);
  fs.mkdirSync(backupDir, { recursive: true });

  const manifest = {
    id: backupId,
    status: 'RUNNING',
    startedAt: startedAt.toISOString(),
    completedAt: null,
    database: null,
    envFile: null,
    envManagedExternally: options.envManagedExternally === true,
    storage: null,
    offHostLocation: null,
    errors: [],
  };

  try {
    manifest.envFile = copyEnvironmentFile(options, backupDir);
    manifest.database = runPgDump(options, backupDir);
    manifest.storage = copyStorage(options, backupDir);
    manifest.offHostLocation = maybeCopyOffHost(backupDir, backupId);
    manifest.status = 'SUCCESS';
  } catch (error) {
    manifest.status = 'FAILED';
    manifest.errors.push(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    manifest.completedAt = new Date().toISOString();
    const manifestPath = path.join(backupDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const latestPath = path.join(outputRoot, 'latest-manifest.json');
    fs.writeFileSync(latestPath, JSON.stringify(manifest, null, 2));
    process.stdout.write(`${JSON.stringify({ manifestPath, status: manifest.status }, null, 2)}\n`);
  }

  return manifest;
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  runBackup(options);
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`Production backup failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  parseArguments,
  runBackup,
  walkFiles,
};
