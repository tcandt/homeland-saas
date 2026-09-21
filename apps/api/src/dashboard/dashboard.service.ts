import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { FinanceReportingService } from "../finance/finance-reporting.service";
import { ACTIVE_LIKE_CONTRACT_STATUSES } from "../contracts/contracts.adapter";

@Injectable()
export class DashboardService {
  private cache = new Map<string, { data: any; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceReportingService,
  ) {}

  async getDashboardAggregation(tenantId: string) {
    const cached = this.cache.get(tenantId);
    const nowMs = Date.now();
    if (cached && cached.expiresAt > nowMs) {
      return cached.data;
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
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
      this.prisma.room.count({
        where: { tenantId, deletedAt: null, status: { not: "INACTIVE" } },
      }),
      this.prisma.room.count({ where: { tenantId, status: "OCCUPIED" } }),
      this.prisma.room.count({ where: { tenantId, status: "RESERVED" } }),
      this.prisma.room.count({ where: { tenantId, status: "MAINTENANCE" } }),
      this.prisma.room.count({ where: { tenantId, status: "CLEANING" } }),
      this.prisma.contract.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
        },
      }),
      this.prisma.contract.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
          endDate: { gte: now, lte: thirtyDaysFromNow },
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
        },
        select: {
          id: true,
          code: true,
          status: true,
          dueDate: true,
          total: true,
          paidAmount: true,
          creditAmount: true,
          updatedAt: true,
        },
        orderBy: { dueDate: "asc" },
        take: 100,
      }),
      this.prisma.deposit.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: ["PAID", "CONVERTED_TO_CONTRACT"] },
        },
        _sum: { amount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: {
          tenantId,
          account: { code: "1300" },
          type: "DEBIT",
          journalEntry: { status: "POSTED" },
        },
        _sum: { amount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: {
          tenantId,
          account: { code: "1300" },
          type: "CREDIT",
          journalEntry: { status: "POSTED" },
        },
        _sum: { amount: true },
      }),
      this.prisma.building.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          rooms: {
            where: { deletedAt: null, status: { not: "INACTIVE" } },
            include: {
              contracts: {
                where: {
                  deletedAt: null,
                  status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
                },
                select: { id: true, endDate: true, monthlyRent: true },
              },
              occupancies: {
                where: { tenantId, leftAt: null },
                select: { id: true },
              },
              roomHolds: {
                where: {
                  tenantId,
                  status: "ACTIVE",
                  expiresAt: { gt: now },
                },
                select: { id: true },
              },
            },
          },
          floors: { where: { deletedAt: null }, select: { id: true } },
        },
        orderBy: { code: "asc" },
      }),
      this.prisma.payment.findMany({
        where: { tenantId, deletedAt: null, status: "CONFIRMED" },
        include: {
          invoice: {
            select: {
              code: true,
              billingKind: true,
              items: { select: { type: true, description: true } },
              contract: { select: { code: true, purpose: true } },
            },
          },
        },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
      this.prisma.contract.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          room: {
            select: {
              code: true,
              building: { select: { code: true, name: true } },
            },
          },
          customer: { select: { fullName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

    const roomsFromBuildings = buildings.flatMap((building) => building.rooms);
    const activeRoomIds = new Set(
      roomsFromBuildings
        .filter(
          (room) =>
            room.contracts.length > 0 ||
            room.occupancies.length > 0 ||
            room.status === "OCCUPIED",
        )
        .map((room) => room.id),
    );
    const reservedRoomIds = new Set(
      roomsFromBuildings
        .filter(
          (room) =>
            !activeRoomIds.has(room.id) &&
            (room.roomHolds.length > 0 || room.status === "RESERVED"),
        )
        .map((room) => room.id),
    );
    const syncedOccupiedRooms = activeRoomIds.size || occupiedRooms;
    const syncedReservedRooms = reservedRoomIds.size || reservedRooms;
    const occupancyRate =
      totalRooms > 0 ? (syncedOccupiedRooms / totalRooms) * 100 : 0;
    const invoiceDebt = (invoice: any) =>
      Math.max(
        0,
        Number(invoice.total) -
          Number(invoice.paidAmount || 0) -
          Number(invoice.creditAmount || 0),
      );
    const totalDebt = openInvoices.reduce(
      (sum, invoice) => sum + invoiceDebt(invoice),
      0,
    );
    const overdueInvoices = openInvoices.filter(
      (invoice) => invoice.status === "OVERDUE" || invoice.dueDate < now,
    );
    const overdueAmount = overdueInvoices.reduce(
      (sum, invoice) => sum + invoiceDebt(invoice),
      0,
    );
    const journalDepositBalance = Math.max(
      0,
      Number(depositLiabilityCredit._sum.amount || 0) -
        Number(depositLiabilityDebit._sum.amount || 0),
    );
    const depositHeldAmount =
      Number(depositLiabilityCredit._sum.amount || 0) > 0 ||
      Number(depositLiabilityDebit._sum.amount || 0) > 0
        ? journalDepositBalance
        : Number(depositHeld._sum.amount || 0);
    const contractMonthlyRevenue = roomsFromBuildings.reduce((sum, room) => {
      return (
        sum +
        room.contracts.reduce(
          (roomSum, contract) => roomSum + Number(contract.monthlyRent || 0),
          0,
        )
      );
    }, 0);
    const syncedRevenue =
      Number(profitLoss.revenue || 0) > 0
        ? Number(profitLoss.revenue)
        : contractMonthlyRevenue;
    const syncedProfit =
      Number(profitLoss.revenue || 0) > 0
        ? Number(profitLoss.profit || 0)
        : contractMonthlyRevenue - Number(profitLoss.expense || 0);
    const syncedCashFlow =
      Number(cashFlow.net || 0) !== 0
        ? Number(cashFlow.net)
        : syncedRevenue - Number(cashFlow.outflow || 0);

    // Quick default history structure (detailed loaded on-demand by chart)
    const revenueHistory = this.buildQuickRevenueMonths(now, syncedRevenue);

    const buildingHealth = buildings.map((building) => {
      const roomCount = building.rooms.length;
      const occupied = building.rooms.filter(
        (room) =>
          room.contracts.length > 0 ||
          room.occupancies.length > 0 ||
          room.status === "OCCUPIED",
      ).length;
      const reserved = building.rooms.filter(
        (room) =>
          room.contracts.length === 0 &&
          room.occupancies.length === 0 &&
          (room.roomHolds.length > 0 || room.status === "RESERVED"),
      ).length;
      const blocked = building.rooms.filter((room) =>
        ["MAINTENANCE", "CLEANING"].includes(room.status),
      ).length;
      const vacant = Math.max(0, roomCount - occupied - reserved - blocked);
      const expiring = building.rooms.reduce((count, room) => {
        return (
          count +
          room.contracts.filter(
            (contract) =>
              contract.endDate >= now && contract.endDate <= thirtyDaysFromNow,
          ).length
        );
      }, 0);
      const fillRate =
        roomCount > 0 ? Math.round((occupied / roomCount) * 100) : 0;

      return {
        id: building.code,
        name: building.name,
        address: building.address,
        floors: building.floors.length,
        rooms: roomCount,
        occupied,
        reserved,
        vacant,
        fillRate,
        warning: expiring,
        status: expiring > 0 ? "HĐ sắp hết hạn" : "Ổn định",
        statusType: expiring > 0 ? "warning" : "success",
      };
    });
    const recentActivity = [
      ...recentPayments.map((payment) => {
        const occurredAt = payment.paidAt || payment.createdAt;
        const invoiceItemTypes = (payment.invoice?.items || []).map((item) =>
          String(item.type || "").toUpperCase(),
        );
        const isHoldingDeposit = invoiceItemTypes.some((type) =>
          ["BOOKING", "RESERVATION", "HOLDING_DEPOSIT"].includes(type),
        );
        const isContractDeposit = invoiceItemTypes.some((type) =>
          ["SECURITY", "CONTRACT_DEPOSIT"].includes(type),
        );
        const title = isHoldingDeposit
          ? "Đã nhận thanh toán cọc giữ phòng"
          : isContractDeposit
            ? "Đã nhận tiền cọc hợp đồng"
            : invoiceItemTypes.includes("RENT") ||
                payment.invoice?.billingKind === "MONTHLY_BASE"
              ? "Đã nhận tiền thuê phòng"
              : "Đã nhận thanh toán hóa đơn";
        const detail = [
          payment.invoice?.code,
          payment.invoice?.contract?.code,
          payment.provider,
        ]
          .filter(Boolean)
          .join(" · ");
        return {
          time: this.formatTimestamp(occurredAt),
          occurredAt: occurredAt.toISOString(),
          title,
          desc: detail || "Thanh toán đã được xác nhận",
          amount: `${Number(payment.amount).toLocaleString("vi-VN")} đ`,
          amountColor: "text-success",
        };
      }),
      ...recentContracts.map((contract) => {
        const occurredAt = contract.updatedAt;
        const isHoldingContract =
          String(contract.code || "")
            .toUpperCase()
            .startsWith("HD-COC") ||
          /cọc giữ phòng|booking|holding/i.test(String(contract.purpose || ""));
        const roomLabel =
          `${contract.room?.building?.code || contract.room?.building?.name || ""} ${contract.room?.code || ""}`.trim();
        return {
          time: this.formatTimestamp(occurredAt),
          occurredAt: occurredAt.toISOString(),
          title: isHoldingContract
            ? "Đã tạo hợp đồng cọc giữ phòng"
            : "Đã cập nhật hợp đồng thuê phòng",
          desc: [contract.code, contract.customer?.fullName, roomLabel]
            .filter(Boolean)
            .join(" · "),
          amount: `${Number(contract.monthlyRent).toLocaleString("vi-VN")} đ`,
          amountColor: "text-primary",
        };
      }),
    ]
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      )
      .slice(0, 6);

    const result = {
      hero: {
        tasksCount:
          overdueInvoices.length +
          expiringContracts +
          cleaningRooms +
          maintenanceRooms,
        expiringContracts,
        cleaningRooms,
        maintenanceRooms,
      },
      alerts: [
        {
          label: "Công nợ quá hạn",
          count: overdueInvoices.length,
          amount: `${overdueAmount.toLocaleString("vi-VN")} đ`,
        },
        {
          label: "Hợp đồng sắp hết hạn",
          count: expiringContracts,
          amount: "Trong 30 ngày tới",
        },
        {
          label: "Phòng cần xử lý",
          count: cleaningRooms + maintenanceRooms,
          amount: `${cleaningRooms} dọn, ${maintenanceRooms} bảo trì`,
        },
        {
          label: "Hóa đơn chờ thu",
          count: openInvoices.length,
          amount: `${totalDebt.toLocaleString("vi-VN")} đ`,
        },
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
        available: Math.max(
          0,
          totalRooms -
            syncedOccupiedRooms -
            syncedReservedRooms -
            maintenanceRooms -
            cleaningRooms,
        ),
        reserved: syncedReservedRooms,
        maintenance: maintenanceRooms,
        cleaning: cleaningRooms,
        rate: occupancyRate,
      },
      operations: {
        activeContracts,
        expiringContracts,
      },
      finance: {
        profitMargin:
          syncedRevenue > 0
            ? (syncedProfit / syncedRevenue) * 100
            : profitLoss.margin,
        inflow:
          Number(cashFlow.inflow || 0) > 0 ? cashFlow.inflow : syncedRevenue,
        outflow: cashFlow.outflow,
      },
      revenueHistory,
      buildingHealth,
      recentActivity,
      cashFlowForecast: revenueHistory.slice(-3).map((item) => ({
        month: item.month,
        expectedInflow: item.revenue,
        expectedProfit: item.profit,
      })),
      insights: this.buildInsights({
        totalDebt,
        overdueCount: overdueInvoices.length,
        expiringContracts,
        occupancyRate,
      }),
    };

    this.cache.set(tenantId, { data: result, expiresAt: Date.now() + 15000 });
    return result;
  }

  async getRevenueHistoryByMonths(tenantId: string, monthCount = 6) {
    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - (monthCount - 1),
      1,
    );

    const months = Array.from({ length: monthCount }, (_, index) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - (monthCount - 1 - index),
        1,
      );
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return {
        month: `T${date.getMonth() + 1}`,
        key,
        revenue: 0,
        profit: 0,
      };
    });

    try {
      // 1 single lightning-fast SQL group-by query across all 6 months
      const rows: any[] = await this.prisma.$queryRaw`
        SELECT 
          TO_CHAR(je."entryDate", 'YYYY-MM') AS "monthKey",
          COALESCE(SUM(CASE WHEN a."type" = 'REVENUE' AND jl."type" = 'CREDIT' THEN jl."amount" ELSE 0 END), 0)::float AS "revenue",
          COALESCE(SUM(CASE WHEN a."type" = 'EXPENSE' AND jl."type" = 'DEBIT' THEN jl."amount" ELSE 0 END), 0)::float AS "expense"
        FROM "JournalLine" jl
        JOIN "JournalEntry" je ON jl."journalEntryId" = je."id"
        JOIN "ChartOfAccount" a ON jl."accountId" = a."id"
        WHERE jl."tenantId" = ${tenantId}
          AND je."entryDate" >= ${startDate}
        GROUP BY TO_CHAR(je."entryDate", 'YYYY-MM')
        ORDER BY "monthKey" ASC
      `;

      const resultMap = new Map<string, { revenue: number; expense: number }>();
      for (const row of rows) {
        resultMap.set(row.monthKey, {
          revenue: Number(row.revenue || 0),
          expense: Number(row.expense || 0),
        });
      }

      const result = months.map((m) => {
        const found = resultMap.get(m.key);
        const revenue = found ? found.revenue : 0;
        const expense = found ? found.expense : 0;
        return {
          month: m.month,
          revenue,
          profit: revenue - expense,
        };
      });

      // If current month has no journal entries yet, fallback to active operational contract revenue
      if (result.every((r) => r.revenue === 0)) {
        const contracts = await this.prisma.contract.findMany({
          where: {
            tenantId,
            deletedAt: null,
            status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
          },
          select: { monthlyRent: true },
        });
        const currentRevenue = contracts.reduce(
          (sum, c) => sum + Number(c.monthlyRent || 0),
          0,
        );
        if (currentRevenue > 0) {
          result[result.length - 1].revenue = currentRevenue;
          result[result.length - 1].profit = currentRevenue;
        }
      }

      return result;
    } catch {
      return months.map((m) => ({ month: m.month, revenue: 0, profit: 0 }));
    }
  }

  private buildQuickRevenueMonths(now: Date, currentRevenue: number) {
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const isCurrent = index === 5;
      return {
        month: `T${date.getMonth() + 1}`,
        revenue: isCurrent ? currentRevenue : 0,
        profit: isCurrent ? currentRevenue : 0,
      };
    });
  }

  private withOperationalRevenueFallback<
    T extends { revenue: number; profit: number },
  >(history: T[], monthlyRevenue: number): T[] {
    if (
      monthlyRevenue <= 0 ||
      history.some((item) => Number(item.revenue || 0) > 0)
    ) {
      return history;
    }

    return history.map((item, index) =>
      index === history.length - 1
        ? { ...item, revenue: monthlyRevenue, profit: monthlyRevenue }
        : item,
    );
  }

  private buildInsights(input: {
    totalDebt: number;
    overdueCount: number;
    expiringContracts: number;
    occupancyRate: number;
  }) {
    const insights = [];
    if (input.overdueCount > 0) {
      insights.push({
        text: "Công nợ cần xử lý",
        highlight: String(input.overdueCount),
        sub: `${input.totalDebt.toLocaleString("vi-VN")} đ chưa thu`,
      });
    }
    if (input.expiringContracts > 0) {
      insights.push({
        text: "Hợp đồng sắp hết hạn",
        highlight: String(input.expiringContracts),
        sub: "Cần liên hệ gia hạn",
      });
    }
    if (input.occupancyRate < 80) {
      insights.push({
        text: "Tỷ lệ lấp đầy thấp",
        highlight: `${Math.round(input.occupancyRate)}%`,
        sub: "Nên ưu tiên bán phòng trống",
      });
    }
    return insights;
  }

  private formatTimestamp(date: Date) {
    const parts = new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour12: false,
    })
      .formatToParts(date)
      .reduce<Record<string, string>>((result, part) => {
        result[part.type] = part.value;
        return result;
      }, {});
    return `${parts.hour}:${parts.minute}:${parts.second}\n${parts.day}/${parts.month}/${parts.year}`;
  }
}
