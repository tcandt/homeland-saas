import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('does not present active-contract rent as ledger revenue when history has no journal entries', async () => {
    const getProfitLossHistory = vi.fn().mockResolvedValue({
      data: [
        { month: 'T8', revenue: 0, expense: 0, profit: 0 },
        { month: 'T9', revenue: 0, expense: 0, profit: 0 },
      ],
    });

    const history = await new DashboardService({} as any, { getProfitLossHistory } as any)
      .getRevenueHistoryByMonths('tenant-1');

    expect(history).toHaveLength(2);
    expect(history.every((month) => month.revenue === 0 && month.profit === 0)).toBe(true);
    expect(getProfitLossHistory).toHaveBeenCalledWith('tenant-1', { months: '6' });
  });

  it('syncs occupancy from active room contracts without presenting contract rent as posted revenue', async () => {
    const prisma: any = {
      room: {
        count: vi.fn()
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0),
      },
      contract: {
        count: vi.fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'invoice-1',
            status: 'ISSUED',
            dueDate: new Date('2099-01-01'),
            total: 1_000_000,
            paidAmount: 300_000,
            creditAmount: 200_000,
          },
        ]),
      },
      deposit: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 5_000_000 } }) },
      building: {
        findMany: vi.fn().mockResolvedValue([
          {
            code: 'LK01-31',
            name: 'LK01-31',
            address: 'HomeLand Premium',
            floors: [{ id: 'floor-1' }],
            rooms: [
              {
                id: 'room-1',
                status: 'AVAILABLE',
                contracts: [{ id: 'contract-1', endDate: new Date('2099-01-01'), monthlyRent: 6_000_000 }],
                occupancies: [],
                roomHolds: [],
              },
              {
                id: 'room-2',
                status: 'AVAILABLE',
                contracts: [],
                occupancies: [{ id: 'occupancy-1' }],
                roomHolds: [],
              },
              {
                id: 'room-3',
                status: 'AVAILABLE',
                contracts: [],
                occupancies: [],
                roomHolds: [{ id: 'hold-1' }],
              },
              { id: 'room-4', status: 'AVAILABLE', contracts: [], occupancies: [], roomHolds: [] },
            ],
          },
        ]),
      },
      payment: { findMany: vi.fn().mockResolvedValue([]) },
      journalLine: {
        aggregate: vi.fn()
          .mockResolvedValueOnce({ _sum: { amount: 1_500_000 } })
          .mockResolvedValueOnce({ _sum: { amount: 4_000_000 } })
          .mockResolvedValue({ _sum: { amount: 0 } }),
      },
    };
    const finance: any = {
      getProfitLoss: vi.fn().mockResolvedValue({ revenue: 0, expense: 0, profit: 0, margin: 0 }),
      getCashFlow: vi.fn().mockResolvedValue({ net: 0, inflow: 0, outflow: 0 }),
    };

    const dashboard = await new DashboardService(prisma, finance).getDashboardAggregation('tenant-1');

    expect(dashboard.occupancy).toMatchObject({
      totalRooms: 4,
      occupiedRooms: 2,
      rented: 2,
      reserved: 1,
      available: 1,
      rate: 50,
    });
    expect(dashboard.kpis).toMatchObject({
      totalRevenue: 0,
      netProfit: 0,
      netCashFlow: 0,
      totalDebt: 500_000,
      depositHeld: 2_500_000,
    });
    expect(dashboard.buildingHealth[0]).toMatchObject({
      rooms: 4,
      occupied: 2,
      reserved: 1,
      vacant: 1,
      fillRate: 50,
    });
    expect(dashboard.revenueHistory.at(-1)).toMatchObject({ revenue: 0, profit: 0 });
  });

  it('keeps quick-history profit independent from revenue', () => {
    const service = new DashboardService({} as any, {} as any);

    const history = (service as any).buildQuickRevenueMonths(
      new Date('2026-09-26T00:00:00.000Z'),
      1_000_000,
      400_000,
    );

    expect(history.at(-1)).toMatchObject({ revenue: 1_000_000, profit: 400_000 });
  });
});
