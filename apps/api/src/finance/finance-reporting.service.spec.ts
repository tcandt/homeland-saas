import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { FinanceReportingService } from './finance-reporting.service';

describe('FinanceReportingService', () => {
  function createService(prismaOverrides: Record<string, any> = {}) {
    const prisma = {
      expense: {
        findFirst: vi.fn(),
        create: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      journalEntry: {
        findFirst: vi.fn(),
      },
      journalLine: {
        aggregate: vi.fn(),
      },
      contract: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      invoice: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn(),
      },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      building: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      owner: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'admin-1', email: 'adminA@homeland.local', fullName: 'Admin A' },
        ]),
      },
      costCenter: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      paymentRequest: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      bankAccount: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      appSetting: {
        findUnique: vi.fn(),
      },
      ...prismaOverrides,
    };
    const communicationService = {
      dispatch: vi.fn().mockResolvedValue(undefined),
    };

    return {
      prisma,
      communicationService,
      service: new FinanceReportingService(prisma as any, communicationService as any),
    };
  }

  it('creates an expense with owner and audit metadata', async () => {
    const currentYear = new Date().getFullYear();
    const createdExpense = {
      id: 'expense-1',
      tenantId: 'tenant-1',
      ownerId: 'owner-1',
      amount: 250000,
      status: 'PENDING',
      attachmentUrls: ['https://example.test/proof.jpg'],
    };
    const { service, prisma, communicationService } = createService({
      expense: {
        findFirst: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue(createdExpense),
        update: vi.fn(),
      },
      building: {
        findFirst: vi.fn().mockResolvedValue({ id: 'building-1', tenantId: 'tenant-1', ownerId: 'owner-1', code: 'LK01-31' }),
      },
      costCenter: {
        findFirst: vi.fn().mockResolvedValue({ id: 'cost-center-1', ownerId: 'owner-1', buildingId: 'building-1' }),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    });

    await expect(
      service.createExpense('tenant-1', 'user-1', {
        ownerId: 'owner-1',
        buildingId: 'building-1',
        category: 'SUPPLIES',
        amount: 250000,
        description: 'Buy tools',
        attachmentUrls: ['https://example.test/proof.jpg'],
      }),
    ).resolves.toMatchObject(createdExpense);

    expect(prisma.expense.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        code: `EXP-${currentYear}-0001`,
        costCenterId: 'cost-center-1',
        ownerId: 'owner-1',
        buildingId: 'building-1',
        category: 'SUPPLIES',
        amount: 250000,
        status: 'PENDING',
        attachmentUrls: ['https://example.test/proof.jpg'],
      }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'CREATE',
        entity: 'Expense',
        entityId: 'expense-1',
      }),
    }));
    expect(communicationService.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'admin-1',
      templateCode: 'SYSTEM_ALERT',
      context: expect.objectContaining({
        expenseCode: 'EXP-' + currentYear + '-0001',
      }),
    }));
    expect(communicationService.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'admin-1',
      templateCode: 'SYSTEM_ALERT',
      context: expect.objectContaining({
        title: expect.stringContaining('Yeu cau duyet chi'),
      }),
    }));
  });

  it('returns bank usage metadata for owners', async () => {
    const { service } = createService({
      owner: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'owner-1',
            code: 'OWNER_A',
            name: 'Tinh',
            buildings: [{ id: 'building-1', code: 'LK01-31', name: 'LK01-31' }],
            bankAccounts: [
              { id: 'bank-1', bankName: 'ACB', accountNumber: '123', accountName: 'Owner A', isActive: true },
            ],
          },
        ]),
      },
      paymentRequest: {
        findMany: vi.fn().mockResolvedValue([
          { bankAccountId: 'bank-1', status: 'PENDING', createdAt: new Date('2026-08-10T00:00:00.000Z') },
          { bankAccountId: 'bank-1', status: 'CONFIRMED', createdAt: new Date('2026-08-09T00:00:00.000Z') },
        ]),
      },
    });

    await expect(service.getOwners('tenant-1')).resolves.toEqual([
      expect.objectContaining({
        bankAccounts: [
          expect.objectContaining({
            id: 'bank-1',
            usage: expect.objectContaining({
              requestCount: 2,
              pendingCount: 1,
              confirmedCount: 1,
              inUse: true,
              latestRequestAt: new Date('2026-08-10T00:00:00.000Z'),
            }),
          }),
        ],
      }),
    ]);
  });

  it('blocks disabling a bank account that still has pending payment requests', async () => {
    const { service } = createService({
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'bank-1',
          tenantId: 'tenant-1',
          bankName: 'ACB',
          accountNumber: '123',
          isActive: true,
        }),
        update: vi.fn(),
      },
      paymentRequest: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(2),
      },
      appSetting: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(service.updateBankAccountStatus('tenant-1', 'user-1', 'bank-1', false)).rejects.toThrow(
      'BANK_ACCOUNT_HAS_PENDING_PAYMENT_REQUESTS',
    );
  });

  it('blocks disabling a bank account that is currently set as owner default', async () => {
    const { service } = createService({
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'bank-1',
          tenantId: 'tenant-1',
          ownerId: 'owner-1',
          bankName: 'ACB',
          accountNumber: '123',
          isActive: true,
        }),
        update: vi.fn(),
      },
      paymentRequest: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      appSetting: {
        findUnique: vi.fn().mockResolvedValue({
          value: {
            defaults: {
              'owner-1': 'bank-1',
            },
          },
        }),
      },
    });

    await expect(service.updateBankAccountStatus('tenant-1', 'user-1', 'bank-1', false)).rejects.toThrow(
      'BANK_ACCOUNT_IS_DEFAULT_PAYMENT_BANK',
    );
  });

  it('updates bank account status and writes audit log when guard passes', async () => {
    const { service, prisma } = createService({
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'bank-1',
          tenantId: 'tenant-1',
          bankName: 'ACB',
          accountNumber: '123',
          isActive: true,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'bank-1',
          tenantId: 'tenant-1',
          bankName: 'ACB',
          accountNumber: '123',
          isActive: false,
        }),
      },
      paymentRequest: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      appSetting: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(service.updateBankAccountStatus('tenant-1', 'user-1', 'bank-1', false)).resolves.toEqual(
      expect.objectContaining({ id: 'bank-1', isActive: false }),
    );
    expect(prisma.bankAccount.update).toHaveBeenCalledWith({
      where: { id: 'bank-1' },
      data: { isActive: false },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          module: 'Finance',
          entity: 'BankAccount',
          entityId: 'bank-1',
          action: 'UPDATE',
        }),
      }),
    );
  });

  it('summarizes open invoice debt by customer, room, building, and owner', async () => {
    const { service, prisma } = createService({
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'invoice-1',
            tenantId: 'tenant-1',
            customerId: 'customer-1',
            status: 'ISSUED',
            total: 1000000,
            paidAmount: 250000,
            creditAmount: 0,
            dueDate: new Date('2026-01-01T00:00:00.000Z'),
            customer: { id: 'customer-1', fullName: 'Khách A', phone: '0901' },
            contract: {
              room: {
                id: 'room-1',
                code: '31-01',
                name: '31-01',
                building: {
                  id: 'building-1',
                  code: 'LK01-31',
                  name: 'LK01-31',
                  owner: { id: 'owner-1', code: 'TINH', name: 'Tính' },
                },
              },
            },
          },
          {
            id: 'invoice-2',
            tenantId: 'tenant-1',
            customerId: 'customer-1',
            status: 'PARTIALLY_PAID',
            total: 500000,
            paidAmount: 100000,
            creditAmount: 50000,
            dueDate: new Date('2099-01-01T00:00:00.000Z'),
            customer: { id: 'customer-1', fullName: 'Khách A', phone: '0901' },
            contract: {
              room: {
                id: 'room-1',
                code: '31-01',
                name: '31-01',
                building: {
                  id: 'building-1',
                  code: 'LK01-31',
                  name: 'LK01-31',
                  owner: { id: 'owner-1', code: 'TINH', name: 'Tính' },
                },
              },
            },
          },
        ]),
      },
    });

    const summary = await service.getDebtSummary('tenant-1');

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        deletedAt: null,
        status: { notIn: ['PAID', 'CANCELLED', 'WRITTEN_OFF'] },
      }),
    }));
    expect(summary.totals).toMatchObject({
      invoiceCount: 2,
      debt: 1100000,
      overdueDebt: 750000,
    });
    expect(summary.customers[0]).toMatchObject({ id: 'customer-1', debt: 1100000, invoiceCount: 2 });
    expect(summary.rooms[0]).toMatchObject({ id: 'room-1', debt: 1100000, buildingCode: 'LK01-31' });
    expect(summary.buildings[0]).toMatchObject({ id: 'building-1', debt: 1100000, ownerName: 'Tính' });
    expect(summary.owners[0]).toMatchObject({ id: 'owner-1', debt: 1100000, ownerCode: 'TINH' });
  });

  it('approves a pending expense without posting a payment journal', async () => {
    const pendingExpense = {
      id: 'expense-1',
      tenantId: 'tenant-1',
      ownerId: 'owner-1',
      amount: 250000,
      status: 'PENDING',
      deletedAt: null,
      approvedAt: null,
    };
    const approvedExpense = {
      ...pendingExpense,
      status: 'APPROVED',
      approvedBy: 'user-1',
      approvedAt: new Date('2026-08-09T00:00:00.000Z'),
    };
    const { service, prisma, communicationService } = createService({
      expense: {
        findFirst: vi.fn().mockResolvedValue(pendingExpense),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue(approvedExpense),
      },
    });

    await expect(service.approveExpense('tenant-1', 'user-1', 'expense-1', false)).resolves.toMatchObject({
      status: 'APPROVED',
      approvedBy: 'user-1',
    });

    expect(prisma.expense.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'expense-1' },
      data: expect.objectContaining({
        status: 'APPROVED',
        approvedBy: 'user-1',
        approvedAt: expect.any(Date),
      }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'UPDATE',
        entityId: 'expense-1',
      }),
    }));
    expect(communicationService.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'admin-1',
      templateCode: 'SYSTEM_ALERT',
      context: expect.objectContaining({
        title: expect.stringContaining('Chi phi da duoc duyet'),
      }),
    }));
  });

  it('locks expense amount after a posted journal exists', async () => {
    const { service, prisma } = createService({
      expense: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'expense-1',
          tenantId: 'tenant-1',
          ownerId: 'owner-1',
          amount: 100000,
          status: 'PAID',
          deletedAt: null,
          attachmentUrls: [],
          date: new Date('2026-08-01T00:00:00.000Z'),
        }),
        update: vi.fn(),
      },
      journalEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: 'journal-1', status: 'POSTED' }),
      },
    });

    await expect(
      service.updateExpense('tenant-1', 'user-1', 'expense-1', { amount: 120000 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.expense.update).not.toHaveBeenCalled();
  });

  it('allows non-amount expense edits after posting when amount is unchanged', async () => {
    const existingExpense = {
      id: 'expense-1',
      tenantId: 'tenant-1',
      ownerId: 'owner-1',
      buildingId: 'building-1',
      roomId: null,
      paidByOwnerId: null,
      paidByName: null,
      category: 'OTHER',
      vendor: null,
      amount: 100000,
      status: 'PAID',
      deletedAt: null,
      description: 'Old note',
      attachmentUrls: [],
      date: new Date('2026-08-01T00:00:00.000Z'),
    };
    const updatedExpense = { ...existingExpense, description: 'Updated note' };
    const { service, prisma } = createService({
      expense: {
        findFirst: vi.fn().mockResolvedValue(existingExpense),
        update: vi.fn().mockResolvedValue(updatedExpense),
      },
      journalEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: 'journal-1', status: 'POSTED' }),
      },
    });

    await expect(
      service.updateExpense('tenant-1', 'user-1', 'expense-1', {
        amount: 100000,
        description: 'Updated note',
      }),
    ).resolves.toMatchObject({ description: 'Updated note' });

    expect(prisma.expense.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'expense-1' },
      data: expect.objectContaining({
        amount: 100000,
        description: 'Updated note',
      }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'UPDATE',
        entity: 'Expense',
        entityId: 'expense-1',
      }),
    }));
  });

  it('returns building revenue breakdown for rent, electricity, and water-service', async () => {
    const { service, prisma } = createService({
      building: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'building-1',
            code: 'LK01-31',
            name: 'LK01-31',
            owner: { id: 'owner-1', code: 'TINH', name: 'Tinh' },
            rooms: [
              { id: 'room-1', status: 'RENTED' },
              { id: 'room-2', status: 'AVAILABLE' },
            ],
          },
        ]),
      },
      journalLine: {
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 2500000 } })
          .mockResolvedValueOnce({ _sum: { amount: 600000 } }),
      },
      contract: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'contract-1',
            roomId: 'room-1',
            code: 'HD-31-01',
            status: 'ACTIVE',
            startDate: new Date('2026-08-01T00:00:00.000Z'),
            endDate: new Date('2027-07-31T00:00:00.000Z'),
            monthlyRent: 1800000,
            customer: { id: 'customer-1', fullName: 'Khach A', phone: '0901' },
          },
        ]),
      },
      expense: {
        findFirst: vi.fn(),
        create: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 500000 } }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'expense-room-1',
            roomId: 'room-1',
            code: 'EXP-ROOM-1',
            status: 'PAID',
            category: 'REPAIR',
            amount: 120000,
            settlementStatus: 'REIMBURSED',
            description: 'Repair lamp',
            paidByOwner: { id: 'owner-1', name: 'Tinh' },
            paidByName: null,
          },
        ]),
      },
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'invoice-1',
            contractId: 'contract-1',
            code: 'INV-31-01',
            status: 'ISSUED',
            dueDate: new Date('2026-08-31T00:00:00.000Z'),
            total: 2500000,
            paidAmount: 500000,
            creditAmount: 0,
            customer: { id: 'customer-1', fullName: 'Khach A' },
            contract: { roomId: 'room-1' },
          },
        ]),
        count: vi.fn().mockResolvedValue(2),
      },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            type: 'RENT',
            amount: 1800000,
            invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
          },
          {
            type: 'UTILITY_ELECTRICITY',
            amount: 350000,
            invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
          },
          {
            type: 'UTILITY_WATER',
            amount: 150000,
            invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
          },
          {
            type: 'SERVICE',
            amount: 120000,
            invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
          },
          {
            type: 'OTHER',
            amount: 80000,
            invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
          },
        ]),
      },
    });

    const summary = await service.getBuildingProfitSummary('tenant-1', { year: '2026', month: '8' });

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      revenue: 2500000,
      expense: 600000,
      profit: 1900000,
      overdueInvoices: 2,
      revenueBreakdown: {
        rent: 1800000,
        electricity: 350000,
        waterAndService: 270000,
        other: 80000,
      },
    });
    expect(summary[0].roomBreakdown).toHaveLength(2);
    expect(summary[0].roomBreakdown[0]).toMatchObject({
      room: { id: 'room-1', status: 'RENTED' },
      revenue: 2500000,
      revenueBreakdown: {
        rent: 1800000,
        electricity: 350000,
        waterAndService: 270000,
        other: 80000,
      },
      contracts: [
        expect.objectContaining({
          code: 'HD-31-01',
          status: 'ACTIVE',
        }),
      ],
      invoices: [
        expect.objectContaining({
          code: 'INV-31-01',
          remainingAmount: 2000000,
        }),
      ],
      expenses: [
        expect.objectContaining({
          code: 'EXP-ROOM-1',
          amount: 120000,
        }),
      ],
    });
    expect(summary[0].roomBreakdown[1]).toMatchObject({
      room: { id: 'room-2', status: 'AVAILABLE' },
      revenue: 0,
    });
    expect(prisma.invoiceItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
      }),
    }));
  });

  it('summarizes profit by owner including advances between owners', async () => {
    const { service, prisma } = createService({
      owner: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'owner-1',
            code: 'TINH',
            name: 'Tinh',
            buildings: [
              { id: 'building-1', code: 'LK01-31', name: 'LK01-31' },
              { id: 'building-2', code: 'LK08-25', name: 'LK08-25' },
            ],
          },
          {
            id: 'owner-2',
            code: 'THE',
            name: 'The',
            buildings: [{ id: 'building-3', code: 'LK01-32', name: 'LK01-32' }],
          },
        ]),
      },
      journalLine: {
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 12000000 } })
          .mockResolvedValueOnce({ _sum: { amount: 2500000 } })
          .mockResolvedValueOnce({ _sum: { amount: 8000000 } })
          .mockResolvedValueOnce({ _sum: { amount: 1000000 } }),
      },
      expense: {
        findFirst: vi.fn(),
        create: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 2800000 } })
          .mockResolvedValueOnce({ _sum: { amount: 500000 } })
          .mockResolvedValueOnce({ _sum: { amount: 300000 } })
          .mockResolvedValueOnce({ _sum: { amount: 900000 } })
          .mockResolvedValueOnce({ _sum: { amount: 1300000 } })
          .mockResolvedValueOnce({ _sum: { amount: 200000 } }),
      },
    });

    const summary = await service.getOwnerProfitSummary('tenant-1');

    expect(prisma.owner.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', isActive: true },
      include: { buildings: { select: { id: true, code: true, name: true } } },
      orderBy: { code: 'asc' },
    });
    expect(summary).toHaveLength(2);
    expect(summary[0]).toMatchObject({
      owner: { id: 'owner-1', code: 'TINH', name: 'Tinh' },
      revenue: 12000000,
      expense: 2800000,
      profitBeforeAdvance: 9200000,
      advanceReceivable: 500000,
      advancePayable: 300000,
      profitAfterAdvance: 9400000,
      buildings: [
        { id: 'building-1', code: 'LK01-31', name: 'LK01-31' },
        { id: 'building-2', code: 'LK08-25', name: 'LK08-25' },
      ],
    });
    expect(summary[1]).toMatchObject({
      owner: { id: 'owner-2', code: 'THE', name: 'The' },
      revenue: 8000000,
      expense: 1000000,
      profitBeforeAdvance: 7000000,
      advanceReceivable: 1300000,
      advancePayable: 200000,
      profitAfterAdvance: 8100000,
      buildings: [{ id: 'building-3', code: 'LK01-32', name: 'LK01-32' }],
    });
  });

  it('returns owner detail with electricity revenue attached to building and room breakdown', async () => {
    const journalAggregate = vi.fn().mockResolvedValue({ _sum: { amount: 0 } });
    journalAggregate
      .mockResolvedValueOnce({ _sum: { amount: 2500000 } })
      .mockResolvedValueOnce({ _sum: { amount: 0 } })
      .mockResolvedValueOnce({ _sum: { amount: 2500000 } })
      .mockResolvedValueOnce({ _sum: { amount: 600000 } })
      .mockResolvedValueOnce({ _sum: { amount: 999999 } })
      .mockResolvedValueOnce({ _sum: { amount: 500000 } });

    const expenseAggregate = vi.fn().mockResolvedValue({ _sum: { amount: 0 } });
    expenseAggregate
      .mockResolvedValueOnce({ _sum: { amount: 500000 } })
      .mockResolvedValueOnce({ _sum: { amount: 0 } })
      .mockResolvedValueOnce({ _sum: { amount: 0 } })
      .mockResolvedValueOnce({ _sum: { amount: 500000 } })
      .mockResolvedValueOnce({ _sum: { amount: 100000 } });

    const { service } = createService({
      owner: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'owner-1',
          code: 'TINH',
          name: 'Tinh',
          buildings: [{ id: 'building-1', code: 'LK01-31', name: 'LK01-31' }],
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      building: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'building-1',
            code: 'LK01-31',
            name: 'LK01-31',
            owner: { id: 'owner-1', code: 'TINH', name: 'Tinh' },
            rooms: [
              { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' },
              { id: 'room-2', code: '31-02', name: '31-02', status: 'AVAILABLE' },
            ],
          },
          {
            id: 'building-2',
            code: 'LK01-32',
            name: 'LK01-32',
            owner: { id: 'owner-2', code: 'THE', name: 'The' },
            rooms: [{ id: 'room-3', code: '32-01', name: 'Van phong', status: 'RENTED' }],
          },
        ]),
      },
      journalLine: {
        aggregate: journalAggregate,
      },
      expense: {
        findFirst: vi.fn(),
        create: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn(),
        aggregate: expenseAggregate,
        findMany: vi.fn().mockResolvedValue([]),
      },
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'invoice-1',
            contractId: 'contract-1',
            code: 'INV-31-01',
            status: 'ISSUED',
            dueDate: new Date('2026-08-31T00:00:00.000Z'),
            total: 2500000,
            paidAmount: 0,
            creditAmount: 0,
            customer: { id: 'customer-1', fullName: 'Khach A' },
            contract: { roomId: 'room-1' },
          },
        ]),
        count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
      },
      invoiceItem: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              type: 'RENT',
              amount: 1800000,
              invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
            },
            {
              type: 'UTILITY_ELECTRICITY',
              amount: 350000,
              invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
            },
            {
              type: 'UTILITY_WATER',
              amount: 150000,
              invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
            },
            {
              type: 'SERVICE',
              amount: 120000,
              invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
            },
            {
              type: 'OTHER',
              amount: 80000,
              invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
            },
          ])
          .mockResolvedValueOnce([]),
      },
      contract: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'contract-1',
              roomId: 'room-1',
              code: 'HD-31-01',
              status: 'ACTIVE',
              startDate: new Date('2026-08-01T00:00:00.000Z'),
              endDate: new Date('2027-07-31T00:00:00.000Z'),
              monthlyRent: 1800000,
              customer: { id: 'customer-1', fullName: 'Khach A', phone: '0901' },
            },
          ])
          .mockResolvedValueOnce([]),
      },
    });

    const detail = await service.getOwnerProfitDetail('tenant-1', 'owner-1', { year: '2026', month: '8' });

    expect(detail.owner).toMatchObject({ id: 'owner-1', code: 'TINH', name: 'Tinh' });
    expect(detail.buildingBreakdown).toHaveLength(1);
    expect(detail.buildingBreakdown[0]).toMatchObject({
      building: { id: 'building-1', code: 'LK01-31' },
      revenue: 2500000,
      expense: 600000,
      profit: 1900000,
      revenueBreakdown: {
        rent: 1800000,
        electricity: 350000,
        waterAndService: 270000,
        other: 80000,
      },
      overdueInvoices: 1,
    });
    expect(detail.buildingBreakdown[0].roomBreakdown[0]).toMatchObject({
      room: { id: 'room-1', code: '31-01' },
      revenue: 2500000,
      revenueBreakdown: {
        rent: 1800000,
        electricity: 350000,
        waterAndService: 270000,
        other: 80000,
      },
    });
  });
});
