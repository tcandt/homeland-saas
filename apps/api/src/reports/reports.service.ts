import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCashFlow(tenantId: string) {
    const inflow = await this.prisma.journalLine.aggregate({
      where: {
        journalEntry: { tenantId, status: 'POSTED' },
        account: { code: { in: ['1000', '1100'] } },
        type: 'DEBIT'
      },
      _sum: { amount: true }
    });

    const outflow = await this.prisma.journalLine.aggregate({
      where: {
        journalEntry: { tenantId, status: 'POSTED' },
        account: { code: { in: ['1000', '1100'] } },
        type: 'CREDIT'
      },
      _sum: { amount: true }
    });

    return {
      totalInflow: Number(inflow._sum.amount || 0),
      totalOutflow: Number(outflow._sum.amount || 0),
      netCashFlow: Number(inflow._sum.amount || 0) - Number(outflow._sum.amount || 0),
      chartData: [
        { month: 'T1', inflow: 20000000, outflow: 5000000 },
        { month: 'T2', inflow: Number(inflow._sum.amount || 0), outflow: Number(outflow._sum.amount || 0) }
      ]
    };
  }

  async getProfitLoss(tenantId: string) {
    const revenueLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: { tenantId, status: 'POSTED' },
        account: { type: 'REVENUE' },
      }
    });

    const expenseLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: { tenantId, status: 'POSTED' },
        account: { type: 'EXPENSE' },
      }
    });

    const calculateNet = (lines: any[], normalType: 'CREDIT' | 'DEBIT') => {
      let sum = 0;
      for (const l of lines) {
        if (l.type === normalType) sum += Number(l.amount);
        else sum -= Number(l.amount);
      }
      return sum;
    };

    const totalRevenue = calculateNet(revenueLines, 'CREDIT');
    const totalExpenses = calculateNet(expenseLines, 'DEBIT');

    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      buildings: []
    };
  }

  async getRevenueByBuilding(tenantId: string) {
    return [];
  }

  async getDepositLiability(tenantId: string) {
    const deposits = await this.prisma.deposit.findMany({
      where: { tenantId, status: { in: ['PAID'] } },
      include: { customer: true, room: { include: { floor: { include: { building: true } } } } }
    });

    return deposits.map(d => ({
      code: d.code,
      customer: d.customer.fullName,
      room: d.room?.name || 'N/A',
      building: d.room?.floor.building.name || 'N/A',
      amount: Number(d.amount),
      date: d.createdAt
    }));
  }

  async getReceivableAging(tenantId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
      include: { customer: true }
    });

    return invoices.map((inv: any) => {
      const remaining = Math.max(
        0,
        Number(inv.total) - Number(inv.paidAmount || 0) - Number(inv.creditAmount || 0),
      );
      const daysOverdue = Math.max(0, Math.floor((new Date().getTime() - inv.dueDate.getTime()) / (1000 * 3600 * 24)));
      return {
        invoiceCode: inv.code || inv.id,
        customer: inv.customer?.fullName || 'Unknown',
        dueDate: inv.dueDate,
        totalAmount: Number(inv.total),
        remainingAmount: remaining,
        daysOverdue,
        agingBucket: daysOverdue === 0 ? 'Current' : daysOverdue <= 30 ? '1-30 Days' : daysOverdue <= 60 ? '31-60 Days' : '60+ Days'
      };
    });
  }

  async getRevenueByRoom(tenantId: string) {
    return [];
  }
}
