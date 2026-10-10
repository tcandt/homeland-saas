import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { authoritativeJournalLineWhere, cashAccountWhere, normalBalance } from '../finance/journal-effect.policy';
import { summarizeDepositLedger } from '../deposits/finance-summary.policy';

export type ReportPeriodOptions = {
  year?: string | number;
  month?: string | number;
  startDate?: string;
  endDate?: string;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCashFlow(tenantId: string, options: ReportPeriodOptions = {}) {
    const entryDate = this.buildPeriodRange(options);
    const inflow = await this.prisma.journalLine.aggregate({
      where: {
        ...authoritativeJournalLineWhere(tenantId, { account: { tenantId, ...cashAccountWhere }, type: 'DEBIT' }, entryDate ? { entryDate } : {}),
      },
      _sum: { amount: true }
    });

    const outflow = await this.prisma.journalLine.aggregate({
      where: {
        ...authoritativeJournalLineWhere(tenantId, { account: { tenantId, ...cashAccountWhere }, type: 'CREDIT' }, entryDate ? { entryDate } : {}),
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

  async getProfitLoss(tenantId: string, options: ReportPeriodOptions = {}) {
    const entryDate = this.buildPeriodRange(options);
    const revenueLines = await this.prisma.journalLine.findMany({
      where: {
        ...authoritativeJournalLineWhere(tenantId, { account: { tenantId, type: 'REVENUE' } }, entryDate ? { entryDate } : {}),
      }
    });

    const expenseLines = await this.prisma.journalLine.findMany({
      where: {
        ...authoritativeJournalLineWhere(tenantId, { account: { tenantId, type: 'EXPENSE' } }, entryDate ? { entryDate } : {}),
      }
    });

    const totalRevenue = normalBalance(revenueLines, 'CREDIT') - await this.getBookingHoldInvoiceRevenueJournalTotal(tenantId, entryDate);
    const totalExpenses = normalBalance(expenseLines, 'DEBIT');

    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      buildings: []
    };
  }

  async getRevenueByBuilding(tenantId: string, options: ReportPeriodOptions = {}) {
    const period = this.buildPeriodRange(options);
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
    for (const invoice of invoices.filter((item: any) => !this.isBookingHoldInvoice(item) && this.invoiceInPeriod(item, period))) {
      const building = invoice.contract?.room?.building;
      const key = building?.id || 'unassigned';
      const row = grouped.get(key) || {
        buildingId: building?.id || null,
        buildingCode: building?.code || null,
        buildingName: building?.name || 'Chưa gắn tòa nhà',
        invoiceCount: 0,
        totalAmount: 0,
        operatingRevenueAmount: 0,
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
      where: { tenantId, deletedAt: null },
      include: {
        customer: true,
        room: { include: { floor: { include: { building: true } } } },
        ledgerEntries: {
          where: { tenantId },
          select: { id: true, depositId: true, type: true, amount: true, balanceEffect: true, createdAt: true },
        },
      },
    });

    return deposits
      .map((d: any) => {
        const balance = summarizeDepositLedger(d.ledgerEntries || []).balances.get(d.id) || 0;
        return {
          code: d.code,
          customer: d.customer?.fullName || 'N/A',
          room: d.room?.name || 'N/A',
          building: d.room?.floor?.building?.name || 'N/A',
          amount: Number(d.amount || 0),
          balance,
          date: d.createdAt,
        };
      })
      .filter((row) => row.balance > 0);
  }

  async getReceivableAging(tenantId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, deletedAt: null, status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
      include: {
        customer: true,
        contract: {
          include: {
            room: {
              include: { building: true },
            },
          },
        },
      },
    });

    return invoices.map((inv: any) => {
      const remaining = Math.max(
        0,
        Number(inv.total) - Number(inv.paidAmount || 0) - Number(inv.creditAmount || 0),
      );
      const daysOverdue = Math.max(0, Math.floor((new Date().getTime() - inv.dueDate.getTime()) / (1000 * 3600 * 24)));
      return {
        invoiceId: inv.id,
        invoiceCode: inv.code || inv.id,
        customerId: inv.customerId,
        customer: inv.customer?.fullName || 'Unknown',
        phone: inv.customer?.phone || null,
        roomId: inv.contract?.room?.id || null,
        roomCode: inv.contract?.room?.code || inv.contract?.room?.name || null,
        buildingId: inv.contract?.room?.building?.id || null,
        buildingCode: inv.contract?.room?.building?.code || null,
        buildingName: inv.contract?.room?.building?.name || null,
        dueDate: inv.dueDate,
        totalAmount: Number(inv.total),
        remainingAmount: remaining,
        daysOverdue,
        agingBucket: daysOverdue === 0 ? 'Current' : daysOverdue <= 30 ? '1-30 Days' : daysOverdue <= 60 ? '31-60 Days' : '60+ Days'
      };
    }).filter((row: any) => row.remainingAmount > 0);
  }

  async getRevenueByRoom(tenantId: string, options: ReportPeriodOptions = {}) {
    const period = this.buildPeriodRange(options);
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
    for (const invoice of invoices.filter((item: any) => !this.isBookingHoldInvoice(item) && this.invoiceInPeriod(item, period))) {
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
        operatingRevenueAmount: 0,
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
    const deposit = this.sumDepositInvoiceItems(invoice.items || []);
    target.invoiceCount += 1;
    target.operatingRevenueAmount += Math.max(0, total - deposit);
    // Invoice-level payment/credit does not prove which component was settled.
    // Preserve the actual document balances rather than inventing rent allocation.
    target.totalAmount += total;
    target.paidAmount += paid;
    target.creditAmount += credit;
    target.remainingAmount += Math.max(0, total - paid - credit);
  }

  private addInvoiceItemBreakdown(target: any, items: any[]) {
    for (const item of items) {
      if (this.isDepositInvoiceItem(item)) continue;
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

  private isDepositInvoiceItem(item: any) {
    if (item?.type === 'DISCOUNT' && Number(item.amount) < 0 &&
      String(item.servicePeriod || '').startsWith('ENTRY_BOOKING_TRANSFER:')) return true;
    if (!item || Number(item.amount || 0) <= 0) return false;
    const text = String(`${item.type || ''} ${item.description || ''}`)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
    return /(tien coc|dat coc|coc hop dong|coc giu phong|coc bao dam|security deposit|booking deposit)/.test(text)
      && !/(phat coc|hoan coc|khau tru coc|tru coc)/.test(text);
  }

  private sumDepositInvoiceItems(items: any[]) {
    return items.filter((item) => this.isDepositInvoiceItem(item))
      .reduce((total, item) => total + Number(item.amount || 0), 0);
  }

  private async getBookingHoldInvoiceRevenueJournalTotal(tenantId: string, entryDate?: Record<string, Date>) {
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
        { sourceType: 'INVOICE', sourceId: { in: invoiceIds }, ...(entryDate ? { entryDate } : {}) },
      ),
    });

    return normalBalance(lines, 'CREDIT');
  }

  private buildPeriodRange(options: ReportPeriodOptions): Record<string, Date> | undefined {
    const hasExplicit = options.startDate !== undefined || options.endDate !== undefined;
    if (hasExplicit) {
      if (!options.startDate || !options.endDate) throw new BadRequestException('PERIOD_DATES_REQUIRED');
      const start = new Date(options.startDate);
      const end = new Date(options.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestException('PERIOD_DATE_INVALID');
      if (start.getTime() >= end.getTime()) throw new BadRequestException('PERIOD_DATE_RANGE_INVALID');
      return { gte: start, lt: end };
    }
    if (options.year === undefined && options.month === undefined) return undefined;
    const year = Number(options.year);
    const month = options.month === undefined ? undefined : Number(options.month);
    if (!Number.isInteger(year) || year < 100 || year > 9998) throw new BadRequestException('PERIOD_YEAR_INVALID');
    if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) throw new BadRequestException('PERIOD_MONTH_INVALID');
    const offset = 7 * 60 * 60 * 1000;
    const startUtc = Date.UTC(year, month === undefined ? 0 : month - 1, 1) - offset;
    const endUtc = Date.UTC(year, month === undefined ? 12 : month, 1) - offset;
    return { gte: new Date(startUtc), lt: new Date(endUtc) };
  }

  private invoiceInPeriod(invoice: any, period?: Record<string, Date>) {
    if (!period) return true;
    const servicePeriod = String(invoice?.period || invoice?.usagePeriod || '').trim();
    let timestamp: number;
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(servicePeriod)) {
      const [year, month] = servicePeriod.split('-').map(Number);
      timestamp = Date.UTC(year, month - 1, 1) - 7 * 60 * 60 * 1000;
      return timestamp >= period.gte.getTime() && timestamp < period.lt.getTime();
    }
    timestamp = new Date(invoice?.createdAt || 0).getTime();
    return Number.isFinite(timestamp) && timestamp >= period.gte.getTime() && timestamp < period.lt.getTime();
  }
}
