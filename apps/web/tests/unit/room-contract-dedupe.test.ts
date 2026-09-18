import { describe, it, expect } from 'vitest';
import { deduplicateContracts } from '../../lib/adapters/contract-dedupe.adapter';

describe('D2-FIX-06: Contract Deduplication Adapter', () => {
  it('deduplicates identical contracts appearing through tenant and sharedTenants', () => {
    const raw = [
      { id: 'c-101', code: 'HD-P24-10-A', status: 'ACTIVE', monthlyRent: 7000000 },
      { id: 'c-101', code: 'HD-P24-10-A', status: 'ACTIVE', monthlyRent: 7000000 },
    ];
    const result = deduplicateContracts(raw);
    expect(result.allContracts).toHaveLength(1);
    expect(result.activeContracts).toHaveLength(1);
    expect(result.activeContracts[0].id).toBe('c-101');
  });

  it('deduplicates legacy contracts by code when id is missing', () => {
    const raw = [
      { code: 'HD-LEGACY-01', status: 'ACTIVE', monthlyRent: 5000000 },
      { code: 'HD-LEGACY-01', status: 'ACTIVE', monthlyRent: 5000000 },
    ];
    const result = deduplicateContracts(raw);
    expect(result.allContracts).toHaveLength(1);
    expect(result.allContracts[0].code).toBe('HD-LEGACY-01');
  });

  it('preserves distinct contracts with different IDs even if in same room', () => {
    const raw = [
      { id: 'c-1', code: 'HD-SHARED-1', status: 'ACTIVE', monthlyRent: 3500000 },
      { id: 'c-2', code: 'HD-SHARED-2', status: 'ACTIVE', monthlyRent: 3500000 },
    ];
    const result = deduplicateContracts(raw);
    expect(result.allContracts).toHaveLength(2);
    expect(result.activeContracts).toHaveLength(2);
  });

  it('separates active contracts from terminal historical contracts', () => {
    const raw = [
      { id: 'c-act', code: 'HD-ACTIVE', status: 'ACTIVE', monthlyRent: 6000000 },
      { id: 'c-exp', code: 'HD-OLD', status: 'EXPIRED', monthlyRent: 5500000 },
      { id: 'c-term', code: 'HD-TERMINATED', status: 'TERMINATED', monthlyRent: 5000000 },
    ];
    const result = deduplicateContracts(raw);
    expect(result.allContracts).toHaveLength(3);
    expect(result.activeContracts).toHaveLength(1);
    expect(result.activeContracts[0].id).toBe('c-act');
    expect(result.historicalContracts).toHaveLength(2);
  });

  it('reopen/refetch simulation does not change deduplicated contract count', () => {
    const raw = [
      { id: 'c-100', code: 'HD-100', status: 'ACTIVE' },
    ];
    const firstCall = deduplicateContracts(raw);
    const secondCall = deduplicateContracts([...raw, ...raw]);
    expect(firstCall.allContracts).toHaveLength(1);
    expect(secondCall.allContracts).toHaveLength(1);
  });
});
