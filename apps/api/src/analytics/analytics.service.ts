import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FinanceReportingService } from '../finance/finance-reporting.service';
import { AnalyticsCacheService } from './analytics-cache.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AnalyticsCacheService,
    private readonly financeReportingService: FinanceReportingService,
  ) {}

  async getRevenueAnalytics(tenantId: string) {
    const cacheKey = `analytics:revenue:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const period = { year: String(now.getFullYear()), month: String(now.getMonth() + 1) };
    const [history, buildings] = await Promise.all([
      this.financeReportingService.getProfitLossHistory(tenantId, { ...period, months: '2' }),
      this.financeReportingService.getBuildingProfitSummary(tenantId, period),
    ]);
    const rows = Array.isArray(history?.data) ? history.data : [];
    const current = rows.at(-1) || { revenue: 0 };
    const previous = rows.at(-2) || { revenue: 0 };
    const previousRevenue = Number(previous.revenue || 0);
    const categoryTotals = (Array.isArray(buildings) ? buildings : []).reduce(
      (totals: any, row: any) => ({
        rent: totals.rent + Number(row?.revenueBreakdown?.rent || 0),
        electricity: totals.electricity + Number(row?.revenueBreakdown?.electricity || 0),
        waterAndService: totals.waterAndService + Number(row?.revenueBreakdown?.waterAndService || 0),
        other: totals.other + Number(row?.revenueBreakdown?.other || 0),
      }),
      { rent: 0, electricity: 0, waterAndService: 0, other: 0 },
    );
    const totalRevenue = Number(current.revenue || 0);
    const data = {
      period,
      totalRevenue,
      growth: previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : null,
      breakdown: [
        { category: 'Room Rent', amount: categoryTotals.rent },
        { category: 'Electricity', amount: categoryTotals.electricity },
        { category: 'Water & Services', amount: categoryTotals.waterAndService },
        { category: 'Other', amount: categoryTotals.other },
      ],
    };

    await this.cache.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  }

  async getOccupancyAnalytics(tenantId: string) {
    const cacheKey = `analytics:occupancy:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const activeRoomWhere = { tenantId, deletedAt: null };
    const [totalRooms, occupiedRooms, vacantRooms, maintenanceRooms] = await Promise.all([
      this.prisma.room.count({
        where: { ...activeRoomWhere, status: { not: 'INACTIVE' } },
      }),
      this.prisma.room.count({ where: { ...activeRoomWhere, status: 'OCCUPIED' } }),
      this.prisma.room.count({ where: { ...activeRoomWhere, status: 'AVAILABLE' } }),
      this.prisma.room.count({ where: { ...activeRoomWhere, status: 'MAINTENANCE' } }),
    ]);

    const data = {
      occupancyRate: totalRooms === 0 ? 0 : (occupiedRooms / totalRooms) * 100,
      totalRooms,
      occupiedRooms,
      vacantRooms,
      maintenanceRooms,
    };

    await this.cache.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  }

  async getDebtAnalytics(tenantId: string) {
    const cacheKey = `analytics:debt:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const summary = await this.financeReportingService.getDebtSummary(tenantId);
    const data = {
      totalDebt: summary.totals.debt,
      atRisk: summary.totals.overdueDebt,
      // An open-balance summary has no billed-versus-collected denominator.
      collectionRate: null,
      topDebtors: summary.customers.slice(0, 2).map((customer) => ({
        customer: customer.label,
        amount: customer.debt,
      })),
    };

    await this.cache.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  }

  async getFinanceAnalytics(tenantId: string) {
    const cacheKey = `analytics:finance:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const period = { year: String(now.getFullYear()), month: String(now.getMonth() + 1) };
    const buildings = await this.financeReportingService.getBuildingProfitSummary(tenantId, period);
    const rows = Array.isArray(buildings) ? buildings : [];
    const revenue = rows.reduce((sum: number, row: any) => sum + Number(row.revenue || 0), 0);
    const expense = rows.reduce((sum: number, row: any) => sum + Number(row.expense || 0), 0);
    const netProfit = revenue - expense;
    const data = {
      period,
      revenue,
      expense,
      netProfit,
      margin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
      expensesBreakdown: rows.map((row: any) => ({
        category: row?.building?.code || row?.building?.name || 'Unassigned building',
        amount: Number(row.expense || 0),
      })),
    };

    await this.cache.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  }
}
