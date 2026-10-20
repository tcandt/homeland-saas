import { describe, expect, it } from 'vitest';
import { syncPhaseLabel } from '../hunonic/sync-presentation';

describe('syncPhaseLabel', () => {
  it('only describes observed server phases', () => {
    expect(syncPhaseLabel('queued')).toBe('Đang chờ xử lý');
    expect(syncPhaseLabel('syncing')).toBe('Đang đồng bộ công tơ');
    expect(syncPhaseLabel('completed')).toBe('Đã hoàn tất');
    expect(syncPhaseLabel('unknown-provider-stage')).toBe('Đang xử lý');
  });
});
