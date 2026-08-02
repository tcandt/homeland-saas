import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PaginatedResult } from '@homeland/shared';
import { SalesLead } from '@prisma/client';

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

  async getDetail(id: string) {
    return this.prisma.tx.salesLead.findUnique({
      where: { id },
    });
  }
}
