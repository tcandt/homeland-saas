import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { authoritativeJournalLineWhere, cashAccountWhere, normalBalance } from '../finance/journal-effect.policy';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCashFlow(tenantId: string) {
    const inflow = await this.prisma.journalLine.aggregate({
      where: {
        ...authoritativeJournalLineWhere(tenantId, { account: { tenantId, ...cashAccountWhere }, type: 'DEBIT' }),
      },
      _sum: { amount: true }
    });

    const outflow = await this.prisma.journalLine.aggregate({
      where: {
        ...authoritativeJournalLineWhere(tenantId, { account: { tenantId, ...cashAccountWhere }, type: 'CREDIT' }),
      },
      _sum: { amount: true }
    });

    return {
      totalInflow: Number(inflow._sum.amount || 0),
      totalOutflow: Number(outflow._sum.amount || 0),
      netCashFlow: Number(inflow._sum.amount || 0) - Number(outflow._sum.amount || 0),
      chartData: [
        { month: 'Current', inflow: Number(inflow._sum.amount || 0), outflow: Number(outflow._sum.amount || 0) },
      ]
    };
  }

  async getProfitLoss(tenantId: string) {
    const revenueLines = await this.prisma.journalLine.findMany({
      where: {
        ...authoritativeJournalLineWhere(tenantId, { account: { tenantId, type: 'REVENUE' } }),
      }
    });

    const expenseLines = await this.prisma.journalLine.findMany({
      where: {
        ...authoritativeJournalLineWhere(tenantId, { account: { tenantId, type: 'EXPENSE' } }),
      }
    });

    const totalRevenue = normalBalance(revenueLines, 'CREDIT') - await this.getBookingHoldInvoiceRevenueJournalTotal(tenantId);
    const totalExpenses = normalBalance(expenseLines, 'DEBIT');

    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      buildings: []
    };
  }

  async getRevenueByBuilding(tenantId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE', 'PAID'] as any },
      },
      include: {
        items: true,
        contract: {
          include: {
            room: {
              include: {
                building: true,
              },
            },
          },
        },
      },
    });

    const grouped = new Map<string, any>();
    for (const invoice of invoices.filter((item: any) => !this.isBookingHoldInvoice(item))) {
      const building = invoice.contract?.room?.building;
      const key = building?.id || 'unassigned';
      const row = grouped.get(key) || {
        buildingId: building?.id || null,
        buildingCode: building?.code || null,
        buildingName: building?.name || 'Chưa gắn tòa nhà',
        invoiceCount: 0,
        totalAmount: 0,
        paidAmount: 0,
        creditAmount: 0,
        remainingAmount: 0,
        revenueBreakdown: { rent: 0, electricity: 0, waterAndService: 0, other: 0 },
      };
      this.addInvoiceFinancials(row, invoice);
      this.addInvoiceItemBreakdown(row.revenueBreakdown, invoice.items || []);
      grouped.set(key, row);
    }

    return Array.from(grouped.values()).sort((left, right) => right.totalAmount - left.totalAmount);
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
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE', 'PAID'] as any },
      },
      include: {
        items: true,
        contract: {
          include: {
            room: {
              include: {
                building: true,
              },
            },
          },
        },
        customer: true,
      },
    });

    const grouped = new Map<string, any>();
    for (const invoice of invoices.filter((item: any) => !this.isBookingHoldInvoice(item))) {
      const room = invoice.contract?.room;
      const building = room?.building;
      const key = room?.id || invoice.contractId || invoice.customerId || 'unassigned';
      const row = grouped.get(key) || {
        roomId: room?.id || null,
        roomCode: room?.code || room?.name || 'Chưa gắn phòng',
        buildingId: building?.id || null,
        buildingCode: building?.code || null,
        buildingName: building?.name || 'Chưa gắn tòa nhà',
        customerId: invoice.customerId || null,
        customerName: invoice.customer?.fullName || 'Khách thuê',
        invoiceCount: 0,
        totalAmount: 0,
        paidAmount: 0,
        creditAmount: 0,
        remainingAmount: 0,
        revenueBreakdown: { rent: 0, electricity: 0, waterAndService: 0, other: 0 },
      };
      this.addInvoiceFinancials(row, invoice);
      this.addInvoiceItemBreakdown(row.revenueBreakdown, invoice.items || []);
      grouped.set(key, row);
    }

    return Array.from(grouped.values()).sort((left, right) => right.totalAmount - left.totalAmount);
  }

  private addInvoiceFinancials(target: any, invoice: any) {
    const total = Number(invoice.total || 0);
    const paid = Number(invoice.paidAmount || 0);
    const credit = Number(invoice.creditAmount || 0);
    target.invoiceCount += 1;
    target.totalAmount += total;
    target.paidAmount += paid;
    target.creditAmount += credit;
    target.remainingAmount += Math.max(0, total - paid - credit);
  }

  private addInvoiceItemBreakdown(target: any, items: any[]) {
    for (const item of items) {
      const amount = Number(item.amount || 0);
      if (item.type === 'RENT') {
        target.rent += amount;
      } else if (item.type === 'UTILITY_ELECTRICITY') {
        target.electricity += amount;
      } else if (item.type === 'UTILITY_WATER' || item.type === 'SERVICE') {
        target.waterAndService += amount;
      } else {
        target.other += amount;
      }
    }
  }

  private isBookingHoldInvoice(invoice: any) {
    const period = String(invoice?.period || invoice?.usagePeriod || '').trim().toLowerCase();
    const billingKind = String(invoice?.billingKind || '').trim().toUpperCase();
    return period === 'cọc giữ phòng' || billingKind === 'BOOKING_HOLD' || billingKind === 'BOOKING_DEPOSIT';
  }

  private async getBookingHoldInvoiceRevenueJournalTotal(tenantId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        period: 'Cọc giữ phòng',
      },
      select: { id: true },
    });
    const invoiceIds = invoices.map((invoice: any) => invoice.id);
    if (!invoiceIds.length) return 0;

    const lines = await this.prisma.journalLine.findMany({
      where: authoritativeJournalLineWhere(
        tenantId,
        { account: { tenantId, type: 'REVENUE' } },
        { sourceType: 'INVOICE', sourceId: { in: invoiceIds } },
      ),
    });

    return normalBalance(lines, 'CREDIT');
  }
}
