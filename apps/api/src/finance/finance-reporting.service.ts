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
}
