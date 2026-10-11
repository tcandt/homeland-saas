import { execFile } from 'child_process';
import { existsSync, lstatSync } from 'fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path';

export function assertNoBackupSymlinks(target: string) {
  let current = resolve(target);
  for (;;) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('Backup path is unsafe');
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function resolveBackupWorkspace(cwd: string) {
  let workspaceRoot = resolve(cwd);
  while (!existsSync(join(workspaceRoot, 'scripts', 'production-backup.js'))) {
    const parent = dirname(workspaceRoot);
    if (parent === workspaceRoot) throw new Error('Backup runner is unavailable');
    workspaceRoot = parent;
  }
  return workspaceRoot;
}

export function resolveBackupMonitoringPaths(cwd = process.cwd()) {
  const manifestOverride = process.env.BACKUP_MANIFEST_PATH;
  const reportOverride = process.env.BACKUP_RETENTION_REPORT_PATH;
  const workspaceRoot = manifestOverride && isAbsolute(manifestOverride) && (!reportOverride || isAbsolute(reportOverride))
    ? resolve(cwd) : resolveBackupWorkspace(cwd);
  const backupRoot = resolve(workspaceRoot, process.env.SYSTEM_BACKUP_DIR || '.codex-backups/production');
  const manifestPath = manifestOverride ? resolve(workspaceRoot, manifestOverride) : join(backupRoot, 'latest-manifest.json');
  const retentionReportPath = reportOverride
    ? resolve(workspaceRoot, reportOverride) : join(dirname(manifestPath), 'latest-retention-report.json');
  return { manifestPath, retentionReportPath };
}

export function resolveBackupRuntime(cwd = process.cwd()) {
  if ((process.env.STORAGE_PROVIDER || 'local') !== 'local') {
    throw new Error('Full backup requires supported local storage');
  }
  const workspaceRoot = resolveBackupWorkspace(cwd);
  const backupRoot = resolve(workspaceRoot, process.env.SYSTEM_BACKUP_DIR || '.codex-backups/production');
  // Match LocalStorageProvider, including its apps/api working-directory default.
  const storageRoot = resolve(cwd, process.env.STORAGE_DIR || 'storage');
  const contains = (parent: string, child: string) => {
    const path = relative(parent, child);
    return !path || (path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path));
  };
  if (contains(storageRoot, backupRoot) || contains(backupRoot, storageRoot)) {
    throw new Error('Backup and storage directories must be separate');
  }
  for (const directory of [backupRoot, storageRoot]) {
    assertNoBackupSymlinks(directory);
    if (existsSync(directory) && (lstatSync(directory).isSymbolicLink() || !lstatSync(directory).isDirectory())) {
      throw new Error('Backup directory is unsafe');
    }
  }
  if (!existsSync(join(workspaceRoot, 'scripts', 'production-restore-check.js'))) {
    throw new Error('Backup verifier is unavailable');
  }
  return { workspaceRoot, backupRoot, storageRoot };
}

export function runBackupScript(workspaceRoot: string, script: 'production-backup.js' | 'production-restore-check.js', args: string[]) {
  return new Promise<any>((resolveResult, reject) => {
    execFile(process.execPath, [join(workspaceRoot, 'scripts', script), ...args], {
      cwd: workspaceRoot,
      env: process.env,
      timeout: 30 * 60 * 1000,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
      encoding: 'utf8',
    }, (error, stdout) => {
      if (error) return reject(new Error('Backup operation failed'));
      try {
        resolveResult(JSON.parse(stdout));
      } catch {
        reject(new Error('Backup result is invalid'));
      }
    });
  });
}

export async function verifyBackupBundle(workspaceRoot: string, manifestPath: string): Promise<boolean> {
  try {
    const result = await runBackupScript(workspaceRoot, 'production-restore-check.js', [
      '--manifest', manifestPath, '--json',
    ]);
    return result?.ready === true && result?.summary?.failed === 0;
  } catch {
    return false;
  }
}
