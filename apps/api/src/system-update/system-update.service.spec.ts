import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { hashSync } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SystemUpdateService } from './system-update.service';
import { SystemUpdateController } from './system-update.controller';

const { execFileMock, execFileSyncMock, spawnMock, resolveBackupRuntimeMock, runBackupScriptMock, verifyBackupBundleMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  execFileSyncMock: vi.fn(),
  spawnMock: vi.fn(),
  resolveBackupRuntimeMock: vi.fn(),
  runBackupScriptMock: vi.fn(),
  verifyBackupBundleMock: vi.fn(),
}));

vi.mock('./system-backup.runtime', () => ({
  assertNoBackupSymlinks: vi.fn(),
  resolveBackupRuntime: resolveBackupRuntimeMock,
  runBackupScript: runBackupScriptMock,
  verifyBackupBundle: verifyBackupBundleMock,
}));

vi.mock('child_process', () => ({
  execFile: execFileMock,
  execFileSync: execFileSyncMock,
  spawn: spawnMock,
}));

function createMockChildProcess() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;

function mockGitWithTags(tags: string, remoteCommit = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb') {
  execFileMock.mockImplementation((command: string, args: string[], _options: unknown, callback: ExecFileCallback) => {
    if (command !== 'git') {
      callback(new Error('unexpected command'), '', '');
    } else if (args[0] === 'ls-remote' && args[1] === '--tags') {
      callback(null, tags, '');
    } else if (args[0] === 'ls-remote') {
      callback(null, `${remoteCommit}\tHEAD\n`, '');
    } else {
      callback(new Error('unexpected git args'), '', '');
    }
    return {};
  });
}

function failRemoteGit(message = 'git credentials unavailable') {
  execFileMock.mockImplementation((_command: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
    callback(new Error(message), '', '');
    return {};
  });
}

function mockRemotePackageVersion(
  version: string,
  remoteCommit = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  relation: 'ahead' | 'behind' | 'diverged' | 'identical' = 'ahead',
) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/commits?')) {
      return { ok: true, status: 200, json: async () => [{ sha: remoteCommit }] };
    }
    if (url.includes('/tags?')) {
      return { ok: true, status: 200, json: async () => [] };
    }
    if (url.includes('/compare/')) {
      return { ok: true, status: 200, json: async () => ({ status: relation }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        encoding: 'base64',
        content: Buffer.from(JSON.stringify({ version })).toString('base64'),
      }),
    };
  }));
}

