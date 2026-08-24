import { Injectable, BadRequestException } from '@nestjs/common';
import { AuditAction, SettingScope } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CommunicationService } from '../communication/communication.service';
import { buildRoomContext } from '../shared/context/room-context';

type SePayAuditSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

type SePayAuditIssue = {
  id: string;
  severity: SePayAuditSeverity;
  type: string;
  title: string;
  description: string;
  createdAt: Date | null;
  ageHours: number | null;
  paymentCode: string | null;
  providerTransactionId: string | null;
  sourceType: string | null;
  sourceId: string | null;
  sourceCode: string | null;
  sourceStatus: string | null;
  requestId: string | null;
  requestStatus: string | null;
  webhookId: string | null;
  webhookStatus: string | null;
  expectedAmount: number | null;
  actualAmount: number | null;
  roomCode: string | null;
  buildingName: string | null;
  roomRentalTypeLabel: string | null;
  roomMemberCount: number | null;
  ownerName: string | null;
  bankName: string | null;
  accountNumber: string | null;
  metadata?: Record<string, any>;
};

@Injectable()
export class FinanceReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationService: CommunicationService,
  ) {}

  async getLedger(tenantId: string, options: { accountId?: string, costCenterId?: string, startDate?: string, endDate?: string } = {}) {
    const where: any = { tenantId };
    if (options.accountId) where.accountId = options.accountId;
    if (options.costCenterId) where.costCenterId = options.costCenterId;
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = new Date(options.startDate);
      if (options.endDate) where.createdAt.lte = new Date(options.endDate);
    }

    return this.prisma.journalLine.findMany({
      where,
      include: {
        account: true,
        costCenter: true,
        journalEntry: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCashFlow(tenantId: string) {
    const cashAccounts = await this.prisma.chartOfAccount.findMany({
      where: { tenantId, type: 'ASSET', name: { contains: 'Cash', mode: 'insensitive' } }
    });
    
    const bankAccounts = await this.prisma.chartOfAccount.findMany({
      where: { tenantId, type: 'ASSET', name: { contains: 'Bank', mode: 'insensitive' } }
    });
    
    const accounts = [...cashAccounts, ...bankAccounts];
    if (!accounts.length) return { inflow: 0, outflow: 0, net: 0 };
    
    const accountIds = accounts.map(a => a.id);
    
    const [debits, credits] = await Promise.all([
      this.prisma.journalLine.aggregate({
        where: { tenantId, accountId: { in: accountIds }, type: 'DEBIT' },
        _sum: { amount: true }
      }),
      this.prisma.journalLine.aggregate({
        where: { tenantId, accountId: { in: accountIds }, type: 'CREDIT' },
        _sum: { amount: true }
      })
    ]);
    
    const inflow = Number(debits._sum.amount || 0);
    const outflow = Number(credits._sum.amount || 0);
    
    return {
      inflow,
      outflow,
      net: inflow - outflow
    };
  }

  async getProfitLoss(tenantId: string) {
    const [revenues, expenses] = await Promise.all([
      this.prisma.journalLine.aggregate({
        where: { tenantId, account: { type: 'REVENUE' }, type: 'CREDIT' },
        _sum: { amount: true }
      }),
      this.prisma.journalLine.aggregate({
        where: { tenantId, account: { type: 'EXPENSE' }, type: 'DEBIT' },
        _sum: { amount: true }
      })
    ]);
    
    const revenueAmount = Number(revenues._sum.amount || 0);
    const expenseAmount = Number(expenses._sum.amount || 0);
    
    return {
      revenue: revenueAmount,
      expense: expenseAmount,
      profit: revenueAmount - expenseAmount,
      margin: revenueAmount > 0 ? ((revenueAmount - expenseAmount) / revenueAmount) * 100 : 0
    };
  }

  async getDebtSummary(tenantId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { notIn: ['PAID', 'CANCELLED', 'WRITTEN_OFF'] as any },
      },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        contract: {
          include: {
            room: {
              include: {
                building: { include: { owner: { select: { id: true, code: true, name: true } } } },
              },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const byCustomer = new Map<string, any>();
    const byRoom = new Map<string, any>();
    const byBuilding = new Map<string, any>();
    const byOwner = new Map<string, any>();
    let totalDebt = 0;
    let overdueDebt = 0;
    const now = new Date();

    const addDebt = (map: Map<string, any>, key: string, label: string, amount: number, overdueAmount: number, extra: Record<string, any> = {}) => {
      const current = map.get(key) || { id: key, label, invoiceCount: 0, debt: 0, overdueDebt: 0, ...extra };
      current.invoiceCount += 1;
      current.debt += amount;
      current.overdueDebt += overdueAmount;
      map.set(key, current);
    };

    for (const invoice of invoices) {
      const debt = Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0) - Number(invoice.creditAmount || 0));
      if (debt <= 0) continue;

      const isOverdue = invoice.dueDate < now || invoice.status === 'OVERDUE';
      const overdueAmount = isOverdue ? debt : 0;
      const room = invoice.contract?.room;
      const building = room?.building;
      const owner = building?.owner;

      totalDebt += debt;
      overdueDebt += overdueAmount;

      addDebt(byCustomer, invoice.customerId, invoice.customer?.fullName || invoice.customerId, debt, overdueAmount, {
        phone: invoice.customer?.phone || null,
      });
      if (room) {
        addDebt(byRoom, room.id, room.code || room.name || room.id, debt, overdueAmount, {
          buildingId: building?.id || null,
          buildingCode: building?.code || building?.name || null,
        });
      }
      if (building) {
        addDebt(byBuilding, building.id, building.code || building.name || building.id, debt, overdueAmount, {
          ownerId: owner?.id || null,
          ownerName: owner?.name || owner?.code || null,
        });
      }
      if (owner) {
        addDebt(byOwner, owner.id, owner.name || owner.code || owner.id, debt, overdueAmount, {
          ownerCode: owner.code || null,
        });
      }
    }

    const sortByDebt = (rows: any[]) => rows.sort((a, b) => b.debt - a.debt);
    return {
      totals: {
        invoiceCount: invoices.length,
        debt: totalDebt,
        overdueDebt,
      },
      customers: sortByDebt(Array.from(byCustomer.values())),
      rooms: sortByDebt(Array.from(byRoom.values())),
      buildings: sortByDebt(Array.from(byBuilding.values())),
      owners: sortByDebt(Array.from(byOwner.values())),
    };
  }

  async getBuildingFinance(tenantId: string, buildingCode: string) {
    const costCenter = await this.prisma.costCenter.findUnique({
      where: { tenantId_code: { tenantId, code: `CC-${buildingCode}` } }
    });

    if (!costCenter) throw new BadRequestException(`Cost Center for building ${buildingCode} not found`);

    const [revenues, expenses] = await Promise.all([
      this.prisma.journalLine.aggregate({
        where: { tenantId, costCenterId: costCenter.id, account: { type: 'REVENUE' }, type: 'CREDIT' },
        _sum: { amount: true }
      }),
      this.prisma.journalLine.aggregate({
        where: { tenantId, costCenterId: costCenter.id, account: { type: 'EXPENSE' }, type: 'DEBIT' },
        _sum: { amount: true }
      })
    ]);

    return {
      building: buildingCode,
      revenue: Number(revenues._sum.amount || 0),
      expense: Number(expenses._sum.amount || 0),
      profit: Number(revenues._sum.amount || 0) - Number(expenses._sum.amount || 0)
    };
  }

  async getBuildingProfitSummary(tenantId: string, options: { year?: string; month?: string } = {}) {
    const period = this.buildPeriodRange(options.year, options.month);
    const buildings = await this.prisma.building.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        owner: { select: { id: true, code: true, name: true } },
        rooms: { where: { deletedAt: null }, select: { id: true, code: true, name: true, status: true } },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return Promise.all(buildings.map(async (building) => {
      const occupiedRooms = building.rooms.filter((room) => room.status !== 'AVAILABLE').length;
      const roomIds = building.rooms.map((room) => room.id);
      const [revenues, journalExpenses, directExpenses, overdueInvoices, revenueItems, contracts, invoices, expenses] = await Promise.all([
        this.prisma.journalLine.aggregate({
          where: {
            tenantId,
            costCenter: { buildingId: building.id },
            account: { type: 'REVENUE' },
            type: 'CREDIT',
            createdAt: period,
          },
          _sum: { amount: true },
        }),
        this.prisma.journalLine.aggregate({
          where: {
            tenantId,
            costCenter: { buildingId: building.id },
            account: { type: 'EXPENSE' },
            type: 'DEBIT',
            createdAt: period,
          },
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: {
            tenantId,
            buildingId: building.id,
            deletedAt: null,
            status: { in: ['APPROVED', 'PAID'] as any },
            date: period,
          },
          _sum: { amount: true },
        }),
        this.prisma.invoice.count({
          where: {
            tenantId,
            contract: { room: { buildingId: building.id } },
            status: 'OVERDUE' as any,
            deletedAt: null,
          },
        }),
        this.prisma.invoiceItem.findMany({
          where: {
            tenantId,
            invoice: {
              deletedAt: null,
              createdAt: period,
              contract: {
                room: {
                  buildingId: building.id,
                },
              },
            },
          },
          select: {
            type: true,
            amount: true,
            invoice: {
              select: {
                contract: {
                  select: {
                    room: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        this.prisma.contract.findMany({
          where: {
            tenantId,
            roomId: { in: roomIds },
            deletedAt: null,
          },
          select: {
            id: true,
            roomId: true,
            code: true,
            status: true,
            startDate: true,
            endDate: true,
            monthlyRent: true,
            customer: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
          },
          orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.invoice.findMany({
          where: {
            tenantId,
            contract: {
              roomId: { in: roomIds },
            },
            deletedAt: null,
            createdAt: period,
          },
          select: {
            id: true,
            contractId: true,
            code: true,
            status: true,
            dueDate: true,
            total: true,
            paidAmount: true,
            creditAmount: true,
            customer: {
              select: {
                id: true,
                fullName: true,
              },
            },
            contract: {
              select: {
                roomId: true,
              },
            },
          },
          orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.expense.findMany({
          where: {
            tenantId,
            roomId: { in: roomIds },
            deletedAt: null,
            date: period,
          },
          select: {
            id: true,
            roomId: true,
            code: true,
            status: true,
            category: true,
            amount: true,
            settlementStatus: true,
            description: true,
            paidByName: true,
            paidByOwner: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        }),
      ]);

      const revenue = Number(revenues._sum.amount || 0);
      const expense = Math.max(Number(journalExpenses._sum.amount || 0), Number(directExpenses._sum.amount || 0));
      const profit = revenue - expense;
      const expenseRatio = revenue > 0 ? (expense / revenue) * 100 : expense > 0 ? 100 : 0;
      const rentRevenue = revenueItems
        .filter((item) => item.type === 'RENT')
        .reduce((total, item) => total + Number(item.amount || 0), 0);
      const electricityRevenue = revenueItems
        .filter((item) => item.type === 'UTILITY_ELECTRICITY')
        .reduce((total, item) => total + Number(item.amount || 0), 0);
      const waterServiceRevenue = revenueItems
        .filter((item) => item.type === 'UTILITY_WATER' || item.type === 'SERVICE')
        .reduce((total, item) => total + Number(item.amount || 0), 0);
      const otherRevenue = Math.max(0, revenue - rentRevenue - electricityRevenue - waterServiceRevenue);
      const roomBreakdownMap = new Map<string, any>();

      for (const room of building.rooms) {
        roomBreakdownMap.set(room.id, {
          room: {
            id: room.id,
            code: room.code,
            name: room.name,
            status: room.status,
          },
          revenue: 0,
          revenueBreakdown: {
            rent: 0,
            electricity: 0,
            waterAndService: 0,
            other: 0,
          },
          contracts: [],
          invoices: [],
          expenses: [],
        });
      }

      for (const item of revenueItems) {
        const room = item.invoice?.contract?.room;
        if (!room) continue;
        const current = roomBreakdownMap.get(room.id) || {
          room: {
            id: room.id,
            code: room.code,
            name: room.name,
            status: room.status,
          },
          revenue: 0,
          revenueBreakdown: {
            rent: 0,
            electricity: 0,
            waterAndService: 0,
            other: 0,
          },
          contracts: [],
          invoices: [],
          expenses: [],
        };

        const amount = Number(item.amount || 0);
        current.revenue += amount;
        if (item.type === 'RENT') {
          current.revenueBreakdown.rent += amount;
        } else if (item.type === 'UTILITY_ELECTRICITY') {
          current.revenueBreakdown.electricity += amount;
        } else if (item.type === 'UTILITY_WATER' || item.type === 'SERVICE') {
          current.revenueBreakdown.waterAndService += amount;
        } else {
          current.revenueBreakdown.other += amount;
        }
        roomBreakdownMap.set(room.id, current);
      }

      for (const contract of contracts) {
        const current = roomBreakdownMap.get(contract.roomId);
        if (!current) continue;
        current.contracts.push({
          id: contract.id,
          code: contract.code,
          status: contract.status,
          startDate: contract.startDate,
          endDate: contract.endDate,
          monthlyRent: Number(contract.monthlyRent || 0),
          customer: contract.customer,
        });
      }

      for (const invoice of invoices) {
        const roomId = invoice.contract?.roomId;
        if (!roomId) continue;
        const current = roomBreakdownMap.get(roomId);
        if (!current) continue;
        current.invoices.push({
          id: invoice.id,
          code: invoice.code,
          status: invoice.status,
          dueDate: invoice.dueDate,
          total: Number(invoice.total || 0),
          paidAmount: Number(invoice.paidAmount || 0),
          creditAmount: Number(invoice.creditAmount || 0),
          remainingAmount: Math.max(
            0,
            Number(invoice.total || 0) - Number(invoice.paidAmount || 0) - Number(invoice.creditAmount || 0),
          ),
          customer: invoice.customer,
        });
      }

      for (const expense of expenses) {
        if (!expense.roomId) continue;
        const current = roomBreakdownMap.get(expense.roomId);
        if (!current) continue;
        current.expenses.push({
          id: expense.id,
          code: expense.code,
          status: expense.status,
          category: expense.category,
          amount: Number(expense.amount || 0),
          settlementStatus: expense.settlementStatus,
          description: expense.description,
          paidByName: expense.paidByOwner?.name || expense.paidByName || null,
        });
      }

      const roomBreakdown = Array.from(roomBreakdownMap.values()).sort(
        (left, right) => Number(right.revenue || 0) - Number(left.revenue || 0),
      );

      return {
        building: {
          id: building.id,
          code: building.code,
          name: building.name,
          roomCount: building.rooms.length,
          occupiedRooms,
          occupancyRate: building.rooms.length ? Math.round((occupiedRooms / building.rooms.length) * 100) : 0,
        },
        owner: building.owner,
        revenue,
        revenueBreakdown: {
          rent: rentRevenue,
          electricity: electricityRevenue,
          waterAndService: waterServiceRevenue,
          other: otherRevenue,
        },
        roomBreakdown,
        expense,
        profit,
        margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
        overdueInvoices,
        alerts: [
          ...(expenseRatio >= 35 ? ['Chi phí vượt 35% doanh thu kỳ này'] : []),
          ...(overdueInvoices > 0 ? [`${overdueInvoices} hóa đơn quá hạn`] : []),
          ...(building.rooms.length && occupiedRooms === 0 ? ['Tòa chưa có phòng đang thuê'] : []),
        ],
      };
    }));
  }

  async getOwners(tenantId: string) {
    const owners = await this.prisma.owner.findMany({
      where: { tenantId, isActive: true },
      include: {
        buildings: {
          select: { id: true, code: true, name: true },
          orderBy: { displayOrder: 'asc' },
        },
        bankAccounts: {
          select: { id: true, bankName: true, accountNumber: true, accountName: true, isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    const bankAccounts = owners.flatMap((owner) => owner.bankAccounts || []);
    if (bankAccounts.length === 0) {
      return owners;
    }

    const paymentRequests = await this.prisma.paymentRequest.findMany({
      where: {
        tenantId,
        bankAccountId: { in: bankAccounts.map((bank) => bank.id) },
      },
      select: {
        bankAccountId: true,
        status: true,
        createdAt: true,
      },
    });

    const usageByBankId = new Map<string, {
      requestCount: number;
      pendingCount: number;
      confirmedCount: number;
      latestRequestAt: Date | null;
      inUse: boolean;
    }>();

    for (const request of paymentRequests) {
      if (!request.bankAccountId) continue;
      const current = usageByBankId.get(request.bankAccountId) || {
        requestCount: 0,
        pendingCount: 0,
        confirmedCount: 0,
        latestRequestAt: null,
        inUse: false,
      };
      current.requestCount += 1;
      current.pendingCount += request.status === 'PENDING' ? 1 : 0;
      current.confirmedCount += request.status === 'CONFIRMED' ? 1 : 0;
      current.latestRequestAt =
        !current.latestRequestAt || Number(request.createdAt) > Number(current.latestRequestAt)
          ? request.createdAt
          : current.latestRequestAt;
      current.inUse = current.pendingCount > 0 || current.confirmedCount > 0;
      usageByBankId.set(request.bankAccountId, current);
    }

    return owners.map((owner) => ({
      ...owner,
      bankAccounts: (owner.bankAccounts || []).map((bank) => ({
        ...bank,
        usage: usageByBankId.get(bank.id) || {
          requestCount: 0,
          pendingCount: 0,
          confirmedCount: 0,
          latestRequestAt: null,
          inUse: false,
        },
      })),
    }));
  }

  async updateBankAccountStatus(tenantId: string, userId: string | undefined, bankAccountId: string, isActive: boolean) {
    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { tenantId, id: bankAccountId },
    });
    if (!bankAccount) {
      throw new BadRequestException('BANK_ACCOUNT_NOT_FOUND');
    }

    if (bankAccount.isActive === isActive) {
      return bankAccount;
    }

    if (!isActive) {
      const [pendingCount, defaultSettings] = await Promise.all([
        this.prisma.paymentRequest.count({
          where: {
            tenantId,
            bankAccountId,
            status: 'PENDING' as any,
          },
        }),
        this.prisma.appSetting.findUnique({
          where: {
            tenantId_scope_ownerId_key: {
              tenantId,
              scope: SettingScope.TENANT,
              ownerId: tenantId,
              key: 'owner-bank-defaults',
            },
          },
        }),
      ]);

      if (pendingCount > 0) {
        throw new BadRequestException('BANK_ACCOUNT_HAS_PENDING_PAYMENT_REQUESTS');
      }

      const defaults = ((defaultSettings?.value as any)?.defaults || {}) as Record<string, string>;
      const isDefaultBank = Object.values(defaults).some((value) => value === bankAccountId);
      if (isDefaultBank) {
        throw new BadRequestException('BANK_ACCOUNT_IS_DEFAULT_PAYMENT_BANK');
      }
    }

    const updated = await this.prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { isActive },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'Finance',
        entity: 'BankAccount',
        entityId: bankAccountId,
        action: AuditAction.UPDATE,
        before: {
          isActive: bankAccount.isActive,
          bankName: bankAccount.bankName,
          accountNumber: bankAccount.accountNumber,
        },
        after: {
          isActive: updated.isActive,
          bankName: updated.bankName,
          accountNumber: updated.accountNumber,
        },
      },
    });

    return updated;
  }

  async getBankCashFlow(tenantId: string, options: { year?: string; month?: string; ownerId?: string } = {}) {
    const period = this.buildPeriodRange(options.year, options.month);
    const bankAccounts = await this.prisma.bankAccount.findMany({
      where: {
        tenantId,
        ...(options.ownerId ? { ownerId: options.ownerId } : {}),
      },
      include: {
        owner: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ ownerId: 'asc' }, { createdAt: 'asc' }],
    });

    const paymentRequests = await this.prisma.paymentRequest.findMany({
      where: {
        tenantId,
        bankAccountId: { in: bankAccounts.map((bank) => bank.id) },
        createdAt: period,
      },
      select: {
        id: true,
        bankAccountId: true,
        ownerId: true,
        amount: true,
        status: true,
        sourceType: true,
        sourceId: true,
        paymentCode: true,
        createdAt: true,
        paidAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const requestsByBank = new Map<string, typeof paymentRequests>();
    for (const request of paymentRequests) {
      if (!request.bankAccountId) continue;
      const rows = requestsByBank.get(request.bankAccountId) || [];
      rows.push(request);
      requestsByBank.set(request.bankAccountId, rows);
    }

    const rows = bankAccounts.map((bank) => {
      const requests = requestsByBank.get(bank.id) || [];
      const confirmed = requests.filter((request) => request.status === 'CONFIRMED');
      const pending = requests.filter((request) => request.status === 'PENDING');
      const cancelled = requests.filter((request) => request.status === 'CANCELLED' || request.status === 'EXPIRED');
      const confirmedAmount = confirmed.reduce((total, request) => total + Number(request.amount || 0), 0);
      const pendingAmount = pending.reduce((total, request) => total + Number(request.amount || 0), 0);
      const latestPaidAt = confirmed
        .map((request) => request.paidAt)
        .filter(Boolean)
        .sort((a, b) => Number(b) - Number(a))[0] || null;

      return {
        bankAccount: {
          id: bank.id,
          bankName: bank.bankName,
          accountNumber: bank.accountNumber,
          accountName: bank.accountName,
          isActive: bank.isActive,
        },
        owner: bank.owner,
        requestCount: requests.length,
        confirmedCount: confirmed.length,
        pendingCount: pending.length,
        cancelledCount: cancelled.length,
        confirmedAmount,
        pendingAmount,
        latestPaidAt,
        latestRequestAt: requests[0]?.createdAt || null,
        recentRequests: requests.slice(0, 5),
      };
    });

    return {
      period: {
        year: Number(options.year || new Date().getFullYear()),
        month: options.month ? Number(options.month) : null,
        startDate: period.gte,
        endDate: period.lte,
      },
      summary: {
        bankCount: rows.length,
        requestCount: rows.reduce((total, row) => total + row.requestCount, 0),
        confirmedAmount: rows.reduce((total, row) => total + row.confirmedAmount, 0),
        pendingAmount: rows.reduce((total, row) => total + row.pendingAmount, 0),
      },
      rows,
    };
  }

  async getBankTransactions(
    tenantId: string,
    options: { year?: string; month?: string; bankAccountId?: string; direction?: string; content?: string; search?: string; limit?: string } = {},
  ) {
    const period = this.buildPeriodRange(options.year, options.month);
    const bankAccounts = await this.prisma.bankAccount.findMany({
      where: {
        tenantId,
        ...(options.bankAccountId ? { id: options.bankAccountId } : {}),
      },
      include: {
        owner: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ bankName: 'asc' }, { accountNumber: 'asc' }],
    });
    const accountNumbers = bankAccounts.map((bank) => bank.accountNumber).filter(Boolean);
    const bankByAccountNumber = new Map(bankAccounts.map((bank) => [bank.accountNumber, bank]));
    const requestedLimit = Number(options.limit || 200);
    const limit = Number.isFinite(requestedLimit) ? Math.min(1000, Math.max(20, Math.round(requestedLimit))) : 200;
    const content = String(options.content || '').trim().toLowerCase();
    const search = String(options.search || '').trim().toLowerCase();
    const requestedDirection = String(options.direction || '').toUpperCase();

    if (bankAccounts.length === 0) {
      return {
        period: {
          year: Number(options.year || new Date().getFullYear()),
          month: options.month ? Number(options.month) : null,
          startDate: period.gte,
          endDate: period.lte,
        },
        filters: { bankAccounts: [] },
        summary: { total: 0, inflow: 0, outflow: 0, net: 0, bankCount: 0 },
        rows: [],
      };
    }

    const logs = await this.prisma.paymentWebhookLog.findMany({
      where: {
        provider: 'SEPAY' as any,
        createdAt: period,
      },
      orderBy: { createdAt: 'desc' },
      take: 1500,
    });

    const paymentCodes = Array.from(new Set(
      logs
        .map((log) => this.resolveWebhookPaymentCode(log.payload as any))
        .filter(Boolean),
    ));
    const requests = paymentCodes.length ? await this.prisma.paymentRequest.findMany({
      where: {
        tenantId,
        paymentCode: { in: paymentCodes },
      },
      include: {
        owner: { select: { id: true, code: true, name: true } },
        bankAccount: { select: { id: true, bankName: true, accountNumber: true, accountName: true } },
      },
    }) : [];
    const requestByCode = new Map(requests.map((request) => [request.paymentCode, request]));

    const rows = logs
      .map((log) => {
        const payload = log.payload as any;
        const paymentCode = this.resolveWebhookPaymentCode(payload);
        const accountNumber = String(payload?.accountNumber || payload?.account_number || payload?.bank_account_xid || '').trim();
        const request = paymentCode ? requestByCode.get(paymentCode) : null;
        const bankAccount = bankByAccountNumber.get(accountNumber) || request?.bankAccount || null;
        if (!bankAccount || !accountNumbers.includes(bankAccount.accountNumber)) return null;

        const direction = this.resolveWebhookDirection(payload);
        const amount = this.resolveWebhookAmount(payload);
        const content = String(payload?.content || payload?.description || payload?.memo || '').trim();
        const reference = String(payload?.referenceCode || payload?.reference_code || payload?.transactionDate || '').trim();

        return {
          id: log.id,
          provider: log.provider,
          providerTransactionId: log.providerTransactionId,
          createdAt: log.createdAt,
          processedAt: log.processedAt,
          direction,
          amount,
          content,
          reference,
          paymentCode,
          transferType: String(payload?.transferType || payload?.transfer_type || '').trim(),
          bankAccount: {
            id: bankAccount.id,
            bankName: bankAccount.bankName,
            accountNumber: bankAccount.accountNumber,
            accountName: bankAccount.accountName,
          },
          owner: request?.owner || (bankAccounts.find((bank) => bank.id === bankAccount.id) as any)?.owner || null,
          match: request ? {
            sourceType: request.sourceType,
            sourceId: request.sourceId,
            status: request.status,
            expectedAmount: Number(request.amount || 0),
          } : null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => !requestedDirection || row.direction === requestedDirection)
      .filter((row) => !content || row.content.toLowerCase().includes(content))
      .filter((row) => {
        if (!search) return true;
        const haystack = [
          row.providerTransactionId,
          row.paymentCode,
          row.content,
          row.bankAccount.bankName,
          row.bankAccount.accountNumber,
          row.bankAccount.accountName,
          row.owner?.name,
          row.owner?.code,
        ].join(' ').toLowerCase();
        return haystack.includes(search);
      });

    const limitedRows = rows.slice(0, limit);
    const inflow = rows.filter((row) => row.direction === 'IN').reduce((total, row) => total + row.amount, 0);
    const outflow = rows.filter((row) => row.direction === 'OUT').reduce((total, row) => total + row.amount, 0);

    return {
      period: {
        year: Number(options.year || new Date().getFullYear()),
        month: options.month ? Number(options.month) : null,
        startDate: period.gte,
        endDate: period.lte,
      },
      filters: {
        bankAccounts: bankAccounts.map((bank) => ({
          id: bank.id,
          bankName: bank.bankName,
          accountNumber: bank.accountNumber,
          accountName: bank.accountName,
          owner: bank.owner,
        })),
      },
      summary: {
        total: rows.length,
        inflow,
        outflow,
        net: inflow - outflow,
        bankCount: bankAccounts.length,
      },
      rows: limitedRows,
    };
  }

  async getSePayReconciliation(tenantId: string, options: { year?: string; month?: string; status?: string } = {}) {
    const period = this.buildPeriodRange(options.year, options.month);
    const logs = await this.prisma.paymentWebhookLog.findMany({
      where: {
        provider: 'SEPAY' as any,
        createdAt: period,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const paymentCodes = Array.from(new Set(
      logs
        .map((log) => this.resolveWebhookPaymentCode(log.payload as any))
        .filter(Boolean),
    ));

    const requests = paymentCodes.length ? await this.prisma.paymentRequest.findMany({
      where: {
        tenantId,
        paymentCode: { in: paymentCodes },
      },
      include: {
        owner: { select: { id: true, code: true, name: true } },
        bankAccount: { select: { id: true, bankName: true, accountNumber: true, accountName: true } },
      },
    }) : [];
    const requestByCode = new Map(requests.map((request) => [request.paymentCode, request]));
    const roomIds = Array.from(new Set(requests.map((request) => request.roomId).filter(Boolean)));
    const buildingIds = Array.from(new Set(requests.map((request) => request.buildingId).filter(Boolean)));
    const rooms = roomIds.length
      ? await this.prisma.room.findMany({
          where: { tenantId, id: { in: roomIds as string[] } },
          select: {
            id: true,
            code: true,
            name: true,
            rentalType: true,
            capacity: true,
            buildingId: true,
            building: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      : [];
    const buildings = buildingIds.length
      ? await this.prisma.building.findMany({
          where: { tenantId, id: { in: buildingIds as string[] } },
          select: {
            id: true,
            name: true,
          },
        })
      : [];
    const roomById = new Map(rooms.map((room) => [room.id, room]));
    const buildingById = new Map(buildings.map((building) => [building.id, building]));

    const rows = logs.map((log) => {
      const payload = log.payload as any;
      const paymentCode = this.resolveWebhookPaymentCode(payload);
      const amount = Number(payload?.transferAmount ?? payload?.amount ?? 0);
      const accountNumber = String(payload?.accountNumber || payload?.account_number || payload?.bank_account_xid || '').trim();
      const transferType = String(payload?.transferType || payload?.transfer_type || '').toLowerCase();
      const request = paymentCode ? requestByCode.get(paymentCode) : null;
      const requestMetadata = (request?.metadata as any) || {};
      const requestRoom = request?.roomId ? roomById.get(request.roomId) || null : null;
      const requestBuilding = request?.buildingId ? buildingById.get(request.buildingId) || null : null;
      const roomContext = requestRoom
        ? buildRoomContext(requestRoom, { memberCount: requestMetadata.roomMemberCount })
        : {
            roomId: requestMetadata.roomId || request?.roomId || null,
            roomCode: requestMetadata.roomCode || null,
            roomName: requestMetadata.roomName || null,
            roomRentalType: requestMetadata.roomRentalType || null,
            roomRentalTypeLabel: requestMetadata.roomRentalTypeLabel || null,
            roomMemberCount:
              Number.isFinite(Number(requestMetadata.roomMemberCount)) && Number(requestMetadata.roomMemberCount) > 0
                ? Number(requestMetadata.roomMemberCount)
                : null,
            roomCapacity:
              Number.isFinite(Number(requestMetadata.roomCapacity)) && Number(requestMetadata.roomCapacity) > 0
                ? Number(requestMetadata.roomCapacity)
                : null,
            buildingId: requestMetadata.buildingId || request?.buildingId || requestBuilding?.id || null,
            buildingName: requestMetadata.buildingName || requestBuilding?.name || null,
          };
      const expectedAmount = request ? Number(request.amount || 0) : 0;
      const amountDiff = request ? amount - expectedAmount : amount;
      const directionInvalid = transferType === 'debit' || transferType === 'out';

      const webhookStatus = String((log as any).status || '').toUpperCase();
      let status = 'UNMATCHED';
      if (webhookStatus === 'FAILED') status = 'FAILED';
      else if (webhookStatus === 'PROCESSING') status = 'PROCESSING';
      else if (webhookStatus === 'RECEIVED' && !log.processedAt) status = 'PENDING_PROCESSING';
      else if (directionInvalid) status = 'IGNORED_OUTGOING';
      else if (!paymentCode || !request) status = 'UNMATCHED';
      else if (accountNumber && request.bankAccountNumber !== accountNumber) status = 'WRONG_BANK';
      else if (amount < expectedAmount) status = 'SHORT_AMOUNT';
      else if (amount > expectedAmount) status = 'OVER_AMOUNT';
      else status = 'MATCHED';

      return {
        id: log.id,
        providerTransactionId: log.providerTransactionId,
        createdAt: log.createdAt,
        processedAt: log.processedAt,
        status,
        webhookStatus: webhookStatus || null,
        webhookLastError: (log as any).lastError || null,
        webhookAttemptCount: Number((log as any).attemptCount || 0),
        paymentCode,
        amount,
        expectedAmount,
        amountDiff,
        accountNumber,
        transferType,
        sourceType: request?.sourceType || null,
        sourceId: request?.sourceId || null,
        requestStatus: request?.status || null,
        ...roomContext,
        owner: request?.owner || null,
        bankAccount: request?.bankAccount || null,
        overpaymentResolution: requestMetadata.overpaymentResolution || payload?.overpaymentResolution || null,
        overpaymentAmount: Number(
          requestMetadata.overpaymentAmount ??
            payload?.overpaymentAmount ??
            Math.max(amountDiff, 0),
        ),
        overpaymentResolvedAt:
          requestMetadata.overpaymentResolvedAt || payload?.overpaymentResolvedAt || null,
        overpaymentRefundCompletedAt:
          requestMetadata.overpaymentRefundCompletedAt || payload?.overpaymentRefundCompletedAt || null,
        overpaymentRefundCompletionNote:
          requestMetadata.overpaymentRefundCompletionNote || payload?.overpaymentRefundCompletionNote || null,
        overpaymentTaskId: requestMetadata.overpaymentTaskId || payload?.overpaymentTaskId || null,
        overpaymentTaskTitle: requestMetadata.overpaymentTaskTitle || payload?.overpaymentTaskTitle || null,
      };
    });

    const filteredRows = options.status ? rows.filter((row) => row.status === options.status) : rows;
    return {
      period: {
        year: Number(options.year || new Date().getFullYear()),
        month: options.month ? Number(options.month) : null,
        startDate: period.gte,
        endDate: period.lte,
      },
      summary: {
        total: rows.length,
        matched: rows.filter((row) => row.status === 'MATCHED').length,
        unmatched: rows.filter((row) => row.status === 'UNMATCHED').length,
        shortAmount: rows.filter((row) => row.status === 'SHORT_AMOUNT').length,
        overAmount: rows.filter((row) => row.status === 'OVER_AMOUNT').length,
        wrongBank: rows.filter((row) => row.status === 'WRONG_BANK').length,
        ignoredOutgoing: rows.filter((row) => row.status === 'IGNORED_OUTGOING').length,
        failed: rows.filter((row) => row.status === 'FAILED').length,
        processing: rows.filter((row) => row.status === 'PROCESSING').length,
        pendingProcessing: rows.filter((row) => row.status === 'PENDING_PROCESSING').length,
      },
      rows: filteredRows,
    };
  }

  async getSePayReconciliationAudit(
    tenantId: string,
    options: { year?: string; month?: string; severity?: string; type?: string } = {},
  ) {
    const period = this.buildPeriodRange(options.year, options.month);
    const [requests, logs, sepayPayments] = await Promise.all([
      this.prisma.paymentRequest.findMany({
        where: {
          tenantId,
          provider: 'SEPAY' as any,
          OR: [{ createdAt: period }, { updatedAt: period }, { paidAt: period }],
        },
        include: {
          owner: { select: { id: true, code: true, name: true } },
          bankAccount: { select: { id: true, bankName: true, accountNumber: true, accountName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.paymentWebhookLog.findMany({
        where: {
          tenantId,
          provider: 'SEPAY' as any,
          createdAt: period,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.payment.findMany({
        where: {
          tenantId,
          provider: 'SEPAY',
          deletedAt: null,
          OR: [{ createdAt: period }, { paidAt: period }],
        },
        include: {
          invoice: {
            select: {
              id: true,
              code: true,
              status: true,
              total: true,
              paidAmount: true,
              creditAmount: true,
              contract: {
                select: {
                  room: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      rentalType: true,
                      capacity: true,
                      building: {
                        select: {
                          id: true,
                          name: true,
                          owner: { select: { id: true, name: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const invoiceIds = Array.from(
      new Set([
        ...requests.filter((request) => request.sourceType === 'INVOICE').map((request) => request.sourceId),
        ...sepayPayments.map((payment) => payment.invoiceId),
      ].filter(Boolean)),
    );
    const depositIds = Array.from(
      new Set(requests.filter((request) => request.sourceType === 'DEPOSIT').map((request) => request.sourceId).filter(Boolean)),
    );

    const [invoices, deposits] = await Promise.all([
      invoiceIds.length
        ? this.prisma.invoice.findMany({
            where: { tenantId, id: { in: invoiceIds as string[] }, deletedAt: null },
            include: {
              contract: {
                include: {
                  room: {
                    include: {
                      building: {
                        include: {
                          owner: { select: { id: true, name: true } },
                        },
                      },
                    },
                  },
                },
              },
              customer: { select: { id: true, fullName: true } },
              payments: {
                where: { provider: 'SEPAY', deletedAt: null },
                select: {
                  id: true,
                  amount: true,
                  status: true,
                  providerRef: true,
                  paidAt: true,
                  createdAt: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      depositIds.length
        ? this.prisma.deposit.findMany({
            where: { tenantId, id: { in: depositIds as string[] }, deletedAt: null },
            include: {
              customer: { select: { id: true, fullName: true } },
              contract: { select: { id: true, status: true } },
              room: {
                include: {
                  building: {
                    include: {
                      owner: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    const depositById = new Map(deposits.map((deposit) => [deposit.id, deposit]));
    const requestsBySource = new Map<string, any[]>();
    const confirmedRequestsBySource = new Map<string, any[]>();
    const logsByPaymentCode = new Map<string, any[]>();
    const logByTransactionId = new Map<string, any>();
    const issues: SePayAuditIssue[] = [];
    const issueKeys = new Set<string>();
    const now = Date.now();

    for (const request of requests) {
      const key = this.buildPaymentSourceKey(request.sourceType, request.sourceId);
      const sourceRequests = requestsBySource.get(key) || [];
      sourceRequests.push(request);
      requestsBySource.set(key, sourceRequests);
      if (request.status === 'CONFIRMED') {
        const confirmed = confirmedRequestsBySource.get(key) || [];
        confirmed.push(request);
        confirmedRequestsBySource.set(key, confirmed);
      }
    }

    for (const log of logs) {
      const payload = log.payload as any;
      const paymentCode = this.resolveWebhookPaymentCode(payload);
      if (paymentCode) {
        const paymentCodeLogs = logsByPaymentCode.get(paymentCode) || [];
        paymentCodeLogs.push(log);
        logsByPaymentCode.set(paymentCode, paymentCodeLogs);
      }
      if (log.providerTransactionId) {
        logByTransactionId.set(log.providerTransactionId, log);
      }
    }

    const pushIssue = (issue: SePayAuditIssue) => {
      const dedupeKey = `${issue.type}:${issue.requestId || '-'}:${issue.webhookId || '-'}:${issue.sourceType || '-'}:${issue.sourceId || '-'}:${issue.providerTransactionId || '-'}:${issue.paymentCode || '-'}`;
      if (issueKeys.has(dedupeKey)) return;
      issueKeys.add(dedupeKey);
      issues.push(issue);
    };

    for (const request of requests) {
      const sourceType = String(request.sourceType || '');
      const metadata = (request.metadata as any) || {};
      const source =
        sourceType === 'INVOICE'
          ? invoiceById.get(request.sourceId) || null
          : sourceType === 'DEPOSIT'
            ? depositById.get(request.sourceId) || null
            : null;
      const sourceSnapshot = this.buildSePayAuditSourceSnapshot(request, source);
      const paymentCodeLogs = logsByPaymentCode.get(request.paymentCode) || [];
      const latestRelevantLog = paymentCodeLogs[0] || null;
      const transactionLog = request.providerTransactionId ? logByTransactionId.get(request.providerTransactionId) || null : null;
      const activeLog = transactionLog || latestRelevantLog;

      if (request.status === 'CONFIRMED' && !sourceSnapshot.settled) {
        pushIssue({
          id: `confirmed-open-${request.id}`,
          severity: 'CRITICAL',
          type: 'CONFIRMED_REQUEST_SOURCE_OPEN',
          title: 'Payment request đã xác nhận nhưng chứng từ nguồn chưa settled',
          description: `${sourceSnapshot.sourceLabel} ${sourceSnapshot.sourceCode || request.sourceId} vẫn ở trạng thái ${sourceSnapshot.sourceStatus || 'UNKNOWN'}.`,
          createdAt: request.paidAt || request.updatedAt || request.createdAt,
          ageHours: this.toAgeHours(request.paidAt || request.updatedAt || request.createdAt, now),
          paymentCode: request.paymentCode,
          providerTransactionId: request.providerTransactionId || null,
          sourceType,
          sourceId: request.sourceId,
          sourceCode: sourceSnapshot.sourceCode,
          sourceStatus: sourceSnapshot.sourceStatus,
          requestId: request.id,
          requestStatus: request.status,
          webhookId: activeLog?.id || null,
          webhookStatus: activeLog?.status || null,
          expectedAmount: Number(request.amount || 0),
          actualAmount: sourceSnapshot.actualAmount,
          roomCode: sourceSnapshot.roomCode,
          buildingName: sourceSnapshot.buildingName,
          roomRentalTypeLabel: sourceSnapshot.roomRentalTypeLabel,
          roomMemberCount: sourceSnapshot.roomMemberCount,
          ownerName: sourceSnapshot.ownerName,
          bankName: request.bankAccount?.bankName || request.bankName || null,
          accountNumber: request.bankAccount?.accountNumber || request.bankAccountNumber || null,
          metadata: {
            remainingAmount: sourceSnapshot.remainingAmount,
          },
        });
      }

      if (request.status !== 'CONFIRMED' && sourceSnapshot.settled) {
        pushIssue({
          id: `open-settled-${request.id}`,
          severity: 'WARNING',
          type: 'SETTLED_SOURCE_MISSING_CONFIRMED_REQUEST',
          title: 'Chứng từ nguồn đã settled nhưng payment request chưa confirmed',
          description: `${sourceSnapshot.sourceLabel} ${sourceSnapshot.sourceCode || request.sourceId} đã settled, nhưng request vẫn là ${request.status}.`,
          createdAt: sourceSnapshot.settledAt || request.updatedAt || request.createdAt,
          ageHours: this.toAgeHours(sourceSnapshot.settledAt || request.updatedAt || request.createdAt, now),
          paymentCode: request.paymentCode,
          providerTransactionId: request.providerTransactionId || null,
          sourceType,
          sourceId: request.sourceId,
          sourceCode: sourceSnapshot.sourceCode,
          sourceStatus: sourceSnapshot.sourceStatus,
          requestId: request.id,
          requestStatus: request.status,
          webhookId: activeLog?.id || null,
          webhookStatus: activeLog?.status || null,
          expectedAmount: Number(request.amount || 0),
          actualAmount: sourceSnapshot.actualAmount,
          roomCode: sourceSnapshot.roomCode,
          buildingName: sourceSnapshot.buildingName,
          roomRentalTypeLabel: sourceSnapshot.roomRentalTypeLabel,
          roomMemberCount: sourceSnapshot.roomMemberCount,
          ownerName: sourceSnapshot.ownerName,
          bankName: request.bankAccount?.bankName || request.bankName || null,
          accountNumber: request.bankAccount?.accountNumber || request.bankAccountNumber || null,
        });
      }

      const processedLog = paymentCodeLogs.find((log) => log.status === 'PROCESSED');
      if (processedLog && request.status !== 'CONFIRMED') {
        pushIssue({
          id: `processed-unconfirmed-${request.id}`,
          severity: 'CRITICAL',
          type: 'PROCESSED_WEBHOOK_REQUEST_UNCONFIRMED',
          title: 'Webhook đã processed nhưng payment request chưa confirmed',
          description: `Webhook ${processedLog.providerTransactionId} đã xử lý xong, nhưng request ${request.paymentCode} vẫn là ${request.status}.`,
          createdAt: processedLog.processedAt || processedLog.createdAt,
          ageHours: this.toAgeHours(processedLog.processedAt || processedLog.createdAt, now),
          paymentCode: request.paymentCode,
          providerTransactionId: processedLog.providerTransactionId || null,
          sourceType,
          sourceId: request.sourceId,
          sourceCode: sourceSnapshot.sourceCode,
          sourceStatus: sourceSnapshot.sourceStatus,
          requestId: request.id,
          requestStatus: request.status,
          webhookId: processedLog.id,
          webhookStatus: processedLog.status,
          expectedAmount: Number(request.amount || 0),
          actualAmount: this.resolveWebhookAmount(processedLog.payload as any),
          roomCode: sourceSnapshot.roomCode,
          buildingName: sourceSnapshot.buildingName,
          roomRentalTypeLabel: sourceSnapshot.roomRentalTypeLabel,
          roomMemberCount: sourceSnapshot.roomMemberCount,
          ownerName: sourceSnapshot.ownerName,
          bankName: request.bankAccount?.bankName || request.bankName || null,
          accountNumber: request.bankAccount?.accountNumber || request.bankAccountNumber || null,
        });
      }

      if (request.status === 'CONFIRMED' && !metadata.manualAssigned && !request.providerTransactionId) {
        pushIssue({
          id: `confirmed-no-txn-${request.id}`,
          severity: 'WARNING',
          type: 'CONFIRMED_REQUEST_MISSING_TRANSACTION_ID',
          title: 'Payment request confirmed nhưng thiếu provider transaction id',
          description: `Request ${request.paymentCode} đã confirmed nhưng chưa lưu transaction id để truy vết webhook.`,
          createdAt: request.paidAt || request.updatedAt || request.createdAt,
          ageHours: this.toAgeHours(request.paidAt || request.updatedAt || request.createdAt, now),
          paymentCode: request.paymentCode,
          providerTransactionId: null,
          sourceType,
          sourceId: request.sourceId,
          sourceCode: sourceSnapshot.sourceCode,
          sourceStatus: sourceSnapshot.sourceStatus,
          requestId: request.id,
          requestStatus: request.status,
          webhookId: null,
          webhookStatus: null,
          expectedAmount: Number(request.amount || 0),
          actualAmount: sourceSnapshot.actualAmount,
          roomCode: sourceSnapshot.roomCode,
          buildingName: sourceSnapshot.buildingName,
          roomRentalTypeLabel: sourceSnapshot.roomRentalTypeLabel,
          roomMemberCount: sourceSnapshot.roomMemberCount,
          ownerName: sourceSnapshot.ownerName,
          bankName: request.bankAccount?.bankName || request.bankName || null,
          accountNumber: request.bankAccount?.accountNumber || request.bankAccountNumber || null,
        });
      }

      if (metadata.overpaymentResolution === 'REFUND_PENDING' && !metadata.overpaymentRefundCompletedAt) {
        const ageHours = this.toAgeHours(request.updatedAt || request.paidAt || request.createdAt, now);
        if (ageHours !== null && ageHours >= 24) {
          pushIssue({
            id: `refund-stale-${request.id}`,
            severity: ageHours >= 72 ? 'CRITICAL' : 'WARNING',
            type: 'OVERPAYMENT_REFUND_PENDING_STALE',
            title: 'Hoàn dư SePay đang treo quá lâu',
            description: `Payment code ${request.paymentCode} còn tác vụ hoàn dư chưa hoàn tất.`,
            createdAt: request.updatedAt || request.paidAt || request.createdAt,
            ageHours,
            paymentCode: request.paymentCode,
            providerTransactionId: request.providerTransactionId || null,
            sourceType,
            sourceId: request.sourceId,
            sourceCode: sourceSnapshot.sourceCode,
            sourceStatus: sourceSnapshot.sourceStatus,
            requestId: request.id,
            requestStatus: request.status,
            webhookId: activeLog?.id || null,
            webhookStatus: activeLog?.status || null,
            expectedAmount: Number(request.amount || 0),
            actualAmount: Number(metadata.overpaymentAmount || 0),
            roomCode: sourceSnapshot.roomCode,
            buildingName: sourceSnapshot.buildingName,
            roomRentalTypeLabel: sourceSnapshot.roomRentalTypeLabel,
            roomMemberCount: sourceSnapshot.roomMemberCount,
            ownerName: sourceSnapshot.ownerName,
            bankName: request.bankAccount?.bankName || request.bankName || null,
            accountNumber: request.bankAccount?.accountNumber || request.bankAccountNumber || null,
            metadata: {
              overpaymentTaskTitle: metadata.overpaymentTaskTitle || null,
            },
          });
        }
      }
    }

    for (const payment of sepayPayments) {
      const invoice = invoiceById.get(payment.invoiceId) || payment.invoice;
      if (!invoice) continue;
      const sourceKey = this.buildPaymentSourceKey('INVOICE', payment.invoiceId);
      const hasConfirmedRequest = (confirmedRequestsBySource.get(sourceKey) || []).length > 0;
      if (hasConfirmedRequest) continue;
      const sourceSnapshot = this.buildSePayAuditSourceSnapshot(null, invoice);
      pushIssue({
        id: `payment-no-request-${payment.id}`,
        severity: 'WARNING',
        type: 'SEPAY_PAYMENT_WITHOUT_CONFIRMED_REQUEST',
        title: 'Invoice có payment SePay nhưng không có confirmed request',
        description: `Invoice ${invoice.code} đã ghi nhận payment SePay ${payment.providerRef || payment.id}, nhưng thiếu payment request confirmed tương ứng.`,
        createdAt: payment.paidAt || payment.createdAt,
        ageHours: this.toAgeHours(payment.paidAt || payment.createdAt, now),
        paymentCode: null,
        providerTransactionId: payment.providerRef || null,
        sourceType: 'INVOICE',
        sourceId: invoice.id,
        sourceCode: invoice.code,
        sourceStatus: invoice.status,
        requestId: null,
        requestStatus: null,
        webhookId: payment.providerRef ? logByTransactionId.get(payment.providerRef)?.id || null : null,
        webhookStatus: payment.providerRef ? logByTransactionId.get(payment.providerRef)?.status || null : null,
        expectedAmount: Number(invoice.total || 0),
        actualAmount: Number(payment.amount || 0),
        roomCode: sourceSnapshot.roomCode,
        buildingName: sourceSnapshot.buildingName,
        roomRentalTypeLabel: sourceSnapshot.roomRentalTypeLabel,
        roomMemberCount: sourceSnapshot.roomMemberCount,
        ownerName: sourceSnapshot.ownerName,
        bankName: null,
        accountNumber: null,
      });
    }

    for (const log of logs) {
      const paymentCode = this.resolveWebhookPaymentCode(log.payload as any);
      const relatedRequest = paymentCode ? requests.find((request) => request.paymentCode === paymentCode) || null : null;
      const ageHours = this.toAgeHours(log.createdAt, now);
      const isReviewState = ['FAILED', 'NEEDS_REVIEW'].includes(String(log.status || ''));
      const isPendingState = ['RECEIVED', 'PROCESSING'].includes(String(log.status || '')) && !log.processedAt;
      if ((isReviewState && (ageHours || 0) >= 6) || (isPendingState && (ageHours || 0) >= 1)) {
        pushIssue({
          id: `stale-log-${log.id}`,
          severity: isReviewState && (ageHours || 0) >= 24 ? 'CRITICAL' : 'WARNING',
          type: relatedRequest ? 'WEBHOOK_REVIEW_STALE' : 'UNMATCHED_WEBHOOK_STALE',
          title: relatedRequest ? 'Webhook SePay đang treo cần xử lý' : 'Webhook SePay chưa được gán nguồn',
          description: relatedRequest
            ? `Webhook ${log.providerTransactionId} đang ở trạng thái ${log.status} quá lâu cho payment code ${paymentCode || '-'}.`
            : `Webhook ${log.providerTransactionId} chưa khớp payment request nào và đang ở trạng thái ${log.status}.`,
          createdAt: log.createdAt,
          ageHours,
          paymentCode: paymentCode || null,
          providerTransactionId: log.providerTransactionId || null,
          sourceType: relatedRequest?.sourceType || null,
          sourceId: relatedRequest?.sourceId || null,
          sourceCode: null,
          sourceStatus: null,
          requestId: relatedRequest?.id || null,
          requestStatus: relatedRequest?.status || null,
          webhookId: log.id,
          webhookStatus: log.status,
          expectedAmount: relatedRequest ? Number(relatedRequest.amount || 0) : null,
          actualAmount: this.resolveWebhookAmount(log.payload as any),
          roomCode: null,
          buildingName: null,
          roomRentalTypeLabel: null,
          roomMemberCount: null,
          ownerName: relatedRequest?.owner?.name || null,
          bankName: relatedRequest?.bankAccount?.bankName || relatedRequest?.bankName || null,
          accountNumber: String((log.payload as any)?.accountNumber || (log.payload as any)?.account_number || ''),
          metadata: {
            lastError: (log as any).lastError || null,
            attemptCount: Number((log as any).attemptCount || 0),
          },
        });
      }
    }

    const filteredRows = issues.filter((issue) => {
      if (options.severity && issue.severity !== options.severity) return false;
      if (options.type && issue.type !== options.type) return false;
      return true;
    });

    const severityCounts = {
      critical: issues.filter((issue) => issue.severity === 'CRITICAL').length,
      warning: issues.filter((issue) => issue.severity === 'WARNING').length,
      info: issues.filter((issue) => issue.severity === 'INFO').length,
    };

    const issueTypeCounts = issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      period: {
        year: Number(options.year || new Date().getFullYear()),
        month: options.month ? Number(options.month) : null,
        startDate: period.gte,
        endDate: period.lte,
      },
      summary: {
        total: issues.length,
        ...severityCounts,
      },
      filters: {
        issueTypes: Object.entries(issueTypeCounts)
          .map(([type, count]) => ({ type, count }))
          .sort((left, right) => right.count - left.count),
      },
      rows: filteredRows.sort((left, right) => {
        const severityRank = { CRITICAL: 0, WARNING: 1, INFO: 2 };
        const leftRank = severityRank[left.severity] ?? 99;
        const rightRank = severityRank[right.severity] ?? 99;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
      }),
    };
  }

  async getExpenses(tenantId: string, options: { ownerId?: string; buildingId?: string; category?: string; status?: string; startDate?: string; endDate?: string } = {}) {
    const where: any = { tenantId, deletedAt: null };
    if (options.ownerId) where.ownerId = options.ownerId;
    if (options.buildingId) where.buildingId = options.buildingId;
    if (options.category) where.category = options.category;
    if (options.status) where.status = options.status;
    if (options.startDate || options.endDate) {
      where.date = {};
      if (options.startDate) where.date.gte = new Date(options.startDate);
      if (options.endDate) where.date.lte = new Date(options.endDate);
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      include: {
        owner: { select: { id: true, code: true, name: true } },
        paidByOwner: { select: { id: true, code: true, name: true } },
        costCenter: { select: { id: true, code: true, name: true, buildingId: true } },
      },
      orderBy: { date: 'desc' },
    });

    const buildingIds = Array.from(new Set(expenses.map((expense) => expense.buildingId).filter(Boolean))) as string[];
    const roomIds = Array.from(new Set(expenses.map((expense) => expense.roomId).filter(Boolean))) as string[];

    const [buildings, rooms] = await Promise.all([
      buildingIds.length
        ? this.prisma.building.findMany({
            where: { tenantId, id: { in: buildingIds }, deletedAt: null },
            select: { id: true, code: true, name: true },
          })
        : Promise.resolve([]),
      roomIds.length
        ? this.prisma.room.findMany({
            where: { tenantId, id: { in: roomIds }, deletedAt: null },
            select: { id: true, code: true, name: true, buildingId: true },
          })
        : Promise.resolve([]),
    ]);

    const buildingById = new Map(buildings.map((building) => [building.id, building]));
    const roomById = new Map(rooms.map((room) => [room.id, room]));

    return expenses.map((expense) => ({
      ...expense,
      building: expense.buildingId ? buildingById.get(expense.buildingId) || null : null,
      room: expense.roomId ? roomById.get(expense.roomId) || null : null,
    }));
  }

  async createExpense(tenantId: string, userId: string | undefined, data: any) {
    const amount = Number(data.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('EXPENSE_AMOUNT_INVALID');
    }

    const costCenter = await this.resolveCostCenter(tenantId, data.costCenterId, data.buildingId);
    const ownerId = data.ownerId || costCenter.ownerId;
    if (!ownerId) {
      throw new BadRequestException('EXPENSE_OWNER_REQUIRED');
    }

    const code = data.code || await this.nextExpenseCode(tenantId);
    const status = data.status || 'PENDING';
    const expense = await this.prisma.expense.create({
      data: {
        tenantId,
        code,
        costCenterId: costCenter.id,
        ownerId,
        buildingId: data.buildingId || costCenter.buildingId,
        roomId: data.roomId || null,
        paidByOwnerId: data.paidByOwnerId || null,
        paidByName: data.paidByName || null,
        category: data.category || 'OTHER',
        vendor: data.vendor || null,
        amount,
        status,
        settlementStatus: data.settlementStatus || (data.paidByOwnerId || data.paidByName ? 'PENDING_REIMBURSEMENT' : 'NONE'),
        description: data.description || null,
        attachmentUrls: Array.isArray(data.attachmentUrls) ? data.attachmentUrls : [],
        approvedBy: status === 'APPROVED' || status === 'PAID' ? userId : null,
        approvedAt: status === 'APPROVED' || status === 'PAID' ? new Date() : null,
        date: data.date ? new Date(data.date) : new Date(),
      } as any,
    });

    if (status === 'PAID') {
      await this.postExpenseJournal(tenantId, expense);
    }

    await this.logExpenseAudit(tenantId, userId, expense.id, 'CREATE', null, expense);
    await this.notifyExpenseCreated(tenantId, { ...expense, code: expense.code || code });
    return expense;
  }

  async updateExpense(tenantId: string, userId: string | undefined, id: string, data: any) {
    const expense = await this.prisma.expense.findFirst({ where: { tenantId, id, deletedAt: null } });
    if (!expense) throw new BadRequestException('EXPENSE_NOT_FOUND');
    if (expense.status === 'CANCELLED') throw new BadRequestException('EXPENSE_CANCELLED');

    const postedJournal = await this.prisma.journalEntry.findFirst({
      where: { tenantId, sourceType: 'EXPENSE' as any, sourceId: expense.id, status: 'POSTED' },
    });

    const amountProvided = data.amount !== undefined && data.amount !== null && data.amount !== '';
    const nextAmount = amountProvided ? Number(data.amount) : Number(expense.amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      throw new BadRequestException('EXPENSE_AMOUNT_INVALID');
    }
    if ((expense.status === 'PAID' || postedJournal) && Math.abs(nextAmount - Number(expense.amount)) > 0.01) {
      throw new BadRequestException('EXPENSE_AMOUNT_LOCKED_AFTER_POSTED');
    }

    const shouldResolveCostCenter = Boolean(data.costCenterId || data.buildingId);
    const costCenter = shouldResolveCostCenter
      ? await this.resolveCostCenter(tenantId, data.costCenterId, data.buildingId)
      : null;
    const ownerId = data.ownerId || costCenter?.ownerId || expense.ownerId;
    if (!ownerId) throw new BadRequestException('EXPENSE_OWNER_REQUIRED');

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(shouldResolveCostCenter && costCenter ? { costCenterId: costCenter.id } : {}),
        ownerId,
        buildingId: data.buildingId !== undefined ? data.buildingId || costCenter?.buildingId || null : expense.buildingId,
        roomId: data.roomId !== undefined ? data.roomId || null : expense.roomId,
        paidByOwnerId: data.paidByOwnerId !== undefined ? data.paidByOwnerId || null : expense.paidByOwnerId,
        paidByName: data.paidByName !== undefined ? data.paidByName || null : expense.paidByName,
        category: data.category || expense.category,
        vendor: data.vendor !== undefined ? data.vendor || null : expense.vendor,
        amount: nextAmount,
        description: data.description !== undefined ? data.description || null : expense.description,
        attachmentUrls: Array.isArray(data.attachmentUrls) ? data.attachmentUrls : expense.attachmentUrls,
        date: data.date ? new Date(data.date) : expense.date,
      } as any,
    });

    await this.logExpenseAudit(tenantId, userId, id, 'UPDATE', expense, updated);
    return updated;
  }

  async approveExpense(tenantId: string, userId: string | undefined, id: string, markPaid = false) {
    const expense = await this.prisma.expense.findFirst({ where: { tenantId, id, deletedAt: null } });
    if (!expense) throw new BadRequestException('EXPENSE_NOT_FOUND');
    if (expense.status === 'CANCELLED') throw new BadRequestException('EXPENSE_CANCELLED');
    if (expense.status === 'PAID') throw new BadRequestException('EXPENSE_PAID_LOCKED');

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        status: markPaid ? 'PAID' : 'APPROVED',
        approvedBy: userId,
        approvedAt: expense.approvedAt || new Date(),
      } as any,
    });

    if (markPaid) {
      await this.postExpenseJournal(tenantId, updated);
    }

    await this.logExpenseAudit(tenantId, userId, id, 'UPDATE', expense, updated);
    if (!markPaid && updated.status === 'APPROVED') {
      await this.notifyExpenseApproved(tenantId, updated);
    }
    return updated;
  }

  async cancelExpense(tenantId: string, userId: string | undefined, id: string, reason?: string) {
    const expense = await this.prisma.expense.findFirst({ where: { tenantId, id, deletedAt: null } });
    if (!expense) throw new BadRequestException('EXPENSE_NOT_FOUND');
    if (expense.status === 'PAID') throw new BadRequestException('EXPENSE_PAID_REQUIRES_REVERSAL');
    if (expense.status === 'CANCELLED') return expense;

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        settlementStatus: 'NONE',
        description: reason ? `${expense.description || ''}\nLý do hủy: ${reason}`.trim() : expense.description,
      } as any,
    });

    await this.logExpenseAudit(tenantId, userId, id, 'CANCEL', expense, updated);
    return updated;
  }

  async updateExpenseSettlement(tenantId: string, userId: string | undefined, id: string, settlementStatus?: string) {
    const allowed = ['PENDING_REIMBURSEMENT', 'REIMBURSED', 'DEDUCTED_FROM_PROFIT', 'NONE'];
    if (!settlementStatus || !allowed.includes(settlementStatus)) {
      throw new BadRequestException('EXPENSE_SETTLEMENT_STATUS_INVALID');
    }

    const expense = await this.prisma.expense.findFirst({ where: { tenantId, id, deletedAt: null } });
    if (!expense) throw new BadRequestException('EXPENSE_NOT_FOUND');
    if (expense.status === 'CANCELLED') throw new BadRequestException('EXPENSE_CANCELLED');

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        settlementStatus,
        reimbursedAt: settlementStatus === 'REIMBURSED' ? new Date() : expense.reimbursedAt,
      } as any,
    });

    await this.logExpenseAudit(tenantId, userId, id, 'UPDATE', expense, updated);
    return updated;
  }

  async getOwnerProfitSummary(tenantId: string) {
    const owners = await this.prisma.owner.findMany({
      where: { tenantId, isActive: true },
      include: { buildings: { select: { id: true, code: true, name: true } } },
      orderBy: { code: 'asc' },
    });

    return Promise.all(owners.map(async (owner) => {
      const [revenues, postedExpenses, directExpenses, advancedByOwner, owedToOtherOwners] = await Promise.all([
        this.prisma.journalLine.aggregate({
          where: { tenantId, costCenter: { ownerId: owner.id }, account: { type: 'REVENUE' }, type: 'CREDIT' },
          _sum: { amount: true },
        }),
        this.prisma.journalLine.aggregate({
          where: { tenantId, costCenter: { ownerId: owner.id }, account: { type: 'EXPENSE' }, type: 'DEBIT' },
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: { tenantId, ownerId: owner.id, status: { in: ['APPROVED', 'PAID'] as any }, deletedAt: null },
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: { tenantId, paidByOwnerId: owner.id, ownerId: { not: owner.id }, status: { in: ['APPROVED', 'PAID'] as any }, deletedAt: null },
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: { tenantId, ownerId: owner.id, paidByOwnerId: { not: null }, NOT: { paidByOwnerId: owner.id }, status: { in: ['APPROVED', 'PAID'] as any }, deletedAt: null },
          _sum: { amount: true },
        }),
      ]);

      const revenue = Number(revenues._sum.amount || 0);
      const journalExpense = Number(postedExpenses._sum.amount || 0);
      const operationalExpense = Number(directExpenses._sum.amount || 0);
      const expense = Math.max(journalExpense, operationalExpense);
      const advanced = Number(advancedByOwner._sum.amount || 0);
      const payableAdvance = Number(owedToOtherOwners._sum.amount || 0);

      return {
        owner: { id: owner.id, code: owner.code, name: owner.name },
        buildings: owner.buildings,
        revenue,
        expense,
        profitBeforeAdvance: revenue - expense,
        advanceReceivable: advanced,
        advancePayable: payableAdvance,
        profitAfterAdvance: revenue - expense - payableAdvance + advanced,
      };
    }));
  }

  async getOwnerProfitDetail(tenantId: string, ownerId: string, options: { year?: string; month?: string } = {}) {
    const owner = await this.prisma.owner.findFirst({
      where: { tenantId, id: ownerId, isActive: true },
      include: { buildings: { select: { id: true, code: true, name: true }, orderBy: { displayOrder: 'asc' } } },
    });
    if (!owner) throw new BadRequestException('OWNER_NOT_FOUND');

    const period = this.buildPeriodRange(options.year, options.month);
    const ownerWhere = { tenantId, costCenter: { ownerId: owner.id }, createdAt: period };
    const expenseWhere = { tenantId, ownerId: owner.id, deletedAt: null, status: { in: ['APPROVED', 'PAID'] as any }, date: period };

    const [revenues, journalExpenses, directExpenses, advancedByOwner, owedToOtherOwners] = await Promise.all([
      this.prisma.journalLine.aggregate({
        where: { ...ownerWhere, account: { type: 'REVENUE' }, type: 'CREDIT' },
        _sum: { amount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: { ...ownerWhere, account: { type: 'EXPENSE' }, type: 'DEBIT' },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: expenseWhere,
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          tenantId,
          paidByOwnerId: owner.id,
          ownerId: { not: owner.id },
          deletedAt: null,
          status: { in: ['APPROVED', 'PAID'] as any },
          date: period,
        },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          tenantId,
          ownerId: owner.id,
          paidByOwnerId: { not: null },
          NOT: { paidByOwnerId: owner.id },
          deletedAt: null,
          status: { in: ['APPROVED', 'PAID'] as any },
          date: period,
        },
        _sum: { amount: true },
      }),
    ]);

    const ownerBuildingIds = new Set(owner.buildings.map((building) => building.id));
    const buildingBreakdown = (await this.getBuildingProfitSummary(tenantId, options))
      .filter((row) => ownerBuildingIds.has(row.building.id))
      .map((row) => ({
        building: row.building,
        owner: row.owner,
        revenue: row.revenue,
        revenueBreakdown: row.revenueBreakdown,
        roomBreakdown: row.roomBreakdown,
        expense: row.expense,
        profit: row.profit,
        margin: row.margin,
        overdueInvoices: row.overdueInvoices,
        alerts: row.alerts,
      }));

    const expenseRows = await this.getExpenses(tenantId, {
      ownerId: owner.id,
      startDate: period.gte?.toISOString(),
      endDate: period.lte?.toISOString(),
    });

    const selectedYear = Number(options.year || new Date().getFullYear());
    const trend = await Promise.all(Array.from({ length: 12 }, async (_, index) => {
      const range = this.buildPeriodRange(String(selectedYear), String(index + 1));
      const [monthlyRevenue, monthlyExpense] = await Promise.all([
        this.prisma.journalLine.aggregate({
          where: { tenantId, costCenter: { ownerId: owner.id }, account: { type: 'REVENUE' }, type: 'CREDIT', createdAt: range },
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: { tenantId, ownerId: owner.id, deletedAt: null, status: { in: ['APPROVED', 'PAID'] as any }, date: range },
          _sum: { amount: true },
        }),
      ]);
      const revenue = Number(monthlyRevenue._sum.amount || 0);
      const expense = Number(monthlyExpense._sum.amount || 0);
      return {
        month: index + 1,
        revenue,
        expense,
        profit: revenue - expense,
      };
    }));

    const revenue = Number(revenues._sum.amount || 0);
    const expense = Math.max(Number(journalExpenses._sum.amount || 0), Number(directExpenses._sum.amount || 0));
    const advanceReceivable = Number(advancedByOwner._sum.amount || 0);
    const advancePayable = Number(owedToOtherOwners._sum.amount || 0);

    return {
      owner: { id: owner.id, code: owner.code, name: owner.name },
      period: {
        year: selectedYear,
        month: options.month ? Number(options.month) : null,
        startDate: period.gte,
        endDate: period.lte,
      },
      buildings: owner.buildings,
      summary: {
        revenue,
        expense,
        profitBeforeAdvance: revenue - expense,
        advanceReceivable,
        advancePayable,
        profitAfterAdvance: revenue - expense - advancePayable + advanceReceivable,
      },
      buildingBreakdown,
      expenses: expenseRows,
      trend,
    };
  }

  private async resolveCostCenter(tenantId: string, costCenterId?: string, buildingId?: string) {
    if (costCenterId) {
      const costCenter = await this.prisma.costCenter.findFirst({ where: { tenantId, id: costCenterId } });
      if (!costCenter) throw new BadRequestException('COST_CENTER_NOT_FOUND');
      return costCenter;
    }

    if (!buildingId) throw new BadRequestException('COST_CENTER_OR_BUILDING_REQUIRED');
    const building = await this.prisma.building.findFirst({ where: { tenantId, id: buildingId, deletedAt: null } });
    if (!building) throw new BadRequestException('BUILDING_NOT_FOUND');

    const costCenter = await this.prisma.costCenter.findFirst({ where: { tenantId, buildingId } });
    if (costCenter) return costCenter;

    const costCenterByCode = await this.prisma.costCenter.findUnique({
      where: { tenantId_code: { tenantId, code: `CC-${building.code}` } },
    });
    if (costCenterByCode) {
      return this.prisma.costCenter.update({
        where: { id: costCenterByCode.id },
        data: { ownerId: building.ownerId, buildingId },
      });
    }

    return this.prisma.costCenter.create({
      data: {
        tenantId,
        ownerId: building.ownerId,
        buildingId,
        code: `CC-${building.code}`,
        name: `Chi nhánh ${building.code}`,
      },
    });
  }

  private async nextExpenseCode(tenantId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.expense.count({ where: { tenantId, code: { startsWith: `EXP-${year}-` } } });
    return `EXP-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private buildPaymentSourceKey(sourceType: unknown, sourceId: unknown) {
    return `${String(sourceType || '')}:${String(sourceId || '')}`;
  }

  private toAgeHours(value: Date | string | null | undefined, now = Date.now()) {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return null;
    return Math.max(0, Math.round(((now - timestamp) / 36e5) * 10) / 10);
  }

  private buildSePayAuditSourceSnapshot(request: any, source: any) {
    const metadata = (request?.metadata as any) || {};
    const sourceType = String(request?.sourceType || (source?.contractId !== undefined ? 'INVOICE' : 'DEPOSIT'));
    const room = source?.contract?.room || source?.room || null;
    const building = room?.building || null;
    const roomContext = room
      ? buildRoomContext(room, source?.contract || { memberCount: metadata.roomMemberCount })
      : {
          roomCode: metadata.roomCode || null,
          buildingName: metadata.buildingName || null,
          roomRentalTypeLabel: metadata.roomRentalTypeLabel || null,
          roomMemberCount:
            Number.isFinite(Number(metadata.roomMemberCount)) && Number(metadata.roomMemberCount) > 0
              ? Number(metadata.roomMemberCount)
              : null,
        };

    if (sourceType === 'INVOICE') {
      const total = Number(source?.total || request?.amount || 0);
      const paidAmount = Number(source?.paidAmount || 0);
      const creditAmount = Number(source?.creditAmount || 0);
      const remainingAmount = Math.max(0, total - paidAmount - creditAmount);
      const settled = remainingAmount <= 0.01 || source?.status === 'PAID';
      return {
        sourceLabel: 'Invoice',
        sourceCode: source?.code || metadata.sourceCode || null,
        sourceStatus: source?.status || null,
        settled,
        settledAt: settled ? request?.paidAt || request?.updatedAt || null : null,
        remainingAmount,
        actualAmount: paidAmount,
        roomCode: roomContext.roomCode || null,
        buildingName: roomContext.buildingName || building?.name || null,
        roomRentalTypeLabel: roomContext.roomRentalTypeLabel || null,
        roomMemberCount: roomContext.roomMemberCount || null,
        ownerName: building?.owner?.name || request?.owner?.name || null,
      };
    }

    const depositSettledStatuses = new Set(['PAID', 'CONVERTED_TO_CONTRACT']);
    const actualAmount = Number(source?.amount || request?.amount || 0);
    return {
      sourceLabel: 'Deposit',
      sourceCode: source?.code || metadata.sourceCode || null,
      sourceStatus: source?.status || null,
      settled: depositSettledStatuses.has(String(source?.status || '')),
      settledAt: depositSettledStatuses.has(String(source?.status || '')) ? request?.paidAt || request?.updatedAt || null : null,
      remainingAmount: depositSettledStatuses.has(String(source?.status || '')) ? 0 : actualAmount,
      actualAmount,
      roomCode: roomContext.roomCode || null,
      buildingName: roomContext.buildingName || building?.name || null,
      roomRentalTypeLabel: roomContext.roomRentalTypeLabel || null,
      roomMemberCount: roomContext.roomMemberCount || null,
      ownerName: building?.owner?.name || request?.owner?.name || null,
    };
  }

  private buildPeriodRange(year?: string, month?: string) {
    const selectedYear = Number(year || new Date().getFullYear());
    if (!Number.isInteger(selectedYear)) {
      throw new BadRequestException('PERIOD_YEAR_INVALID');
    }

    if (!month) {
      return {
        gte: new Date(selectedYear, 0, 1),
        lte: new Date(selectedYear, 11, 31, 23, 59, 59, 999),
      };
    }

    const selectedMonth = Number(month);
    if (!Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) {
      throw new BadRequestException('PERIOD_MONTH_INVALID');
    }

    return {
      gte: new Date(selectedYear, selectedMonth - 1, 1),
      lte: new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999),
    };
  }

  private resolveWebhookPaymentCode(payload: any) {
    const explicitCode = String(payload?.code || payload?.payment_code || '').trim();
    if (explicitCode) return explicitCode;

    const text = String(payload?.content || payload?.description || '').toUpperCase();
    const match = text.match(/[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+/);
    return match?.[0] || '';
  }

  private resolveWebhookDirection(payload: any): 'IN' | 'OUT' {
    const transferType = String(payload?.transferType || payload?.transfer_type || payload?.type || '').toLowerCase();
    if (['debit', 'out', 'withdraw', 'withdrawal', 'expense'].includes(transferType)) return 'OUT';
    if (Number(payload?.outAmount || payload?.debitAmount || payload?.debit || 0) > 0) return 'OUT';
    return 'IN';
  }

  private resolveWebhookAmount(payload: any) {
    const candidates = [
      payload?.transferAmount,
      payload?.amount,
      payload?.inAmount,
      payload?.creditAmount,
      payload?.credit,
      payload?.outAmount,
      payload?.debitAmount,
      payload?.debit,
    ];
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  private async postExpenseJournal(tenantId: string, expense: any) {
    const existing = await this.prisma.journalEntry.findFirst({
      where: { tenantId, sourceType: 'EXPENSE' as any, sourceId: expense.id, status: 'POSTED' },
    });
    if (existing) return existing;

    const [expenseAccount, bankAccount] = await Promise.all([
      this.prisma.chartOfAccount.findFirst({ where: { tenantId, type: 'EXPENSE', code: '5400' } }),
      this.prisma.chartOfAccount.findFirst({ where: { tenantId, type: 'ASSET', code: '1100' } }),
    ]);
    if (!expenseAccount || !bankAccount) return null;

    const lines = [
      {
        tenantId,
        accountId: expenseAccount.id,
        costCenterId: expense.costCenterId,
        type: 'DEBIT' as any,
        amount: expense.amount,
        description: expense.description,
      },
      {
        tenantId,
        accountId: bankAccount.id,
        costCenterId: expense.costCenterId,
        type: 'CREDIT' as any,
        amount: expense.amount,
        description: expense.description,
      },
    ];
    this.assertBalancedJournalLines(lines);

    return this.prisma.journalEntry.create({
      data: {
        tenantId,
        code: `JE-EXP-${expense.code}`,
        sourceType: 'EXPENSE' as any,
        sourceId: expense.id,
        description: expense.description || `Expense ${expense.code}`,
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: lines,
        },
      },
    });
  }

  private assertBalancedJournalLines(lines: Array<{ type: 'DEBIT' | 'CREDIT'; amount: any }>) {
    const debit = lines
      .filter((line) => line.type === 'DEBIT')
      .reduce((total, line) => total + Number(line.amount || 0), 0);
    const credit = lines
      .filter((line) => line.type === 'CREDIT')
      .reduce((total, line) => total + Number(line.amount || 0), 0);

    if (debit <= 0 || credit <= 0 || Math.abs(debit - credit) > 0.01) {
      throw new BadRequestException('JOURNAL_ENTRY_NOT_BALANCED');
    }
  }

  private async logExpenseAudit(tenantId: string, userId: string | undefined, expenseId: string, action: 'CREATE' | 'UPDATE' | 'CANCEL', before: any, after: any) {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          module: 'Finance',
          entity: 'Expense',
          entityId: expenseId,
          action: action as any,
          before,
          after,
        },
      });
    } catch (error) {
      console.error('Expense audit log failed:', error);
    }
  }

  private async getAdminUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        status: 'ACTIVE' as any,
        deletedAt: null,
        roles: {
          some: {
            role: {
              code: 'ADMIN' as any,
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    });
  }

  private async notifyExpenseCreated(tenantId: string, expense: any) {
    const adminUsers = await this.getAdminUsers(tenantId);
    const expenseCode = expense.code || expense.id;
    const title = `Chi phi moi ${expenseCode}`;
    const message = `Phat sinh chi phi ${expenseCode} so tien ${Number(expense.amount || 0).toLocaleString('vi-VN')} VND. Trang thai hien tai: ${expense.status}.`;

    for (const adminUser of adminUsers) {
      await this.communicationService.dispatch({
        tenantId,
        userId: adminUser.id,
        templateCode: 'SYSTEM_ALERT',
        context: { title, message, expenseId: expense.id, expenseCode },
      });
    }

    if (expense.status === 'PENDING') {
      await this.notifyExpenseApprovalRequested(tenantId, expense, adminUsers);
    }
  }

  private async notifyExpenseApprovalRequested(tenantId: string, expense: any, adminUsers?: Array<{ id: string }>) {
    const recipients = adminUsers || await this.getAdminUsers(tenantId);
    const expenseCode = expense.code || expense.id;
    const title = `Yeu cau duyet chi ${expenseCode}`;
    const message = `Can duyet khoan chi ${expenseCode} so tien ${Number(expense.amount || 0).toLocaleString('vi-VN')} VND truoc khi thanh toan.`;

    for (const adminUser of recipients) {
      await this.communicationService.dispatch({
        tenantId,
        userId: adminUser.id,
        templateCode: 'SYSTEM_ALERT',
        context: { title, message, expenseId: expense.id, expenseCode },
      });
    }
  }

  private async notifyExpenseApproved(tenantId: string, expense: any) {
    const adminUsers = await this.getAdminUsers(tenantId);
    const expenseCode = expense.code || expense.id;
    const title = `Chi phi da duoc duyet ${expenseCode}`;
    const message = `Khoan chi ${expenseCode} da duoc duyet${expense.status === 'PAID' ? ' va danh dau da chi' : ''}.`;

    for (const adminUser of adminUsers) {
      await this.communicationService.dispatch({
        tenantId,
        userId: adminUser.id,
        templateCode: 'SYSTEM_ALERT',
        context: { title, message, expenseId: expense.id, expenseCode },
      });
    }
  }
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
