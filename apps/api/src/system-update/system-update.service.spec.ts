import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { SystemUpdateService } from './system-update.service';

const { execFileMock, execFileSyncMock, spawnMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  execFileSyncMock: vi.fn(),
  spawnMock: vi.fn(),
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
