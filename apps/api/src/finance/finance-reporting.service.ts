import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FinanceReportingService {
  constructor(private readonly prisma: PrismaService) {}

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
        rooms: { where: { deletedAt: null }, select: { id: true, status: true } },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return Promise.all(buildings.map(async (building) => {
      const occupiedRooms = building.rooms.filter((room) => room.status !== 'AVAILABLE').length;
      const [revenues, journalExpenses, directExpenses, overdueInvoices] = await Promise.all([
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
      ]);

      const revenue = Number(revenues._sum.amount || 0);
      const expense = Math.max(Number(journalExpenses._sum.amount || 0), Number(directExpenses._sum.amount || 0));
      const profit = revenue - expense;
      const expenseRatio = revenue > 0 ? (expense / revenue) * 100 : expense > 0 ? 100 : 0;

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
    return this.prisma.owner.findMany({
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

    const rows = logs.map((log) => {
      const payload = log.payload as any;
      const paymentCode = this.resolveWebhookPaymentCode(payload);
      const amount = Number(payload?.transferAmount ?? payload?.amount ?? 0);
      const accountNumber = String(payload?.accountNumber || payload?.account_number || payload?.bank_account_xid || '').trim();
      const transferType = String(payload?.transferType || payload?.transfer_type || '').toLowerCase();
      const request = paymentCode ? requestByCode.get(paymentCode) : null;
      const expectedAmount = request ? Number(request.amount || 0) : 0;
      const amountDiff = request ? amount - expectedAmount : amount;
      const directionInvalid = transferType === 'debit' || transferType === 'out';

      let status = 'UNMATCHED';
      if (directionInvalid) status = 'IGNORED_OUTGOING';
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
        paymentCode,
        amount,
        expectedAmount,
        amountDiff,
        accountNumber,
        transferType,
        sourceType: request?.sourceType || null,
        sourceId: request?.sourceId || null,
        requestStatus: request?.status || null,
        owner: request?.owner || null,
        bankAccount: request?.bankAccount || null,
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
      },
      rows: filteredRows,
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

    const buildingBreakdown = await Promise.all(owner.buildings.map(async (building) => {
      const [buildingRevenue, buildingJournalExpense, buildingDirectExpense] = await Promise.all([
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
      ]);

      const revenue = Number(buildingRevenue._sum.amount || 0);
      const expense = Math.max(Number(buildingJournalExpense._sum.amount || 0), Number(buildingDirectExpense._sum.amount || 0));
      return {
        building,
        revenue,
        expense,
        profit: revenue - expense,
      };
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
}
