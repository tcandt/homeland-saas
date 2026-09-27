import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PaginatedResult } from '@homeland/shared';
import { LeadStatus, SalesLead } from '@prisma/client';

const STATUS_ALIASES: Record<string, string> = {
  NEW: 'NEW',
  LEAD: 'NEW',
  CONTACTED: 'CONTACTED',
  CALLED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  CONSULTING: 'QUALIFIED',
  PROPOSAL: 'PROPOSAL',
  VIEWING: 'PROPOSAL',
  NEGOTIATING: 'PROPOSAL',
  WON: 'WON',
  DEPOSIT: 'WON',
  LOST: 'LOST',
};

const SALES_SUMMARY_LEAD_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ACTIVE_LEAD_STATUSES = [
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.PROPOSAL,
] as const;

const STALE_LEAD_EXCLUDED_STATUSES: LeadStatus[] = [LeadStatus.WON, LeadStatus.LOST];

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async listLeads(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    sort?: string,
    order?: string,
  ): Promise<PaginatedResult<SalesLead>> {
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      const normalized = STATUS_ALIASES[status.toUpperCase()] || status.toUpperCase();
      where.status = normalized;
    }

    const safeLimit = Math.min(Math.max(limit || 20, 1), 500);
    const safePage = Math.max(page || 1, 1);
    const skip = (safePage - 1) * safeLimit;
    const orderBy = { [sort || 'createdAt']: order || 'desc' } as any;

    const [data, total] = await Promise.all([
      this.prisma.tx.salesLead.findMany({
        where,
        orderBy,
        skip,
        take: safeLimit,
      }),
      this.prisma.tx.salesLead.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        hasNextPage: safePage * safeLimit < total,
        hasPreviousPage: safePage > 1,
      },
    };
  }

  async getSummary(tenantId: string) {
    const staleBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [byStatus, staleCount, newestLeads] = await Promise.all([
      this.prisma.salesLead.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.salesLead.count({
        where: {
          tenantId,
          deletedAt: null,
          updatedAt: { lt: staleBefore },
          status: { notIn: STALE_LEAD_EXCLUDED_STATUSES },
        },
      }),
      this.prisma.salesLead.findMany({
        where: { tenantId, deletedAt: null },
        select: SALES_SUMMARY_LEAD_SELECT,
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
    ]);

    const stageCounts = Object.values(LeadStatus).reduce(
      (counts, status) => ({ ...counts, [status]: 0 }),
      {} as Record<LeadStatus, number>,
    );
    for (const row of byStatus) stageCounts[row.status] = row._count._all;

    const total = Object.values(stageCounts).reduce((sum, count) => sum + count, 0);
    const activeCount = ACTIVE_LEAD_STATUSES.reduce(
      (sum, status) => sum + stageCounts[status],
      0,
    );

    return {
      total,
      activeCount,
      staleCount,
      stageCounts,
      newestLeads,
    };
  }

  async getDetail(id: string) {
    return this.prisma.tx.salesLead.findUnique({
      where: { id },
    });
  }
}
