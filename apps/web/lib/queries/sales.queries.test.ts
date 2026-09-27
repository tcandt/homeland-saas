import { describe, expect, it } from 'vitest';
import { normalizeSalesLeadListPage, normalizeSalesSummary, salesKeys } from './sales.queries';

describe('sales summary query mapping', () => {
  it('preserves API summary values and supplies zeroes for absent lead stages', () => {
    expect(normalizeSalesSummary({
      total: 5,
      activeCount: 2,
      staleCount: 1,
      stageCounts: { NEW: 2, WON: 3 },
      newestLeads: [{ id: 'lead-1', name: 'Khach A', phone: '0901', status: 'NEW' }],
    })).toMatchObject({
      total: 5,
      activeCount: 2,
      staleCount: 1,
      stageCounts: { NEW: 2, CONTACTED: 0, WON: 3, LOST: 0 },
      newestLeads: [{ id: 'lead-1', name: 'Khach A' }],
    });
    expect(salesKeys.summary()).toEqual(['sales', 'summary']);
  });
});

describe('sales lead list query mapping', () => {
  it('uses API pagination metadata instead of treating the current page length as the total', () => {
    expect(normalizeSalesLeadListPage({
      data: [{ id: 'lead-1' }, { id: 'lead-2' }],
      meta: {
        page: 2,
        limit: 20,
        total: 73,
        totalPages: 4,
        hasNextPage: true,
        hasPreviousPage: true,
      },
    })).toEqual({
      items: [{ id: 'lead-1' }, { id: 'lead-2' }],
      total: 73,
      meta: {
        page: 2,
        limit: 20,
        total: 73,
        totalPages: 4,
        hasNextPage: true,
        hasPreviousPage: true,
      },
    });
  });
});