describe('SystemUpdateService', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    resolveBackupRuntimeMock.mockReset().mockReturnValue({
      workspaceRoot: resolve(tmpdir(), 'homeland-service-fixture-workspace'),
      backupRoot: resolve(tmpdir(), 'homeland-service-fixture-empty'),
      storageRoot: resolve(tmpdir(), 'homeland-service-fixture-storage'),
    });
    runBackupScriptMock.mockReset();
    verifyBackupBundleMock.mockReset().mockResolvedValue(false);
    vi.stubEnv('SYSTEM_BACKUP_ENABLED', 'true');
    vi.stubEnv('DATABASE_URL', 'postgresql://fixture:fixture@localhost/fixture');
    execFileSyncMock.mockImplementation((command: string, args: string[]) => {
      if (command === 'git' && args[0] === 'rev-parse') return 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n';
      throw new Error('unexpected local git args');
    });
    vi.stubEnv('SYSTEM_UPDATE_MODE', 'dry-run');
    vi.stubEnv('APP_VERSION', 'v1.2.9');
    vi.stubEnv('SYSTEM_UPDATE_ALLOW_PRERELEASE', 'false');
    vi.stubEnv('SYSTEM_UPDATE_CHECK_CACHE_MS', '300000');
    mockGitWithTags([
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\trefs/tags/v9.9.9',
      'cccccccccccccccccccccccccccccccccccccccc\trefs/tags/v1.0.0',
    ].join('\n'));
    mockRemotePackageVersion('1.2.9');
  });

  it('reads and updates the tenant-backed backup schedule', async () => {
    let scheduleValue: any = { enabled: false };
    const prisma: any = {
      appSetting: {
        findUnique: vi.fn(async () => ({ value: scheduleValue })),
        upsert: vi.fn(async (args: any) => {
          scheduleValue = args.update.value;
          return { value: scheduleValue };
        }),
      },
    };
    const service = new SystemUpdateService(prisma);

    await expect(service.getBackupStatus('tenant-1')).resolves.toMatchObject({
      scheduleEnabled: false,
      scheduleCron: '0 2 * * *',
    });
    await expect(service.updateBackupSchedule('tenant-1', 'user-1', true)).resolves.toMatchObject({
      scheduleEnabled: true,
    });
    expect(prisma.appSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        tenantId: 'tenant-1',
        ownerId: 'tenant-1',
        value: expect.objectContaining({ enabled: true }),
      }),
    }));
  });

  it('runs a single scheduled snapshot only when at least one tenant enables it', async () => {
    const prisma: any = {
      appSetting: {
        findMany: vi.fn().mockResolvedValue([
          { value: { enabled: false } },
          { value: { enabled: true } },
        ]),
      },
    };
    const service = new SystemUpdateService(prisma);
    const createSnapshot = vi.spyOn(service, 'createBackupSnapshot').mockResolvedValue({} as any);

    await service.runScheduledBackup();

    expect(createSnapshot).toHaveBeenCalledTimes(1);
    expect(createSnapshot).toHaveBeenCalledWith({
      note: 'Sao lưu tự động hàng ngày lúc 02:00',
      type: 'daily_schedule',
    });
  });

  it('rejects path-like snapshot identifiers before delete or restore', async () => {
    const service = new SystemUpdateService({} as any);

    await expect(service.deleteBackupSnapshot('../outside')).rejects.toThrow('không hợp lệ');
    await expect(service.restoreBackupSnapshot('user-1', 'tenant-1', {
      snapshotId: '..\\outside',
      password: 'secret',
    })).rejects.toThrow('không hợp lệ');
  });

  it('fails closed for valid online restores instead of deleting financial rows', async () => {
    const service = new SystemUpdateService({} as any);
    await expect(service.restoreBackupSnapshot('user-1', 'tenant-1', {
      snapshotId: 'snapshot-safe-id',
      password: 'secret',
    })).rejects.toThrow('đang bị khóa');
  });

  it('requires explicit full-backup configuration for create and schedule enablement', async () => {
    vi.stubEnv('SYSTEM_BACKUP_ENABLED', 'false');
    const prisma: any = { appSetting: { upsert: vi.fn() } };
    const service = new SystemUpdateService(prisma);
    await expect(service.createBackupSnapshot()).rejects.toThrow('not configured');
    await expect(service.updateBackupSchedule('tenant-1', 'user-1', true)).rejects.toThrow('not configured');
    expect(runBackupScriptMock).not.toHaveBeenCalled();
    expect(prisma.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('restricts global backup metadata to the same system admin as create/delete', () => {
    const service = { getBackupStatus: vi.fn() };
    const controller = new SystemUpdateController(service as any);
    expect(() => controller.getBackups('tenant-1', 'manager@homeland.vn')).toThrow('Chỉ admin@homeland.vn');
    expect(service.getBackupStatus).not.toHaveBeenCalled();
    controller.getBackups('tenant-1', 'admin@homeland.vn');
    expect(service.getBackupStatus).toHaveBeenCalledWith('tenant-1');
  });

  it('runs the full backup runner and verifier without reading seven Prisma tables', async () => {
    const runtime = resolveBackupRuntimeMock();
    const manifestPath = join(runtime.backupRoot, 'snapshot-a', 'manifest.json');
    runBackupScriptMock.mockResolvedValue({ status: 'SUCCESS', manifestPath });
    verifyBackupBundleMock.mockResolvedValue(true);
    const prisma: any = { contract: { findMany: vi.fn() } };
    const service = new SystemUpdateService(prisma);
    vi.spyOn(service, 'getBackupStatus').mockResolvedValue({ restoreSupported: false } as any);
    await service.createBackupSnapshot({ note: 'local fixture', type: 'pre_update' }, 'tenant-1');
    expect(runBackupScriptMock).toHaveBeenCalledWith(runtime.workspaceRoot, 'production-backup.js', [
      '--env-managed-externally', '--output-dir', runtime.backupRoot, '--storage-dir', runtime.storageRoot,
      '--type', 'pre_update', '--note', 'local fixture',
    ]);
    expect(verifyBackupBundleMock).toHaveBeenCalledWith(runtime.workspaceRoot, manifestPath);
    expect(prisma.contract.findMany).not.toHaveBeenCalled();
  });

  it('rejects a successful-looking bundle that fails verification and releases the lock', async () => {
    const service = new SystemUpdateService();
    const runtime = resolveBackupRuntimeMock();
    runBackupScriptMock.mockResolvedValue({ status: 'SUCCESS', manifestPath: join(runtime.backupRoot, 'snapshot-a', 'manifest.json') });
    await expect(service.createBackupSnapshot()).rejects.toThrow('failed verification');
    await expect(service.createBackupSnapshot()).rejects.toThrow('failed verification');
    expect(runBackupScriptMock).toHaveBeenCalledTimes(2);
  });

  it('rejects overlapping manual backups while a full runner is active', async () => {
    const service = new SystemUpdateService();
    const runtime = resolveBackupRuntimeMock();
    let finish: (result: any) => void;
    runBackupScriptMock.mockReturnValue(new Promise((resolveResult) => { finish = resolveResult; }));
    verifyBackupBundleMock.mockResolvedValue(true);
    vi.spyOn(service, 'getBackupStatus').mockResolvedValue({} as any);
    const running = service.createBackupSnapshot();
    await expect(service.createBackupSnapshot()).rejects.toThrow('already running');
    finish!({ status: 'SUCCESS', manifestPath: join(runtime.backupRoot, 'snapshot-a', 'manifest.json') });
    await running;
    expect(runBackupScriptMock).toHaveBeenCalledTimes(1);
  });

  it('does not promote legacy, incomplete, failed or corrupt manifests to READY', async () => {
    const root = mkdtempSync(join(tmpdir(), 'homeland-backup-status-'));
    resolveBackupRuntimeMock.mockReturnValue({ workspaceRoot: root, backupRoot: root, storageRoot: join(root, 'unused') });
    try {
      for (const [id, status] of [['legacy', 'READY'], ['incomplete', 'INCOMPLETE'], ['failed', 'FAILED'], ['candidate', 'SUCCESS']]) {
        mkdirSync(join(root, id));
        writeFileSync(join(root, id, 'manifest.json'), JSON.stringify({ id, status, complete: status === 'SUCCESS', summary: { totalSizeBytes: 1845200 } }));
      }
      mkdirSync(join(root, 'broken'));
      writeFileSync(join(root, 'broken', 'manifest.json'), 'invalid-json');
      const service = new SystemUpdateService();
      const invalid = await service.getBackupStatus();
      expect(invalid.backups.map((b) => b.status)).not.toContain('READY');
      expect(invalid.storageUsedBytes).toBe(0);
      expect(invalid.lastBackupAt).toBeNull();
      expect(invalid.restoreSupported).toBe(false);
      verifyBackupBundleMock.mockResolvedValue(true);
      const verified = await service.getBackupStatus();
      expect(verified.backups.filter((b) => b.status === 'READY').map((b) => b.id)).toEqual(['candidate']);
    } finally {
      rmSync(root, { recursive: true });
    }
  });

  it('detects a remote version and creates a non-destructive install job by default', async () => {
    const service = new SystemUpdateService();

    const check = await service.checkForUpdates();
    expect(check.currentVersion).toMatch(/^v\d+\.\d+\.\d+/);
    expect(check.latestVersion).toBe('v9.9.9');
    expect(check.currentCommit).toMatch(/^a+/);
    expect(check.latestCommit).toMatch(/^b+/);
    expect(check.updateAvailable).toBe(true);
    expect(check.canInstallAutomatically).toBe(false);

    const job = await service.startInstall({ targetVersion: check.latestVersion });
    expect(job.type).toBe('install');
    expect(job.status).toBe('BLOCKED');
    expect(job.progressPercent).toBe(100);
    expect(job.dryRun).toBe(true);
    expect(job.targetRef).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(job.logs.join('\n')).toContain('chưa chạy runner thật');
  });

  it('uses package.json from the default branch when it is newer than the latest tag', async () => {
    mockGitWithTags('cccccccccccccccccccccccccccccccccccccccc\trefs/tags/v1.2.7');
    mockRemotePackageVersion('1.2.10');
    const service = new SystemUpdateService();

    const check = await service.checkForUpdates();

    expect(check.latestVersion).toBe('v1.2.10');
    expect(check.latestCommit).toMatch(/^b+/);
    expect(check.targetRef).toMatch(/^b+/);
    expect(check.versionSource).toBe('default-branch');
    expect(check.versionCheckStatus).toBe('ok');
    expect(check.updateAvailable).toBe(true);
  });

  it('detects v1.2.9 from the default branch when the running artifact and latest tag are v1.2.7', async () => {
    vi.stubEnv('APP_VERSION', 'v1.2.7');
    mockGitWithTags('cccccccccccccccccccccccccccccccccccccccc\trefs/tags/v1.2.7');
    mockRemotePackageVersion('1.2.9');
    const service = new SystemUpdateService();

    const check = await service.checkForUpdates();

    expect(check.currentVersion).toBe('v1.2.7');
    expect(check.latestVersion).toBe('v1.2.9');
    expect(check.versionSource).toBe('default-branch');
    expect(check.updateAvailable).toBe(true);
  });

  it('uses the default-branch SHA and offers an update when the semver is unchanged', async () => {
    mockGitWithTags('cccccccccccccccccccccccccccccccccccccccc\trefs/tags/v1.2.9');
    mockRemotePackageVersion('1.2.9', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    const service = new SystemUpdateService();

    const check = await service.checkForUpdates();

    expect(check.latestVersion).toBe('v1.2.9');
    expect(check.latestCommit).toMatch(/^b+/);
    expect(check.targetRef).toMatch(/^b+/);
    expect(check.versionSource).toBe('default-branch');
    expect(check.updateAvailable).toBe(true);
    expect(check.releaseHighlights.join(' ')).not.toMatch(/hiệu năng|bảo mật/i);
  });

  it.each(['behind', 'diverged'] as const)(
    'blocks a same-version remote commit when GitHub reports it as %s',
    async (relation) => {
      mockGitWithTags('cccccccccccccccccccccccccccccccccccccccc\trefs/tags/v1.2.9');
      mockRemotePackageVersion('1.2.9', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', relation);
      const service = new SystemUpdateService();

      const check = await service.checkForUpdates();

      expect(check.versionCheckStatus).toBe('unavailable');
      expect(check.updateAvailable).toBe(false);
      expect(check.canInstallAutomatically).toBe(false);
      expect(check.versionCheckError).toContain(relation);
    },
  );

  it('falls back to the GitHub API when git remote authentication is unavailable', async () => {
    failRemoteGit();
    const remoteCommit = 'ffffffffffffffffffffffffffffffffffffffff';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/commits?')) {
        return { ok: true, status: 200, json: async () => [{ sha: remoteCommit }] };
      }
      if (url.includes('/tags?')) {
        return { ok: true, status: 200, json: async () => [] };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          encoding: 'base64',
          content: Buffer.from(JSON.stringify({ version: '1.2.10' })).toString('base64'),
        }),
      };
    }));
    const service = new SystemUpdateService();

    const check = await service.checkForUpdates();

    expect(check.latestVersion).toBe('v1.2.10');
    expect(check.latestCommit).toBe(remoteCommit);
    expect(check.targetRef).toBe(remoteCommit);
    expect(check.versionCheckStatus).toBe('ok');
    expect(check.updateAvailable).toBe(true);
  });

  it('dereferences annotated release tags to their commit', async () => {
    mockGitWithTags([
      'dddddddddddddddddddddddddddddddddddddddd\trefs/tags/v9.9.10',
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\trefs/tags/v9.9.10^{}',
    ].join('\n'));
    const service = new SystemUpdateService();

    const check = await service.checkForUpdates();

    expect(check.latestVersion).toBe('v9.9.10');
    expect(check.latestCommit).toMatch(/^e+/);
    expect(check.targetRef).toMatch(/^e+/);
  });

  it('reports an unavailable remote instead of pretending the current version is latest', async () => {
    execFileSyncMock.mockImplementation((command: string, args: string[]) => {
      if (command === 'git' && args[0] === 'rev-parse') return 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n';
      throw new Error('remote unavailable');
    });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network unavailable'); }));
    const service = new SystemUpdateService();

    const check = await service.checkForUpdates();

    expect(check.updateAvailable).toBe(false);
    expect(check.versionCheckStatus).toBe('unavailable');
    expect(check.versionCheckError).toContain('Không thể xác minh đầy đủ phiên bản');
    expect(check.changelog.join(' ')).toContain('khóa cập nhật');
  });

  it('rejects install when no newer version exists', async () => {
    mockGitWithTags('cccccccccccccccccccccccccccccccccccccccc\trefs/tags/v1.2.8');
    mockRemotePackageVersion('1.2.9', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const service = new SystemUpdateService();

    await expect(service.startInstall({ targetVersion: 'v1.2.9' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ignores prerelease versions unless prerelease updates are explicitly enabled', async () => {
    mockGitWithTags([
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\trefs/tags/v9.9.9',
      'cccccccccccccccccccccccccccccccccccccccc\trefs/tags/v10.0.0-beta.1',
    ].join('\n'));
    mockRemotePackageVersion('10.0.0-beta.2');
    const service = new SystemUpdateService();

    const check = await service.checkForUpdates();

    expect(check.latestVersion).toBe('v9.9.9');
    expect(check.targetRef).toMatch(/^b+/);
    expect(check.versionSource).toBe('tag');
  });

  it('fails closed when release tags cannot be verified even if the default branch responds', async () => {
    failRemoteGit();
    const remoteCommit = 'ffffffffffffffffffffffffffffffffffffffff';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/tags?')) {
        return { ok: false, status: 503, json: async () => ({}) };
      }
      if (url.includes('/commits?')) {
        return { ok: true, status: 200, json: async () => [{ sha: remoteCommit }] };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          encoding: 'base64',
          content: Buffer.from(JSON.stringify({ version: '1.2.10' })).toString('base64'),
        }),
      };
    }));
    const service = new SystemUpdateService();

    const check = await service.checkForUpdates();

    expect(check.versionCheckStatus).toBe('unavailable');
    expect(check.updateAvailable).toBe(false);
    expect(check.canInstallAutomatically).toBe(false);
  });

  it('blocks installation when only tags can be checked', async () => {
    vi.stubEnv('SYSTEM_UPDATE_REPOSITORY', 'https://gitlab.example.com/acme/homeland-saas.git');
    vi.stubEnv('SYSTEM_UPDATE_MODE', 'enabled');
    mockGitWithTags('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\trefs/tags/v1.2.10');
    const service = new SystemUpdateService();

    const check = await service.checkForUpdates();
    expect(check.versionCheckStatus).toBe('tag-only');
    expect(check.updateAvailable).toBe(true);
    expect(check.canInstallAutomatically).toBe(false);
    await expect(service.startInstall({
      targetVersion: check.latestVersion,
      targetRef: check.targetRef,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a target snapshot that became stale before installation', async () => {
    mockGitWithTags('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\trefs/tags/v1.2.8');
    mockRemotePackageVersion('1.2.10', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    const service = new SystemUpdateService();
    const initial = await service.checkForUpdates();

    mockGitWithTags('cccccccccccccccccccccccccccccccccccccccc\trefs/tags/v1.2.8', 'cccccccccccccccccccccccccccccccccccccccc');
    mockRemotePackageVersion('1.2.11', 'cccccccccccccccccccccccccccccccccccccccc');

    await expect(service.startInstall({
      targetVersion: initial.latestVersion,
      targetRef: initial.targetRef,
    })).rejects.toMatchObject({ response: { code: 'SYSTEM_UPDATE_TARGET_STALE' } });
  });

  it('keeps Git credentials out of runner arguments and redacts runner output', async () => {
    vi.stubEnv('SYSTEM_UPDATE_MODE', 'enabled');
    vi.stubEnv('SYSTEM_UPDATE_GITHUB_TOKEN', 'secret-token-value');
    const child = createMockChildProcess();
    spawnMock.mockReturnValue(child);
    const service = new SystemUpdateService();
    const check = await service.checkForUpdates();

    const job = await service.startInstall({
      targetVersion: check.latestVersion,
      targetRef: check.targetRef,
      dryRun: false,
    });
    expect(job.status).toBe('CHECKING');
    expect(job.progressPercent).toBe(0);
    expect(job.logs.join(' ')).not.toContain('mô phỏng');
    const runnerArgs = spawnMock.mock.calls[0]?.[1] as string[];
    expect(runnerArgs.join(' ')).not.toContain('secret-token-value');
    expect(runnerArgs.join(' ')).toContain('https://github.com/tcandt/homeland-saas.git');

    child.stderr.emit('data', Buffer.from('Authorization: Bearer secret-'));
    child.stderr.emit('data', Buffer.from('token-value\n'));
    expect(job.logs.join('\n')).not.toContain('secret-token-value');
    expect(job.logs.join('\n')).toContain('[REDACTED]');
  });

  it('does not pass install-only display-version arguments to rollback runners', () => {
    vi.stubEnv('SYSTEM_UPDATE_MODE', 'enabled');
    const child = createMockChildProcess();
    spawnMock.mockReturnValue(child);
    const service = new SystemUpdateService();

    service.startRollback({ targetVersion: 'previous-sha', dryRun: false });

    const runnerArgs = spawnMock.mock.calls[0]?.[1] as string[];
    expect(runnerArgs).not.toContain('--target-display-version');
    expect(runnerArgs).not.toContain('-TargetDisplayVersion');
  });

  it('lets the rollback runner resolve the last installed release when no target is supplied', () => {
    vi.stubEnv('SYSTEM_UPDATE_MODE', 'enabled');
    const child = createMockChildProcess();
    spawnMock.mockReturnValue(child);
    const service = new SystemUpdateService();

    service.startRollback({ dryRun: false });

    const runnerArgs = spawnMock.mock.calls[0]?.[1] as string[];
    expect(runnerArgs).not.toContain('--target-version');
    expect(runnerArgs).not.toContain('-TargetVersion');
  });

  it('buffers split runner lines before applying terminal status', () => {
    vi.stubEnv('SYSTEM_UPDATE_MODE', 'enabled');
    const child = createMockChildProcess();
    spawnMock.mockReturnValue(child);
    const service = new SystemUpdateService();
    const job = service.startRollback({ dryRun: false });

    child.stdout.emit('data', Buffer.from('SYSTEM_UPDATE_STEP BLO'));
    child.stdout.emit('data', Buffer.from('CKED 100 Release prepared only.'));
    child.emit('close', 0);

    expect(job.status).toBe('BLOCKED');
    expect(job.finishedAt).toBeTruthy();
  });

  it('fails closed when the remote package uses Docker-incompatible build metadata', async () => {
    mockGitWithTags('cccccccccccccccccccccccccccccccccccccccc\trefs/tags/v1.2.8');
    mockRemotePackageVersion('1.2.10+build.5');
    const service = new SystemUpdateService();

    const check = await service.checkForUpdates();

    expect(check.versionCheckStatus).toBe('unavailable');
    expect(check.updateAvailable).toBe(false);
  });

  it('deduplicates cached version checks and supports an explicit refresh', async () => {
    const service = new SystemUpdateService();

    const first = await service.checkForUpdates();
    const gitCallsAfterFirst = execFileMock.mock.calls.length;
    const fetchCallsAfterFirst = vi.mocked(fetch).mock.calls.length;
    const cached = await service.checkForUpdates();

    expect(cached).toBe(first);
    expect(execFileMock).toHaveBeenCalledTimes(gitCallsAfterFirst);
    expect(fetch).toHaveBeenCalledTimes(fetchCallsAfterFirst);

    const refreshed = await service.checkForUpdates({ forceRefresh: true });
    expect(refreshed).not.toBe(first);
    expect(execFileMock.mock.calls.length).toBeGreaterThan(gitCallsAfterFirst);
    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(fetchCallsAfterFirst);
  });

  it('creates a rollback job without requiring destructive commands', () => {
    const service = new SystemUpdateService();
    const job = service.startRollback({ targetVersion: 'previous-sha' });

    expect(job.type).toBe('rollback');
    expect(job.toVersion).toBe('previous-sha');
    expect(job.status).toBe('BLOCKED');
  });

  describe('operational reset', () => {
    function resetFixture(fail = false) {
      const calls: { model: string; method: string; args: any }[] = [];
      const rows = new Map<string, { tenantId: string; [key: string]: unknown }[]>();
      const raw = vi.fn().mockResolvedValue(0);
      const tx = new Proxy({ $executeRawUnsafe: raw } as Record<string, any>, {
        get(target, model: string) {
          if (model in target) return target[model];
          rows.set(model, [{ tenantId: 'tenant-a' }, { tenantId: 'tenant-b' }]);
          target[model] = Object.fromEntries(['deleteMany', 'updateMany'].map(method => [method, vi.fn(async (args: any) => {
            calls.push({ model, method, args });
            if (fail && model === 'payment') throw new Error('fixture FK conflict');
            const current = rows.get(model)!;
            const selected = current.filter(row => row.tenantId === args.where.tenantId);
            rows.set(model, method === 'deleteMany'
              ? current.filter(row => row.tenantId !== args.where.tenantId)
              : current.map(row => row.tenantId === args.where.tenantId ? { ...row, ...args.data } : row));
            return { count: selected.length };
          })]));
          return target[model];
        },
      });
      const prisma = {
        user: { findUnique: vi.fn().mockResolvedValue({ passwordHash: hashSync('fixture-password', 4) }) },
        $transaction: vi.fn(async (callback: (value: any) => Promise<void>) => callback(tx)),
      };
      return { service: new SystemUpdateService(prisma as any), prisma, calls, rows, raw };
    }

    it('requires password and confirmation before opening a reset transaction', async () => {
      const { service, prisma } = resetFixture();
      for (const body of [
        { confirmPhrase: 'XAC NHAN XOA' },
        { password: 'fixture-password', confirmPhrase: 'wrong' },
        { password: 'wrong', confirmPhrase: 'XAC NHAN XOA' },
      ]) {
        await expect(service.wipeData('admin', 'tenant-a', body)).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('supports repeated resets, preserves configuration and scopes all ORM changes to the current tenant', async () => {
      const { service, calls, rows } = resetFixture();
      const body = { password: 'fixture-password', confirmPhrase: 'XAC NHAN XOA', scope: 'ALL_BUSINESS_DATA' };
      const first = await service.wipeData('admin', 'tenant-a', body);
      const second = await service.wipeData('admin', 'tenant-a', body);
      expect(first.deletedCounts).toMatchObject({ customers: 1, contracts: 1, invoices: 1, deposits: 1 });
      expect(second.success).toBe(true);
      expect(Object.values(second.deletedCounts).every(count => count === 0)).toBe(true);
      expect(calls.length).toBeGreaterThan(0);
      for (const { model, args } of calls) {
        expect(args.where.tenantId).toBe('tenant-a');
        expect(rows.get(model)).toContainEqual({ tenantId: 'tenant-b' });
      }
      const deleted = calls.filter(call => call.method === 'deleteMany').map(call => call.model);
      for (const model of ['building', 'floor', 'room', 'user', 'setting', 'hunonicMeterMapping', 'roomPaymentAccountRoute']) {
        expect(deleted).not.toContain(model);
      }
      expect(rows.get('room')).toContainEqual(expect.objectContaining({ tenantId: 'tenant-a', status: 'AVAILABLE' }));
      expect(rows.get('hunonicMeterMapping')).toContainEqual({
        tenantId: 'tenant-a', lastStatus: null, lastReadingKwh: null,
        lastAmountVnd: null, lastSyncedAt: null, raw: Prisma.DbNull,
      });
    });

    it('reports a failed transaction instead of returning a successful reset', async () => {
      const { service, raw } = resetFixture(true);
      await expect(service.wipeData('admin', 'tenant-a', {
        password: 'fixture-password', confirmPhrase: 'XAC NHAN XOA',
      })).rejects.toBeInstanceOf(ConflictException);
      expect(raw.mock.calls.at(-1)?.[0]).toContain('ENABLE');
    });
  });

  it('rejects overlapping update jobs', () => {
    const service = new SystemUpdateService();
    (service as any).currentJob = {
      id: 'upd_running',
      type: 'install',
      status: 'BUILDING',
      progressPercent: 60,
      fromVersion: 'v1.0.0',
      toVersion: 'v1.0.1',
      dryRun: false,
      startedAt: new Date().toISOString(),
      logs: [],
    };

    expect(() => service.startRollback({ targetVersion: 'previous-sha' })).toThrow(ConflictException);
  });
});
