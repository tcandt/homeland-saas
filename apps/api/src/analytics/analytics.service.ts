import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AnalyticsCacheService } from './analytics-cache.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AnalyticsCacheService
  ) {}

  async getRevenueAnalytics(tenantId: string) {
    const cacheKey = `analytics:revenue:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Simulate complex aggregation from Invoice/Payment/Ledger
    const data = {
      totalRevenue: 285000000,
      growth: 12.5, // 12.5% vs last month
      breakdown: [
        { category: 'Room Rent', amount: 200000000 },
        { category: 'Electricity', amount: 50000000 },
        { category: 'Water', amount: 15000000 },
        { category: 'Services', amount: 20000000 }
      ]
    };

    await this.cache.set(cacheKey, data, 5 * 60 * 1000); // 5 mins
    return data;
  }

  async getOccupancyAnalytics(tenantId: string) {
    const cacheKey = `analytics:occupancy:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = {
      occupancyRate: 85, // 85%
      totalRooms: 100,
      occupiedRooms: 85,
      vacantRooms: 15,
      maintenanceRooms: 0
    };

    await this.cache.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  }

  async getDebtAnalytics(tenantId: string) {
    const cacheKey = `analytics:debt:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = {
      totalDebt: 45000000,
      atRisk: 15000000,
      collectionRate: 92, // 92%
      topDebtors: [
        { customer: 'Nguyen Van A', amount: 10000000 },
        { customer: 'Tran Thi B', amount: 5000000 }
      ]
    };

    await this.cache.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  }

  async getFinanceAnalytics(tenantId: string) {
    const cacheKey = `analytics:finance:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = {
      netProfit: 176000000,
      margin: 61.7, // 61.7%
      expensesBreakdown: [
        { category: 'Maintenance', amount: 45000000 },
        { category: 'Salary', amount: 40000000 },
        { category: 'Utilities', amount: 24000000 }
      ]
    };

    await this.cache.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  }
}
