import { LeadStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SalesService } from './sales.service';

describe('SalesService summary', () => {
  it('aggregates active tenant, non-deleted lead stages and returns only its newest leads', async () => {
    const prisma: any = {
      salesLead: {
        groupBy: vi.fn().mockResolvedValue([
          { status: LeadStatus.NEW, _count: { _all: 3 } },
          { status: LeadStatus.WON, _count: { _all: 2 } },
          { status: LeadStatus.QUALIFIED, _count: { _all: 1 } },
        ]),
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([
          { id: 'lead-4', name: 'Khach A', phone: '0901', status: LeadStatus.NEW },
          { id: 'lead-3', name: 'Khach B', phone: '0902', status: LeadStatus.QUALIFIED },
        ]),
      },
    };

    const summary = await new SalesService(prisma).getSummary('tenant-a');

    expect(summary).toMatchObject({
      total: 6,
      activeCount: 1,
      staleCount: 2,
      stageCounts: {
        NEW: 3,
        CONTACTED: 0,
        QUALIFIED: 1,
        PROPOSAL: 0,
        WON: 2,
        LOST: 0,
      },
      newestLeads: [
        { id: 'lead-4', name: 'Khach A' },
        { id: 'lead-3', name: 'Khach B' },
      ],
    });
    expect(prisma.salesLead.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: { tenantId: 'tenant-a', deletedAt: null },
      _count: { _all: true },
    });
    expect(prisma.salesLead.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-a',
        deletedAt: null,
        status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
      }),
    }));
    expect(prisma.salesLead.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-a', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }));
  });
});
