import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveBackupRuntime, runBackupScript, verifyBackupBundle } from './system-backup.runtime';

const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }));
vi.mock('child_process', () => ({ execFile: execFileMock }));

const fixtures: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  execFileMock.mockReset();
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true });
});

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'homeland-backup-runtime-'));
  fixtures.push(root);
  mkdirSync(join(root, 'scripts'));
  writeFileSync(join(root, 'scripts', 'production-backup.js'), '// fixture');
  writeFileSync(join(root, 'scripts', 'production-restore-check.js'), '// fixture');
  mkdirSync(join(root, 'apps', 'api'), { recursive: true });
  vi.stubEnv('SYSTEM_BACKUP_DIR', '');
  vi.stubEnv('STORAGE_DIR', '');
  vi.stubEnv('STORAGE_PROVIDER', 'local');
  return root;
}

describe('full-backup runtime', () => {
  it('resolves repository runners from apps/api and preserves the storage provider default', () => {
    const root = workspace();
    expect(resolveBackupRuntime(join(root, 'apps', 'api'))).toEqual({
      workspaceRoot: root, backupRoot: join(root, '.codex-backups', 'production'), storageRoot: join(root, 'apps', 'api', 'storage'),
    });
  });

  it('rejects recursive or overlapping storage/backup roots', () => {
    const root = workspace();
    vi.stubEnv('STORAGE_DIR', join(root, 'storage'));
    vi.stubEnv('SYSTEM_BACKUP_DIR', join(root, 'storage', '..backup'));
    expect(() => resolveBackupRuntime(root)).toThrow('must be separate');
    vi.stubEnv('SYSTEM_BACKUP_DIR', root);
    expect(() => resolveBackupRuntime(root)).toThrow('must be separate');
  });

  it('refuses to claim a local file copy backs up S3 objects', () => {
    const root = workspace();
    vi.stubEnv('STORAGE_PROVIDER', 's3');
    expect(() => resolveBackupRuntime(root)).toThrow('supported local storage');
  });

  it('uses Node execFile without a shell and hides subprocess diagnostics', async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => callback(new Error('database-password'), '', 'database-password'));
    await expect(runBackupScript('/fixture', 'production-backup.js', ['--env-managed-externally'])).rejects.toThrow('Backup operation failed');
    const [command, args, options] = execFileMock.mock.calls[0];
    expect(command).toBe(process.execPath);
    expect(args.join(' ')).not.toContain('DATABASE_URL');
    expect(options.shell).toBeUndefined();
    expect(options.windowsHide).toBe(true);
  });

  it.each([{}, { ready: true, summary: { failed: 1 } }, { ready: false, summary: { failed: 0 } }])('fails closed for invalid verification results %j', async (result) => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => callback(null, JSON.stringify(result)));
    expect(await verifyBackupBundle('/fixture', '/fixture/bundle/manifest.json')).toBe(false);
  });

  it('accepts only a passing real-verifier result without disabling dump inspection', async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => callback(null, JSON.stringify({ ready: true, summary: { failed: 0 } })));
    expect(await verifyBackupBundle('/fixture', '/fixture/bundle/manifest.json')).toBe(true);
    expect(execFileMock.mock.calls[0][1]).not.toContain('--skip-pg-restore-list');
  });
});
