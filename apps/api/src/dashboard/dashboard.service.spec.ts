import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('syncs occupancy and revenue from active room contracts when room status is still available', async () => {
    const prisma: any = {
      room: {
        count: vi.fn()
          .mockResolvedValueOnce(2)
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
              },
              { id: 'room-2', status: 'AVAILABLE', contracts: [] },
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
      totalRooms: 2,
      occupiedRooms: 1,
      rented: 1,
      available: 1,
      rate: 50,
    });
    expect(dashboard.kpis).toMatchObject({
      totalRevenue: 6_000_000,
      netProfit: 6_000_000,
      netCashFlow: 6_000_000,
      totalDebt: 500_000,
      depositHeld: 2_500_000,
    });
    expect(dashboard.buildingHealth[0]).toMatchObject({
      rooms: 2,
      occupied: 1,
      vacant: 1,
      fillRate: 50,
    });
    expect(dashboard.revenueHistory.at(-1)).toMatchObject({ revenue: 6_000_000, profit: 6_000_000 });
  });
});
