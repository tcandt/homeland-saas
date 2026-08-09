import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FinanceReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getLedger(tenantId: string, options: { accountId?: string, costCenterId?: string, startDate?: string, endDate?: string } = {}) {
    const where: any = { tenantId };
    if (options.accountId) where.accountId = options.accountId;
    if (options.costCenterId) where.costCenterId = options.costCenterId;
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = new Date(options.startDate);
      if (options.endDate) where.createdAt.lte = new Date(options.endDate);
    }

    return this.prisma.journalLine.findMany({
      where,
      include: {
        account: true,
        costCenter: true,
        journalEntry: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCashFlow(tenantId: string) {
    const cashAccounts = await this.prisma.chartOfAccount.findMany({
      where: { tenantId, type: 'ASSET', name: { contains: 'Cash', mode: 'insensitive' } }
    });
    
    const bankAccounts = await this.prisma.chartOfAccount.findMany({
      where: { tenantId, type: 'ASSET', name: { contains: 'Bank', mode: 'insensitive' } }
    });
    
    const accounts = [...cashAccounts, ...bankAccounts];
    if (!accounts.length) return { inflow: 0, outflow: 0, net: 0 };
    
    const accountIds = accounts.map(a => a.id);
    
    const [debits, credits] = await Promise.all([
      this.prisma.journalLine.aggregate({
        where: { tenantId, accountId: { in: accountIds }, type: 'DEBIT' },
        _sum: { amount: true }
      }),
      this.prisma.journalLine.aggregate({
        where: { tenantId, accountId: { in: accountIds }, type: 'CREDIT' },
        _sum: { amount: true }
      })
    ]);
    
    const inflow = Number(debits._sum.amount || 0);
    const outflow = Number(credits._sum.amount || 0);
    
    return {
      inflow,
      outflow,
      net: inflow - outflow
    };
  }

  async getProfitLoss(tenantId: string) {
    const [revenues, expenses] = await Promise.all([
      this.prisma.journalLine.aggregate({
        where: { tenantId, account: { type: 'REVENUE' }, type: 'CREDIT' },
        _sum: { amount: true }
      }),
      this.prisma.journalLine.aggregate({
        where: { tenantId, account: { type: 'EXPENSE' }, type: 'DEBIT' },
        _sum: { amount: true }
      })
    ]);
    
    const revenueAmount = Number(revenues._sum.amount || 0);
    const expenseAmount = Number(expenses._sum.amount || 0);
    
    return {
      revenue: revenueAmount,
      expense: expenseAmount,
      profit: revenueAmount - expenseAmount,
      margin: revenueAmount > 0 ? ((revenueAmount - expenseAmount) / revenueAmount) * 100 : 0
    };
  }

  async getBuildingFinance(tenantId: string, buildingCode: string) {
    const costCenter = await this.prisma.costCenter.findUnique({
      where: { tenantId_code: { tenantId, code: `CC-${buildingCode}` } }
    });

    if (!costCenter) throw new BadRequestException(`Cost Center for building ${buildingCode} not found`);

    const [revenues, expenses] = await Promise.all([
      this.prisma.journalLine.aggregate({
        where: { tenantId, costCenterId: costCenter.id, account: { type: 'REVENUE' }, type: 'CREDIT' },
        _sum: { amount: true }
      }),
      this.prisma.journalLine.aggregate({
        where: { tenantId, costCenterId: costCenter.id, account: { type: 'EXPENSE' }, type: 'DEBIT' },
        _sum: { amount: true }
      })
    ]);

    return {
      building: buildingCode,
      revenue: Number(revenues._sum.amount || 0),
      expense: Number(expenses._sum.amount || 0),
      profit: Number(revenues._sum.amount || 0) - Number(expenses._sum.amount || 0)
    };
  }

  async getOwners(tenantId: string) {
    return this.prisma.owner.findMany({
      where: { tenantId, isActive: true },
      include: {
        buildings: {
          select: { id: true, code: true, name: true },
          orderBy: { displayOrder: 'asc' },
        },
        bankAccounts: {
          select: { id: true, bankName: true, accountNumber: true, accountName: true, isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async getExpenses(tenantId: string, options: { ownerId?: string; buildingId?: string; status?: string; startDate?: string; endDate?: string } = {}) {
    const where: any = { tenantId, deletedAt: null };
    if (options.ownerId) where.ownerId = options.ownerId;
    if (options.buildingId) where.buildingId = options.buildingId;
    if (options.status) where.status = options.status;
    if (options.startDate || options.endDate) {
      where.date = {};
      if (options.startDate) where.date.gte = new Date(options.startDate);
      if (options.endDate) where.date.lte = new Date(options.endDate);
    }

    return this.prisma.expense.findMany({
      where,
      include: {
        owner: { select: { id: true, code: true, name: true } },
        paidByOwner: { select: { id: true, code: true, name: true } },
        costCenter: { select: { id: true, code: true, name: true, buildingId: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async createExpense(tenantId: string, userId: string | undefined, data: any) {
    const amount = Number(data.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('EXPENSE_AMOUNT_INVALID');
    }

    const costCenter = await this.resolveCostCenter(tenantId, data.costCenterId, data.buildingId);
    const ownerId = data.ownerId || costCenter.ownerId;
    if (!ownerId) {
      throw new BadRequestException('EXPENSE_OWNER_REQUIRED');
    }

    const code = data.code || await this.nextExpenseCode(tenantId);
    const status = data.status || 'PENDING';
    const expense = await this.prisma.expense.create({
      data: {
        tenantId,
        code,
        costCenterId: costCenter.id,
        ownerId,
        buildingId: data.buildingId || costCenter.buildingId,
        roomId: data.roomId || null,
        paidByOwnerId: data.paidByOwnerId || null,
        paidByName: data.paidByName || null,
        category: data.category || 'OTHER',
        vendor: data.vendor || null,
        amount,
        status,
        settlementStatus: data.settlementStatus || (data.paidByOwnerId || data.paidByName ? 'PENDING_REIMBURSEMENT' : 'NONE'),
        description: data.description || null,
        attachmentUrls: Array.isArray(data.attachmentUrls) ? data.attachmentUrls : [],
        approvedBy: status === 'APPROVED' || status === 'PAID' ? userId : null,
        approvedAt: status === 'APPROVED' || status === 'PAID' ? new Date() : null,
        date: data.date ? new Date(data.date) : new Date(),
      } as any,
    });

    if (status === 'PAID') {
      await this.postExpenseJournal(tenantId, expense);
    }

    return expense;
  }

  async approveExpense(tenantId: string, userId: string | undefined, id: string, markPaid = false) {
    const expense = await this.prisma.expense.findFirst({ where: { tenantId, id, deletedAt: null } });
    if (!expense) throw new BadRequestException('EXPENSE_NOT_FOUND');
    if (expense.status === 'CANCELLED') throw new BadRequestException('EXPENSE_CANCELLED');

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        status: markPaid ? 'PAID' : 'APPROVED',
        approvedBy: userId,
        approvedAt: expense.approvedAt || new Date(),
      } as any,
    });

    if (markPaid) {
      await this.postExpenseJournal(tenantId, updated);
    }

    return updated;
  }

  async getOwnerProfitSummary(tenantId: string) {
    const owners = await this.prisma.owner.findMany({
      where: { tenantId, isActive: true },
      include: { buildings: { select: { id: true, code: true, name: true } } },
      orderBy: { code: 'asc' },
    });

    return Promise.all(owners.map(async (owner) => {
      const [revenues, postedExpenses, directExpenses, advancedByOwner, owedToOtherOwners] = await Promise.all([
        this.prisma.journalLine.aggregate({
          where: { tenantId, costCenter: { ownerId: owner.id }, account: { type: 'REVENUE' }, type: 'CREDIT' },
          _sum: { amount: true },
        }),
        this.prisma.journalLine.aggregate({
          where: { tenantId, costCenter: { ownerId: owner.id }, account: { type: 'EXPENSE' }, type: 'DEBIT' },
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: { tenantId, ownerId: owner.id, status: { in: ['APPROVED', 'PAID'] as any }, deletedAt: null },
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: { tenantId, paidByOwnerId: owner.id, ownerId: { not: owner.id }, status: { in: ['APPROVED', 'PAID'] as any }, deletedAt: null },
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: { tenantId, ownerId: owner.id, paidByOwnerId: { not: null }, NOT: { paidByOwnerId: owner.id }, status: { in: ['APPROVED', 'PAID'] as any }, deletedAt: null },
          _sum: { amount: true },
        }),
      ]);

      const revenue = Number(revenues._sum.amount || 0);
      const journalExpense = Number(postedExpenses._sum.amount || 0);
      const operationalExpense = Number(directExpenses._sum.amount || 0);
      const expense = Math.max(journalExpense, operationalExpense);
      const advanced = Number(advancedByOwner._sum.amount || 0);
      const payableAdvance = Number(owedToOtherOwners._sum.amount || 0);

      return {
        owner: { id: owner.id, code: owner.code, name: owner.name },
        buildings: owner.buildings,
        revenue,
        expense,
        profitBeforeAdvance: revenue - expense,
        advanceReceivable: advanced,
        advancePayable: payableAdvance,
        profitAfterAdvance: revenue - expense - payableAdvance + advanced,
      };
    }));
  }

  private async resolveCostCenter(tenantId: string, costCenterId?: string, buildingId?: string) {
    if (costCenterId) {
      const costCenter = await this.prisma.costCenter.findFirst({ where: { tenantId, id: costCenterId } });
      if (!costCenter) throw new BadRequestException('COST_CENTER_NOT_FOUND');
      return costCenter;
    }

    if (!buildingId) throw new BadRequestException('COST_CENTER_OR_BUILDING_REQUIRED');
    const building = await this.prisma.building.findFirst({ where: { tenantId, id: buildingId, deletedAt: null } });
    if (!building) throw new BadRequestException('BUILDING_NOT_FOUND');

    const costCenter = await this.prisma.costCenter.findFirst({ where: { tenantId, buildingId } });
    if (costCenter) return costCenter;

    const costCenterByCode = await this.prisma.costCenter.findUnique({
      where: { tenantId_code: { tenantId, code: `CC-${building.code}` } },
    });
    if (costCenterByCode) {
      return this.prisma.costCenter.update({
        where: { id: costCenterByCode.id },
        data: { ownerId: building.ownerId, buildingId },
      });
    }

    return this.prisma.costCenter.create({
      data: {
        tenantId,
        ownerId: building.ownerId,
        buildingId,
        code: `CC-${building.code}`,
        name: `Chi nhanh ${building.code}`,
      },
    });
  }

  private async nextExpenseCode(tenantId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.expense.count({ where: { tenantId, code: { startsWith: `EXP-${year}-` } } });
    return `EXP-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async postExpenseJournal(tenantId: string, expense: any) {
    const existing = await this.prisma.journalEntry.findFirst({
      where: { tenantId, sourceType: 'EXPENSE' as any, sourceId: expense.id, status: 'POSTED' },
    });
    if (existing) return existing;

    const [expenseAccount, bankAccount] = await Promise.all([
      this.prisma.chartOfAccount.findFirst({ where: { tenantId, type: 'EXPENSE', code: '5400' } }),
      this.prisma.chartOfAccount.findFirst({ where: { tenantId, type: 'ASSET', code: '1100' } }),
    ]);
    if (!expenseAccount || !bankAccount) return null;

    return this.prisma.journalEntry.create({
      data: {
        tenantId,
        code: `JE-EXP-${expense.code}`,
        sourceType: 'EXPENSE' as any,
        sourceId: expense.id,
        description: expense.description || `Expense ${expense.code}`,
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            {
              tenantId,
              accountId: expenseAccount.id,
              costCenterId: expense.costCenterId,
              type: 'DEBIT' as any,
              amount: expense.amount,
              description: expense.description,
            },
            {
              tenantId,
              accountId: bankAccount.id,
              costCenterId: expense.costCenterId,
              type: 'CREDIT' as any,
              amount: expense.amount,
              description: expense.description,
            },
          ],
        },
      },
    });
  }
}
