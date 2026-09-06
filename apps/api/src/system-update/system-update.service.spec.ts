import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { SystemUpdateService } from './system-update.service';

vi.mock('child_process', () => ({
  execFileSync: vi.fn((command: string, args: string[]) => {
    if (command !== 'git') throw new Error('unexpected command');
    if (args[0] === 'rev-parse') return 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n';
    if (args[0] === 'ls-remote' && args[1] === '--tags') {
      return [
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\trefs/tags/v9.9.9',
        'cccccccccccccccccccccccccccccccccccccccc\trefs/tags/v1.0.0',
      ].join('\n');
    }
    if (args[0] === 'ls-remote') return 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\tHEAD\n';
    throw new Error('unexpected git args');
  }),
  spawn: vi.fn(),
}));

describe('SystemUpdateService', () => {
  beforeEach(() => {
    vi.stubEnv('SYSTEM_UPDATE_MODE', 'dry-run');
  });

  it('detects a remote version and creates a non-destructive install job by default', () => {
    const service = new SystemUpdateService();

    const check = service.checkForUpdates();
    expect(check.currentVersion).toMatch(/^v\d+\.\d+\.\d+/);
    expect(check.latestVersion).toBe('v9.9.9');
    expect(check.currentCommit).toMatch(/^a+/);
    expect(check.latestCommit).toMatch(/^b+/);
    expect(check.updateAvailable).toBe(true);
    expect(check.canInstallAutomatically).toBe(false);

    const job = service.startInstall({ targetVersion: check.latestVersion });
    expect(job.type).toBe('install');
    expect(job.status).toBe('BLOCKED');
    expect(job.progressPercent).toBe(100);
    expect(job.dryRun).toBe(true);
    expect(job.logs.join('\n')).toContain('chưa chạy runner thật');
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
