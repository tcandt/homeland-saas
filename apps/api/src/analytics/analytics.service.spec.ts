import { describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  it('aggregates active room occupancy for only the requested tenant', async () => {
    const count = vi.fn()
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1);
    const prisma: any = { room: { count } };
    const cache: any = { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined) };
    const reporting: any = { getDebtSummary: vi.fn() };

    const data = await new AnalyticsService(prisma, cache, reporting).getOccupancyAnalytics('tenant-a');

    expect(data).toEqual({
      occupancyRate: 37.5,
      totalRooms: 8,
      occupiedRooms: 3,
      vacantRooms: 4,
      maintenanceRooms: 1,
    });
    expect(count).toHaveBeenNthCalledWith(1, {
      where: { tenantId: 'tenant-a', deletedAt: null, status: { not: 'INACTIVE' } },
    });
    expect(count).toHaveBeenNthCalledWith(2, {
      where: { tenantId: 'tenant-a', deletedAt: null, status: 'OCCUPIED' },
    });
    expect(count).toHaveBeenNthCalledWith(3, {
      where: { tenantId: 'tenant-a', deletedAt: null, status: 'AVAILABLE' },
    });
    expect(count).toHaveBeenNthCalledWith(4, {
      where: { tenantId: 'tenant-a', deletedAt: null, status: 'MAINTENANCE' },
    });
    expect(cache.set).toHaveBeenCalledWith('analytics:occupancy:tenant-a', data, 5 * 60 * 1000);
  });

  it('returns a zero rate when the tenant has no active rooms', async () => {
    const prisma: any = { room: { count: vi.fn().mockResolvedValue(0) } };
    const cache: any = { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined) };
    const reporting: any = { getDebtSummary: vi.fn() };

    const data = await new AnalyticsService(prisma, cache, reporting).getOccupancyAnalytics('tenant-empty');

    expect(data).toMatchObject({ occupancyRate: 0, totalRooms: 0, occupiedRooms: 0 });
  });

  it('returns the cached occupancy result without querying rooms', async () => {
    const cached = {
      occupancyRate: 50,
      totalRooms: 2,
      occupiedRooms: 1,
      vacantRooms: 1,
      maintenanceRooms: 0,
    };
    const prisma: any = { room: { count: vi.fn() } };
    const cache: any = { get: vi.fn().mockResolvedValue(cached), set: vi.fn() };
    const reporting: any = { getDebtSummary: vi.fn() };

    await expect(new AnalyticsService(prisma, cache, reporting).getOccupancyAnalytics('tenant-a')).resolves.toBe(cached);

    expect(cache.get).toHaveBeenCalledWith('analytics:occupancy:tenant-a');
    expect(prisma.room.count).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('uses the requested tenant debt summary and exposes only debtor labels and balances', async () => {
    const prisma: any = {};
    const cache: any = { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined) };
    const reporting: any = {
      getDebtSummary: vi.fn().mockResolvedValue({
        totals: { debt: 15_000_000, overdueDebt: 4_000_000 },
        customers: [
          { id: 'customer-a', label: 'Nguyen Van A', debt: 10_000_000, phone: '0900000000' },
          { id: 'customer-b', label: 'Tran Thi B', debt: 5_000_000, phone: '0911111111' },
          { id: 'customer-c', label: 'Le Van C', debt: 1_000_000, phone: '0922222222' },
        ],
      }),
    };

    const data = await new AnalyticsService(prisma, cache, reporting).getDebtAnalytics('tenant-a');

    expect(reporting.getDebtSummary).toHaveBeenCalledWith('tenant-a');
    expect(data).toEqual({
      totalDebt: 15_000_000,
      atRisk: 4_000_000,
      collectionRate: null,
      topDebtors: [
        { customer: 'Nguyen Van A', amount: 10_000_000 },
        { customer: 'Tran Thi B', amount: 5_000_000 },
      ],
    });
    expect(cache.set).toHaveBeenCalledWith('analytics:debt:tenant-a', data, 5 * 60 * 1000);
  });

  it('returns cached debt analytics without requesting another tenant report', async () => {
    const cached = {
      totalDebt: 10_000_000,
      atRisk: 2_000_000,
      collectionRate: null,
      topDebtors: [{ customer: 'Nguyen Van A', amount: 10_000_000 }],
    };
    const prisma: any = {};
    const cache: any = { get: vi.fn().mockResolvedValue(cached), set: vi.fn() };
    const reporting: any = { getDebtSummary: vi.fn() };

    await expect(new AnalyticsService(prisma, cache, reporting).getDebtAnalytics('tenant-a')).resolves.toBe(cached);

    expect(cache.get).toHaveBeenCalledWith('analytics:debt:tenant-a');
    expect(reporting.getDebtSummary).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('builds revenue and finance analytics from tenant-scoped authoritative reports', async () => {
    const prisma: any = {};
    const cache: any = { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined) };
    const reporting: any = {
      getProfitLossHistory: vi.fn().mockResolvedValue({
        data: [
          { key: '2026-08', revenue: 1000, expense: 400, profit: 600 },
          { key: '2026-09', revenue: 1250, expense: 500, profit: 750 },
        ],
      }),
      getBuildingProfitSummary: vi.fn().mockResolvedValue([
        {
          building: { code: 'A' },
          revenue: 800,
          expense: 300,
          revenueBreakdown: { rent: 600, electricity: 100, waterAndService: 80, other: 20 },
        },
        {
          building: { code: 'B' },
          revenue: 450,
          expense: 200,
          revenueBreakdown: { rent: 350, electricity: 50, waterAndService: 40, other: 10 },
        },
      ]),
    };
    const service = new AnalyticsService(prisma, cache, reporting);

    await expect(service.getRevenueAnalytics('tenant-a')).resolves.toMatchObject({
      totalRevenue: 1250,
      growth: 25,
      breakdown: [
        { category: 'Room Rent', amount: 950 },
        { category: 'Electricity', amount: 150 },
        { category: 'Water & Services', amount: 120 },
        { category: 'Other', amount: 30 },
      ],
    });
    await expect(service.getFinanceAnalytics('tenant-a')).resolves.toMatchObject({
      revenue: 1250,
      expense: 500,
      netProfit: 750,
      margin: 60,
      expensesBreakdown: [
        { category: 'A', amount: 300 },
        { category: 'B', amount: 200 },
      ],
    });

    expect(reporting.getProfitLossHistory).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({ months: '2' }),
    );
    expect(reporting.getBuildingProfitSummary).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({ year: expect.any(String), month: expect.any(String) }),
    );
    expect(cache.set).toHaveBeenCalledWith('analytics:revenue:tenant-a', expect.any(Object), 5 * 60 * 1000);
    expect(cache.set).toHaveBeenCalledWith('analytics:finance:tenant-a', expect.any(Object), 5 * 60 * 1000);
  });
});
