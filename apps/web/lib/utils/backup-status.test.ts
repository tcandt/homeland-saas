import { describe, expect, it } from 'vitest';
import { backupStatusLabel } from './backup-status';

describe('backup readiness labels', () => {
  it('never labels incomplete, failed, corrupt or unknown bundles as verified', () => {
    for (const status of ['INCOMPLETE', 'FAILED', 'CORRUPTED', 'UNKNOWN']) {
      expect(backupStatusLabel(status)).not.toBe('Đã kiểm tra');
    }
    expect(backupStatusLabel('READY')).toBe('Đã kiểm tra');
  });
});
