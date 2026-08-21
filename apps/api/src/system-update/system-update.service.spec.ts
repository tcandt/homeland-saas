import { describe, expect, it, vi } from 'vitest';
import { SystemUpdateService } from './system-update.service';

vi.mock('child_process', () => ({
  execFileSync: vi.fn((command: string, args: string[]) => {
    if (command !== 'git') throw new Error('unexpected command');
    if (args[0] === 'rev-parse') return 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n';
    if (args[0] === 'ls-remote') return 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\tHEAD\n';
    throw new Error('unexpected git args');
  }),
}));

describe('SystemUpdateService', () => {
  it('detects a remote version and creates a non-destructive install job by default', () => {
    const service = new SystemUpdateService();

    const check = service.checkForUpdates();
    expect(check.currentVersion).toMatch(/^a+/);
    expect(check.latestVersion).toMatch(/^b+/);
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
});
