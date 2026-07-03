import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FinanceReportingService } from '../finance/finance-reporting.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceReportingService
  ) {}

  async getDashboardAggregation(tenantId: string) {
    const [
      profitLoss,
      cashFlow,
      totalRooms,
      occupiedRooms,
      activeContracts
    ] = await Promise.all([
      this.finance.getProfitLoss(tenantId),
      this.finance.getCashFlow(tenantId),
      this.prisma.room.count({ where: { tenantId, status: { not: 'INACTIVE' } } }),
      this.prisma.room.count({ where: { tenantId, status: 'OCCUPIED' } }),
      this.prisma.contract.count({ where: { tenantId, status: 'ACTIVE' } })
    ]);

    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    return {
      kpis: {
        totalRevenue: profitLoss.revenue,
        totalExpense: profitLoss.expense,
        netProfit: profitLoss.profit,
        netCashFlow: cashFlow.net,
      },
      occupancy: {
        totalRooms,
        occupiedRooms,
        rate: occupancyRate
      },
      operations: {
        activeContracts,
      },
      finance: {
        profitMargin: profitLoss.margin,
        inflow: cashFlow.inflow,
        outflow: cashFlow.outflow
      }
    };
  }
}
