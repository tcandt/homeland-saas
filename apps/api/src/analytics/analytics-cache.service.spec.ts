import { describe, expect, it, vi } from 'vitest';
import { AnalyticsCacheService } from './analytics-cache.service';

describe('AnalyticsCacheService finance invalidation', () => {
  it('invalidates each tenant finance key, including debt analytics', async () => {
    const cacheManager = { del: vi.fn().mockResolvedValue(undefined) };
    const service = new AnalyticsCacheService(cacheManager as any);

    await service.invalidateFinance('tenant-a');

    expect(cacheManager.del).toHaveBeenCalledTimes(3);
    expect(cacheManager.del).toHaveBeenNthCalledWith(1, 'analytics:finance:tenant-a');
    expect(cacheManager.del).toHaveBeenNthCalledWith(2, 'analytics:revenue:tenant-a');
    expect(cacheManager.del).toHaveBeenNthCalledWith(3, 'analytics:debt:tenant-a');
  });
});
