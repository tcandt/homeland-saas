import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../shared/repositories/base.repository';
import { PrismaService } from '../prisma.service';
import { Invoice } from '@prisma/client';

@Injectable()
export class InvoicesRepository extends BaseRepository<Invoice, 'invoice'> {
  constructor(prisma: PrismaService) {
    super(prisma, 'invoice');
  }

  /**
   * Fetch a stable window for the invoice feed without an offset or count.
   * The caller supplies a decoded keyset cursor; this repository deliberately
   * does not know how cursors are encoded or which tenant they belong to.
   */
  async paginateCursor(
    where: any,
    limit: number,
    cursor: { createdAt: Date; id: string } | undefined,
    include?: any,
  ): Promise<{ data: Invoice[]; hasNextPage: boolean }> {
    const activeWhere: any = { ...where, deletedAt: null };
    if (cursor) {
      const existingAnd = Array.isArray(activeWhere.AND)
        ? activeWhere.AND
        : activeWhere.AND
          ? [activeWhere.AND]
          : [];
      activeWhere.AND = [
        ...existingAnd,
        {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        },
      ];
    }

    const rows = await this.model.findMany({
      where: activeWhere,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include,
    });
    return {
      data: rows.slice(0, limit),
      hasNextPage: rows.length > limit,
    };
  }
}
