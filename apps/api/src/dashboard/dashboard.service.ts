import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FinanceReportingService } from '../finance/finance-reporting.service';
import { ACTIVE_LIKE_CONTRACT_STATUSES } from '../contracts/contracts.adapter';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceReportingService
  ) {}

  async getDashboardAggregation(tenantId: string) {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [
      profitLoss,
      cashFlow,
      totalRooms,
      occupiedRooms,
      reservedRooms,
      maintenanceRooms,
      cleaningRooms,
      activeContracts,
      expiringContracts,
      openInvoices,
      depositHeld,
      depositLiabilityDebit,
      depositLiabilityCredit,
      buildings,
      recentPayments,
      recentContracts,
    ] = await Promise.all([
      this.finance.getProfitLoss(tenantId),
      this.finance.getCashFlow(tenantId),
      this.prisma.room.count({ where: { tenantId, deletedAt: null, status: { not: 'INACTIVE' } } }),
      this.prisma.room.count({ where: { tenantId, status: 'OCCUPIED' } }),
      this.prisma.room.count({ where: { tenantId, status: 'RESERVED' } }),
      this.prisma.room.count({ where: { tenantId, status: 'MAINTENANCE' } }),
      this.prisma.room.count({ where: { tenantId, status: 'CLEANING' } }),
      this.prisma.contract.count({ where: { tenantId, deletedAt: null, status: { in: ACTIVE_LIKE_CONTRACT_STATUSES } } }),
      this.prisma.contract.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
          endDate: { gte: now, lte: thirtyDaysFromNow },
        },
      }),
      this.prisma.invoice.findMany({
        where: { tenantId, deletedAt: null, status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
        select: { id: true, code: true, status: true, dueDate: true, total: true, paidAmount: true, creditAmount: true, updatedAt: true },
        orderBy: { dueDate: 'asc' },
        take: 100,
      }),
      this.prisma.deposit.aggregate({
        where: { tenantId, deletedAt: null, status: { in: ['PAID', 'CONVERTED_TO_CONTRACT'] } },
        _sum: { amount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: { tenantId, account: { code: '1300' }, type: 'DEBIT', journalEntry: { status: 'POSTED' } },
        _sum: { amount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: { tenantId, account: { code: '1300' }, type: 'CREDIT', journalEntry: { status: 'POSTED' } },
        _sum: { amount: true },
      }),
      this.prisma.building.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          rooms: {
            where: { deletedAt: null, status: { not: 'INACTIVE' } },
            include: {
              contracts: {
                where: { deletedAt: null, status: { in: ACTIVE_LIKE_CONTRACT_STATUSES } },
                select: { id: true, endDate: true, monthlyRent: true },
              },
            },
          },
          floors: { where: { deletedAt: null }, select: { id: true } },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: { tenantId, deletedAt: null, status: 'CONFIRMED' },
        include: { invoice: { select: { code: true } } },
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        take: 5,
      }),
      this.prisma.contract.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          room: { select: { code: true, building: { select: { code: true, name: true } } } },
          customer: { select: { fullName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    const roomsFromBuildings = buildings.flatMap((building) => building.rooms);
    const activeRoomIds = new Set(
      roomsFromBuildings
        .filter((room) => room.contracts.length > 0)
        .map((room) => room.id),
    );
    const syncedOccupiedRooms = activeRoomIds.size || occupiedRooms;
    const occupancyRate = totalRooms > 0 ? (syncedOccupiedRooms / totalRooms) * 100 : 0;
    const invoiceDebt = (invoice: any) => Math.max(
      0,
      Number(invoice.total) - Number(invoice.paidAmount || 0) - Number(invoice.creditAmount || 0),
    );
    const totalDebt = openInvoices.reduce((sum, invoice) => sum + invoiceDebt(invoice), 0);
    const overdueInvoices = openInvoices.filter((invoice) => invoice.status === 'OVERDUE' || invoice.dueDate < now);
    const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + invoiceDebt(invoice), 0);
    const journalDepositBalance = Math.max(
      0,
      Number(depositLiabilityCredit._sum.amount || 0) - Number(depositLiabilityDebit._sum.amount || 0),
    );
    const depositHeldAmount =
      Number(depositLiabilityCredit._sum.amount || 0) > 0 || Number(depositLiabilityDebit._sum.amount || 0) > 0
        ? journalDepositBalance
        : Number(depositHeld._sum.amount || 0);
    const contractMonthlyRevenue = roomsFromBuildings.reduce((sum, room) => {
      return sum + room.contracts.reduce((roomSum, contract) => roomSum + Number(contract.monthlyRent || 0), 0);
    }, 0);
    const syncedRevenue = Number(profitLoss.revenue || 0) > 0 ? Number(profitLoss.revenue) : contractMonthlyRevenue;
    const syncedProfit = Number(profitLoss.revenue || 0) > 0
      ? Number(profitLoss.profit || 0)
      : contractMonthlyRevenue - Number(profitLoss.expense || 0);
    const syncedCashFlow = Number(cashFlow.net || 0) !== 0 ? Number(cashFlow.net) : syncedRevenue - Number(cashFlow.outflow || 0);
    const revenueHistory = this.withOperationalRevenueFallback(await this.getRevenueHistory(tenantId, now), syncedRevenue);
    const buildingHealth = buildings.map((building) => {
      const roomCount = building.rooms.length;
      const occupied = building.rooms.filter((room) => room.contracts.length > 0 || room.status === 'OCCUPIED').length;
      const vacant = building.rooms.filter((room) => room.status === 'AVAILABLE' && room.contracts.length === 0).length;
      const expiring = building.rooms.reduce((count, room) => {
        return count + room.contracts.filter((contract) => contract.endDate >= now && contract.endDate <= thirtyDaysFromNow).length;
      }, 0);
      const fillRate = roomCount > 0 ? Math.round((occupied / roomCount) * 100) : 0;

      return {
        id: building.code,
        name: building.name,
        address: building.address,
        floors: building.floors.length,
        rooms: roomCount,
        occupied,
        vacant,
        fillRate,
        warning: expiring,
        status: expiring > 0 ? 'HĐ sắp hết hạn' : 'Ổn định',
        statusType: expiring > 0 ? 'warning' : 'success',
      };
    });
    const recentActivity = [
      ...recentPayments.map((payment) => ({
        time: this.formatTimeAgo(payment.paidAt || payment.createdAt, now),
        title: `Thu tiền ${payment.invoice?.code || 'hóa đơn'}`,
        desc: payment.provider,
        amount: `${Number(payment.amount).toLocaleString('vi-VN')} đ`,
        amountColor: 'text-success',
      })),
      ...recentContracts.map((contract) => ({
        time: this.formatTimeAgo(contract.updatedAt, now),
        title: `${contract.code} - ${contract.customer?.fullName || 'Khách thuê'}`,
        desc: `${contract.room?.building?.code || contract.room?.building?.name || ''} ${contract.room?.code || ''}`.trim(),
        amount: `${Number(contract.monthlyRent).toLocaleString('vi-VN')} đ`,
        amountColor: 'text-primary',
      })),
    ].sort((a, b) => 0).slice(0, 6);

    return {
      hero: {
        tasksCount: overdueInvoices.length + expiringContracts + cleaningRooms + maintenanceRooms,
        expiringContracts,
        cleaningRooms,
        maintenanceRooms,
      },
      alerts: [
        { label: 'Công nợ quá hạn', count: overdueInvoices.length, amount: `${overdueAmount.toLocaleString('vi-VN')} đ` },
        { label: 'Hợp đồng sắp hết hạn', count: expiringContracts, amount: 'Trong 30 ngày tới' },
        { label: 'Phòng cần xử lý', count: cleaningRooms + maintenanceRooms, amount: `${cleaningRooms} dọn, ${maintenanceRooms} bảo trì` },
        { label: 'Hóa đơn chờ thu', count: openInvoices.length, amount: `${totalDebt.toLocaleString('vi-VN')} đ` },
      ],
      kpis: {
        totalRevenue: syncedRevenue,
        totalExpense: profitLoss.expense,
        netProfit: syncedProfit,
        netCashFlow: syncedCashFlow,
        totalDebt,
        depositHeld: depositHeldAmount,
      },
      occupancy: {
        totalRooms,
        occupiedRooms: syncedOccupiedRooms,
        rented: syncedOccupiedRooms,
        available: Math.max(0, totalRooms - syncedOccupiedRooms - reservedRooms - maintenanceRooms - cleaningRooms),
        reserved: reservedRooms,
        maintenance: maintenanceRooms,
        cleaning: cleaningRooms,
        rate: occupancyRate
      },
      operations: {
        activeContracts,
        expiringContracts,
      },
      finance: {
        profitMargin: syncedRevenue > 0 ? (syncedProfit / syncedRevenue) * 100 : profitLoss.margin,
        inflow: Number(cashFlow.inflow || 0) > 0 ? cashFlow.inflow : syncedRevenue,
        outflow: cashFlow.outflow
      },
      revenueHistory,
      buildingHealth,
      recentActivity,
      cashFlowForecast: revenueHistory.slice(-3).map((item) => ({
        month: item.month,
        expectedInflow: item.revenue,
        expectedProfit: item.profit,
      })),
      insights: this.buildInsights({ totalDebt, overdueCount: overdueInvoices.length, expiringContracts, occupancyRate }),
    };
  }

  private async getRevenueHistory(tenantId: string, now: Date) {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      return { start: date, end: next, month: `T${date.getMonth() + 1}` };
    });

    return Promise.all(months.map(async (month) => {
      const [revenue, expense] = await Promise.all([
        this.prisma.journalLine.aggregate({
          where: {
            tenantId,
            type: 'CREDIT',
            account: { type: 'REVENUE' },
            journalEntry: { entryDate: { gte: month.start, lt: month.end } },
          },
          _sum: { amount: true },
        }),
        this.prisma.journalLine.aggregate({
          where: {
            tenantId,
            type: 'DEBIT',
            account: { type: 'EXPENSE' },
            journalEntry: { entryDate: { gte: month.start, lt: month.end } },
          },
          _sum: { amount: true },
        }),
      ]);
      const revenueAmount = Number(revenue._sum.amount || 0);
      const expenseAmount = Number(expense._sum.amount || 0);
      return { month: month.month, revenue: revenueAmount, profit: revenueAmount - expenseAmount };
    }));
  }

  private withOperationalRevenueFallback<T extends { revenue: number; profit: number }>(history: T[], monthlyRevenue: number): T[] {
    if (monthlyRevenue <= 0 || history.some((item) => Number(item.revenue || 0) > 0)) {
      return history;
    }

    return history.map((item, index) => (
      index === history.length - 1
        ? { ...item, revenue: monthlyRevenue, profit: monthlyRevenue }
        : item
    ));
  }

  private buildInsights(input: { totalDebt: number; overdueCount: number; expiringContracts: number; occupancyRate: number }) {
    const insights = [];
    if (input.overdueCount > 0) {
      insights.push({ text: 'Công nợ cần xử lý', highlight: String(input.overdueCount), sub: `${input.totalDebt.toLocaleString('vi-VN')} đ chưa thu` });
    }
    if (input.expiringContracts > 0) {
      insights.push({ text: 'Hợp đồng sắp hết hạn', highlight: String(input.expiringContracts), sub: 'Cần liên hệ gia hạn' });
    }
    if (input.occupancyRate < 80) {
      insights.push({ text: 'Tỷ lệ lấp đầy thấp', highlight: `${Math.round(input.occupancyRate)}%`, sub: 'Nên ưu tiên bán phòng trống' });
    }
    return insights;
  }

  private formatTimeAgo(date: Date, now: Date) {
    const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
    if (minutes < 60) return `${minutes}p`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }
}
