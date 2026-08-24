import { UnauthorizedException } from '@nestjs/common';
import { PaymentProvider, PaymentRequestStatus, PaymentSourceType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  function createService(prismaOverrides: Record<string, any> = {}) {
    const basePrisma = {
      appSetting: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn(),
      },
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      paymentRequest: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      task: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      creditNote: {
        create: vi.fn(),
      },
      journalEntry: {
        findFirst: vi.fn(),
      },
      chartOfAccount: {
        findFirst: vi.fn(),
      },
      bankAccount: {
        findFirst: vi.fn(),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'system-admin', email: 'admin@homeland.vn', role: 'ADMIN' },
        ]),
      },
      invoice: {
        findFirst: vi.fn(),
      },
      deposit: {
        findFirst: vi.fn(),
      },
    };
    const prisma = Object.fromEntries(
      Object.entries(basePrisma).map(([key, value]) => [
        key,
        typeof value === 'object' && value !== null && typeof prismaOverrides[key] === 'object'
          ? { ...value, ...prismaOverrides[key] }
          : (prismaOverrides[key] ?? value),
      ]),
    );

    const invoicesService = {
      getDetail: vi.fn(),
      pay: vi.fn(),
    };
    const depositsService = {
      getDetail: vi.fn(),
      collect: vi.fn(),
    };
    const communicationService = {
      dispatchDirect: vi.fn(),
      dispatch: vi.fn(),
    };
    const journalEntryService = {
      createJournalEntry: vi.fn(),
    };
    const auditService = {
      log: vi.fn(),
    };

    return {
      prisma,
      invoicesService,
      depositsService,
      communicationService,
      journalEntryService,
      auditService,
      service: new PaymentsService(
        prisma as any,
        invoicesService as any,
        depositsService as any,
        communicationService as any,
        journalEntryService as any,
        auditService as any,
      ),
    };
  }

  it('rejects SePay webhooks when no DB-backed API key is configured', async () => {
    const { service } = createService();

    await expect(service.handleSePayWebhook({ id: 'txn-1' }, 'Apikey anything')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('ignores concurrent duplicate SePay webhooks for the same transaction id in the same API process', async () => {
    let releaseUpsert!: (value: any) => void;
    const upsertPromise = new Promise((resolve) => {
      releaseUpsert = resolve;
    });
    const { service, prisma } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ value: { webhookApiKey: 'db-key' } }]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn().mockReturnValue(upsertPromise),
        update: vi.fn(),
      },
      paymentRequest: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
    });

    const first = service.handleSePayWebhook({
      id: 'txn-concurrent',
      code: 'PAY-TENANT-ABC-XYZ',
      transferType: 'in',
      transferAmount: 100000,
    }, 'Apikey db-key');
    const second = await service.handleSePayWebhook({
      id: 'txn-concurrent',
      code: 'PAY-TENANT-ABC-XYZ',
      transferType: 'in',
      transferAmount: 100000,
    }, 'Apikey db-key');

    expect(second).toEqual({ success: true });
    expect(prisma.paymentWebhookLog.upsert).toHaveBeenCalledTimes(1);

    releaseUpsert({ id: 'log-1', processedAt: null });
    await first;
  });

  it('matches pending payment request by payment code and bank account number', async () => {
    const { service, prisma, invoicesService, auditService, communicationService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ value: { webhookApiKey: 'db-key' } }]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn().mockResolvedValue({ id: 'log-1', processedAt: null }),
        update: vi.fn(),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-1',
          tenantId: 'tenant-1',
          sourceType: PaymentSourceType.INVOICE,
          sourceId: 'invoice-1',
          status: PaymentRequestStatus.PENDING,
          amount: 100000,
        }),
        update: vi.fn(),
      },
    });
    invoicesService.pay.mockResolvedValue({ id: 'invoice-1' });

    await service.handleSePayWebhook({
      id: 'txn-1',
      code: 'PAY-TENANT-ABC-XYZ',
      transferType: 'in',
      transferAmount: 100000,
      accountNumber: '123456789',
    }, 'Apikey db-key');

    expect(prisma.paymentRequest.findFirst).toHaveBeenCalledWith({
      where: {
        provider: PaymentProvider.SEPAY,
        paymentCode: 'PAY-TENANT-ABC-XYZ',
        bankAccountNumber: '123456789',
      },
    });
    expect(invoicesService.pay).toHaveBeenCalledWith('invoice-1', 100000, 'SEPAY', 'txn-1', 'SEPAY_WEBHOOK');
    expect(prisma.paymentRequest.update).toHaveBeenCalledWith({
      where: { id: 'request-1' },
      data: expect.objectContaining({
        status: PaymentRequestStatus.CONFIRMED,
        providerTransactionId: 'txn-1',
        paidAt: expect.any(Date),
      }),
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'Payments',
        entity: 'PaymentRequest',
        entityId: 'request-1',
        tenantId: 'tenant-1',
        userId: 'SEPAY_WEBHOOK',
      }),
    );
  });

  it('creates invoice payment requests with the owner bank account', async () => {
    const bankAccount = {
      id: 'bank-owner-a',
      ownerId: 'owner-a',
      bankName: 'ACB',
      accountNumber: '123456789',
      accountName: 'Owner A',
      isActive: true,
      createdAt: new Date('2026-08-09T00:00:00.000Z'),
    };
    const { service, prisma, invoicesService, auditService, communicationService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ value: { paymentCodePrefix: 'INV' } }),
      },
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue(bankAccount),
      },
      paymentRequest: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 'request-1',
          ...data,
          status: PaymentRequestStatus.PENDING,
          provider: PaymentProvider.SEPAY,
          createdAt: new Date('2026-08-09T00:00:00.000Z'),
          updatedAt: new Date('2026-08-09T00:00:00.000Z'),
        })),
      },
    });
    invoicesService.getDetail.mockResolvedValue({
      id: 'invoice-1',
      tenantId: 'tenant-1',
      code: 'INV-001',
      total: 500000,
      paidAmount: 100000,
      creditAmount: 50000,
      customerId: 'customer-1',
      contract: {
        roomId: 'room-1',
        room: {
          buildingId: 'building-1',
          building: { ownerId: 'owner-a' },
        },
      },
    });

    const request = await service.createInvoiceRequest('invoice-1', 'user-1');

    expect(prisma.bankAccount.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', isActive: true, ownerId: 'owner-a' },
      orderBy: { createdAt: 'asc' },
    });
    expect(prisma.paymentRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        ownerId: 'owner-a',
        buildingId: 'building-1',
        roomId: 'room-1',
        bankAccountId: 'bank-owner-a',
        sourceType: PaymentSourceType.INVOICE,
        sourceId: 'invoice-1',
        amount: 350000,
        bankName: 'ACB',
        bankAccountNumber: '123456789',
      }),
    });
    expect(request).toMatchObject({
      id: 'request-1',
      amount: 350000,
      bankAccountNumber: '123456789',
    });
  });

  it('does not confirm SePay webhooks when the transfer amount is short', async () => {
    const { service, prisma, invoicesService, auditService, communicationService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ value: { webhookApiKey: 'db-key' } }]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn().mockResolvedValue({ id: 'log-1', processedAt: null }),
        update: vi.fn(),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-1',
          tenantId: 'tenant-1',
          sourceType: PaymentSourceType.INVOICE,
          sourceId: 'invoice-1',
          status: PaymentRequestStatus.PENDING,
          amount: 100000,
        }),
        update: vi.fn(),
        create: vi.fn(),
      },
    });

    await service.handleSePayWebhook({
      id: 'txn-short',
      code: 'PAY-TENANT-ABC-XYZ',
      transferType: 'in',
      transferAmount: 90000,
    }, 'Apikey db-key');

    expect(invoicesService.pay).not.toHaveBeenCalled();
    expect(communicationService.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'system-admin',
        templateCode: 'SYSTEM_ALERT',
        channel: 'IN_APP',
        context: expect.objectContaining({
          paymentCode: 'PAY-TENANT-ABC-XYZ',
          expectedAmount: 100000,
          actualAmount: 90000,
        }),
      }),
    );
    expect(prisma.paymentRequest.update).not.toHaveBeenCalled();
    expect(prisma.paymentWebhookLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: expect.objectContaining({
        status: 'NEEDS_REVIEW',
        tenantId: 'tenant-1',
        processedAt: expect.any(Date),
      }),
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'Payments',
        entity: 'SePayWebhookMismatch',
        entityId: 'log-1',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('confirms SePay webhooks with overpayment using the requested amount', async () => {
    const { service, prisma, invoicesService, auditService, communicationService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ value: { webhookApiKey: 'db-key' } }]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn().mockResolvedValue({ id: 'log-1', processedAt: null }),
        update: vi.fn(),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-1',
          tenantId: 'tenant-1',
          sourceType: PaymentSourceType.INVOICE,
          sourceId: 'invoice-1',
          status: PaymentRequestStatus.PENDING,
          amount: 100000,
        }),
        update: vi.fn(),
        create: vi.fn(),
      },
    });
    invoicesService.pay.mockResolvedValue({ id: 'invoice-1' });

    await service.handleSePayWebhook({
      id: 'txn-over',
      code: 'PAY-TENANT-ABC-XYZ',
      transferType: 'in',
      transferAmount: 120000,
    }, 'Apikey db-key');

    expect(invoicesService.pay).toHaveBeenCalledWith('invoice-1', 100000, 'SEPAY', 'txn-over', 'SEPAY_WEBHOOK');
    expect(communicationService.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'system-admin',
        templateCode: 'SYSTEM_ALERT',
        channel: 'IN_APP',
        context: expect.objectContaining({
          paymentCode: 'PAY-TENANT-ABC-XYZ',
          expectedAmount: 100000,
          actualAmount: 120000,
        }),
      }),
    );
    expect(prisma.paymentRequest.update).toHaveBeenCalledWith({
      where: { id: 'request-1' },
      data: expect.objectContaining({
        status: PaymentRequestStatus.CONFIRMED,
        providerTransactionId: 'txn-over',
      }),
    });
  });

  it('ignores SePay webhooks with no payment code content', async () => {
    const { service, prisma, invoicesService, auditService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ value: { webhookApiKey: 'db-key' } }]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn().mockResolvedValue({ id: 'log-1', processedAt: null }),
        update: vi.fn(),
      },
      paymentRequest: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
    });

    await service.handleSePayWebhook({
      id: 'txn-wrong-content',
      content: 'NO MATCHING CODE',
      transferType: 'in',
      transferAmount: 100000,
    }, 'Apikey db-key');

    expect(prisma.paymentRequest.findFirst).not.toHaveBeenCalled();
    expect(invoicesService.pay).not.toHaveBeenCalled();
    expect(prisma.paymentWebhookLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: expect.objectContaining({
        status: 'IGNORED',
        processedAt: expect.any(Date),
      }),
    });
  });

  it('alerts when SePay webhook lands on the wrong bank account for a pending request', async () => {
    const { service, prisma, invoicesService, communicationService, auditService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ value: { webhookApiKey: 'db-key' } }]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn().mockResolvedValue({ id: 'log-1', processedAt: null }),
        update: vi.fn(),
      },
      paymentRequest: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'request-1',
            tenantId: 'tenant-1',
            sourceType: PaymentSourceType.INVOICE,
            sourceId: 'invoice-1',
            status: PaymentRequestStatus.PENDING,
            amount: 100000,
            bankAccountNumber: '123456789',
          }),
        update: vi.fn(),
        create: vi.fn(),
      },
    });

    await service.handleSePayWebhook({
      id: 'txn-bank-mismatch',
      code: 'PAY-TENANT-ABC-XYZ',
      transferType: 'in',
      transferAmount: 100000,
      accountNumber: '999888777',
    }, 'Apikey db-key');

    expect(invoicesService.pay).not.toHaveBeenCalled();
    expect(communicationService.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'system-admin',
        templateCode: 'SYSTEM_ALERT',
        channel: 'IN_APP',
        context: expect.objectContaining({
          paymentCode: 'PAY-TENANT-ABC-XYZ',
          expectedBankAccount: '123456789',
          actualBankAccount: '999888777',
        }),
      }),
    );
    expect(prisma.paymentWebhookLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: expect.objectContaining({
        status: 'NEEDS_REVIEW',
        tenantId: 'tenant-1',
        processedAt: expect.any(Date),
      }),
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'Payments',
        entity: 'SePayWebhookMismatch',
        entityId: 'log-1',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('audits when sending invoice payment request to Zalo', async () => {
    const bankAccount = {
      id: 'bank-owner-a',
      ownerId: 'owner-a',
      bankName: 'ACB',
      accountNumber: '123456789',
      accountName: 'Owner A',
      isActive: true,
      createdAt: new Date('2026-08-09T00:00:00.000Z'),
    };
    const { service, invoicesService, communicationService, auditService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ value: { paymentCodePrefix: 'INV' } }),
      },
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue(bankAccount),
      },
      paymentRequest: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 'request-zalo-1',
          ...data,
          status: PaymentRequestStatus.PENDING,
          provider: PaymentProvider.SEPAY,
          createdAt: new Date('2026-08-09T00:00:00.000Z'),
          updatedAt: new Date('2026-08-09T00:00:00.000Z'),
        })),
      },
    });
    invoicesService.getDetail
      .mockResolvedValueOnce({
        id: 'invoice-1',
        tenantId: 'tenant-1',
        code: 'INV-001',
        total: 500000,
        paidAmount: 100000,
        customerId: 'customer-1',
        customer: { fullName: 'Khach A', phone: '0901000001', zaloChatId: 'zalo-chat-1' },
        contract: {
          roomId: 'room-1',
          room: {
            buildingId: 'building-1',
            building: { ownerId: 'owner-a' },
          },
        },
      })
      .mockResolvedValueOnce({
        id: 'invoice-1',
        tenantId: 'tenant-1',
        code: 'INV-001',
        customerId: 'customer-1',
        total: 500000,
        paidAmount: 100000,
        customer: { fullName: 'Khach A', phone: '0901000001', zaloChatId: 'zalo-chat-1' },
        contract: {
          roomId: 'room-1',
          room: {
            buildingId: 'building-1',
            building: { ownerId: 'owner-a' },
          },
        },
      });

    await service.sendInvoiceRequestToZalo('invoice-1', 'user-1');

    expect(communicationService.dispatchDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        channel: 'ZALO',
        recipient: 'zalo-chat-1',
        context: expect.objectContaining({
          customerPhone: '0901000001',
          zaloChatId: 'zalo-chat-1',
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'Payments',
        entity: 'PaymentRequestDispatch',
        entityId: 'request-zalo-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    );
  });

  it('requires Zalo chat or user id before sending invoice payment request', async () => {
    const bankAccount = {
      id: 'bank-owner-a',
      ownerId: 'owner-a',
      bankName: 'ACB',
      accountNumber: '123456789',
      accountName: 'Owner A',
      isActive: true,
      createdAt: new Date('2026-08-09T00:00:00.000Z'),
    };
    const { service, invoicesService, communicationService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ value: { paymentCodePrefix: 'INV' } }),
      },
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue(bankAccount),
      },
      paymentRequest: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 'request-zalo-2',
          ...data,
          status: PaymentRequestStatus.PENDING,
          provider: PaymentProvider.SEPAY,
          createdAt: new Date('2026-08-09T00:00:00.000Z'),
          updatedAt: new Date('2026-08-09T00:00:00.000Z'),
        })),
      },
    });
    invoicesService.getDetail
      .mockResolvedValueOnce({
        id: 'invoice-1',
        tenantId: 'tenant-1',
        code: 'INV-001',
        total: 500000,
        paidAmount: 100000,
        customerId: 'customer-1',
        customer: { fullName: 'Khach A', phone: '0901000001' },
        contract: {
          roomId: 'room-1',
          room: {
            buildingId: 'building-1',
            building: { ownerId: 'owner-a' },
          },
        },
      })
      .mockResolvedValueOnce({
        id: 'invoice-1',
        tenantId: 'tenant-1',
        code: 'INV-001',
        customerId: 'customer-1',
        customer: { fullName: 'Khach A', phone: '0901000001' },
      });

    await expect(service.sendInvoiceRequestToZalo('invoice-1', 'user-1')).rejects.toThrow(
      'Khách thuê chưa có Zalo chat ID hoặc user ID',
    );
    expect(communicationService.dispatchDirect).not.toHaveBeenCalled();
  });

  it('manually assigns a SePay transaction to an invoice by invoice code', async () => {
    const { service, prisma, invoicesService, auditService } = createService({
      paymentWebhookLog: {
        upsert: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'log-1',
          payload: {
            id: 'txn-manual-1',
            code: 'PAY-TENANT-MANUAL-001',
            transferType: 'in',
            transferAmount: 90000,
            accountNumber: '123456789',
            gateway: 'ACB',
          },
        }),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'request-1',
          tenantId: 'tenant-1',
          paymentCode: 'PAY-TENANT-MANUAL-001',
        }),
        update: vi.fn(),
      },
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'bank-1',
          bankName: 'ACB',
          accountNumber: '123456789',
          accountName: 'Owner A',
        }),
      },
      invoice: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'invoice-1',
          tenantId: 'tenant-1',
          code: 'INV-001',
          total: 150000,
          paidAmount: 50000,
          creditAmount: 10000,
          contract: {
            roomId: 'room-1',
            room: {
              buildingId: 'building-1',
              building: { ownerId: 'owner-a' },
            },
          },
        }),
      },
    });
    invoicesService.pay.mockResolvedValue({ id: 'invoice-1' });

    await expect(
      service.manualAssignSePayTransaction('tenant-1', 'user-1', {
        logId: 'log-1',
        sourceType: PaymentSourceType.INVOICE,
        sourceCode: 'INV-001',
      }),
    ).resolves.toMatchObject({
      success: true,
      paymentCode: 'PAY-TENANT-MANUAL-001',
      amount: 90000,
    });

    expect(prisma.paymentRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        sourceType: PaymentSourceType.INVOICE,
        sourceId: 'invoice-1',
        paymentCode: 'PAY-TENANT-MANUAL-001',
        amount: 90000,
        bankAccountNumber: '123456789',
      }),
    });
    expect(invoicesService.pay).toHaveBeenCalledWith('invoice-1', 90000, 'SEPAY', 'txn-manual-1', 'user-1');
    expect(prisma.paymentWebhookLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: expect.objectContaining({
        status: 'PROCESSED',
        tenantId: 'tenant-1',
        processedAt: expect.any(Date),
      }),
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'Payments',
        entity: 'SePayManualAssignment',
        entityId: 'log-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    );
  });

  it('rejects manual deposit assignment when transferred amount does not equal deposit amount', async () => {
    const { service } = createService({
      paymentWebhookLog: {
        upsert: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'log-1',
          payload: {
            id: 'txn-manual-2',
            code: 'PAY-TENANT-MANUAL-002',
            transferType: 'in',
            transferAmount: 50000,
          },
        }),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
      deposit: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'deposit-1',
          tenantId: 'tenant-1',
          code: 'DEP-001',
          amount: 80000,
          roomId: 'room-1',
          room: {
            buildingId: 'building-1',
            building: { ownerId: 'owner-a' },
          },
        }),
      },
    });

    await expect(
      service.manualAssignSePayTransaction('tenant-1', 'user-1', {
        logId: 'log-1',
        sourceType: PaymentSourceType.DEPOSIT,
        sourceCode: 'DEP-001',
      }),
    ).rejects.toThrow('Số tiền giao dịch phải đúng bằng tiền cọc');
  });

  it('resolves invoice overpayment into customer credit balance', async () => {
    const { service, prisma, journalEntryService, auditService } = createService({
      paymentWebhookLog: {
        upsert: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'log-over-1',
          tenantId: 'tenant-1',
          payload: {
            id: 'txn-over-1',
            code: 'PAY-TENANT-OVER-001',
            transferType: 'in',
            transferAmount: 120000,
          },
        }),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-over-1',
          tenantId: 'tenant-1',
          sourceType: PaymentSourceType.INVOICE,
          sourceId: 'invoice-1',
          paymentCode: 'PAY-TENANT-OVER-001',
          amount: 100000,
          metadata: {},
        }),
        update: vi.fn(),
        create: vi.fn(),
      },
      invoice: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'invoice-1',
          customerId: 'customer-1',
          code: 'INV-001',
        }),
      },
      creditNote: {
        create: vi.fn().mockResolvedValue({
          id: 'credit-note-1',
        }),
      },
      journalEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      chartOfAccount: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
          .mockResolvedValueOnce({ id: 'liability-account', code: '1300' }),
      },
    });

    await expect(
      service.resolveSePayOverpayment('tenant-1', 'user-1', {
        logId: 'log-over-1',
        resolution: 'CREDIT_BALANCE',
      }),
    ).resolves.toMatchObject({
      success: true,
      paymentCode: 'PAY-TENANT-OVER-001',
      resolution: 'CREDIT_BALANCE',
      overpaidAmount: 20000,
    });

    expect(prisma.creditNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        customerId: 'customer-1',
        sourceInvoiceId: 'invoice-1',
        amount: 20000,
        remainingAmount: 20000,
      }),
    });
    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        sourceType: 'ADJUSTMENT',
        sourceId: 'credit-note-1',
        lines: [
          expect.objectContaining({ accountId: 'bank-account', type: 'DEBIT', amount: 20000 }),
          expect.objectContaining({ accountId: 'liability-account', type: 'CREDIT', amount: 20000 }),
        ],
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'Payments',
        entity: 'SePayOverpaymentResolution',
        entityId: 'request-over-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    );
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('resolves overpayment into refund pending task', async () => {
    const { service, prisma, auditService } = createService({
      paymentWebhookLog: {
        upsert: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'log-over-2',
          tenantId: 'tenant-1',
          payload: {
            id: 'txn-over-2',
            code: 'PAY-TENANT-OVER-002',
            transferType: 'in',
            transferAmount: 150000,
          },
        }),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-over-2',
          tenantId: 'tenant-1',
          sourceType: PaymentSourceType.DEPOSIT,
          sourceId: 'deposit-1',
          paymentCode: 'PAY-TENANT-OVER-002',
          amount: 100000,
          metadata: {},
        }),
        update: vi.fn(),
        create: vi.fn(),
      },
      task: {
        create: vi.fn().mockResolvedValue({
          id: 'task-over-2',
          title: 'Hoàn lại tiền thừa SePay cho phiếu cọc deposit-1',
          status: 'TODO',
        }),
      },
    });

    await expect(
      service.resolveSePayOverpayment('tenant-1', 'user-1', {
        logId: 'log-over-2',
        resolution: 'REFUND_PENDING',
      }),
    ).resolves.toMatchObject({
      success: true,
      resolution: 'REFUND_PENDING',
      overpaidAmount: 50000,
    });

    expect(prisma.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        status: 'TODO',
        priority: 'HIGH',
      }),
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'Payments',
        entity: 'SePayOverpaymentResolution',
        entityId: 'request-over-2',
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    );
    expect(prisma.creditNote.create).not.toHaveBeenCalled();
  });

  it('completes a pending overpayment refund task', async () => {
    const { service, prisma, auditService } = createService({
      paymentWebhookLog: {
        upsert: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'log-over-3',
          tenantId: 'tenant-1',
          payload: {
            id: 'txn-over-3',
            code: 'PAY-TENANT-OVER-003',
            transferType: 'in',
            transferAmount: 180000,
            overpaymentResolution: 'REFUND_PENDING',
            overpaymentAmount: 30000,
          },
        }),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-over-3',
          tenantId: 'tenant-1',
          sourceType: PaymentSourceType.INVOICE,
          sourceId: 'invoice-3',
          paymentCode: 'PAY-TENANT-OVER-003',
          amount: 150000,
          metadata: {
            overpaymentResolution: 'REFUND_PENDING',
            overpaymentAmount: 30000,
            overpaymentTaskId: 'task-over-3',
            overpaymentTaskTitle: 'Hoàn lại tiền thừa SePay cho hóa đơn invoice-3',
          },
        }),
        update: vi.fn(),
        create: vi.fn(),
      },
      task: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'task-over-3',
          tenantId: 'tenant-1',
          title: 'Hoàn lại tiền thừa SePay cho hóa đơn invoice-3',
          description: 'Task pending',
          status: 'TODO',
        }),
        update: vi.fn().mockResolvedValue({
          id: 'task-over-3',
          status: 'DONE',
        }),
      },
    });

    await expect(
      service.completeSePayOverpaymentRefund('tenant-1', 'user-1', {
        logId: 'log-over-3',
        note: 'Da chuyen khoan hoan du',
      }),
    ).resolves.toMatchObject({
      success: true,
      paymentCode: 'PAY-TENANT-OVER-003',
      taskId: 'task-over-3',
      overpaymentAmount: 30000,
    });

    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: 'task-over-3' },
      data: expect.objectContaining({
        status: 'DONE',
      }),
    });
    expect(prisma.paymentRequest.update).toHaveBeenCalledWith({
      where: { id: 'request-over-3' },
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          overpaymentRefundCompletedBy: 'user-1',
          overpaymentRefundCompletionNote: 'Da chuyen khoan hoan du',
        }),
      }),
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'Payments',
        entity: 'SePayOverpaymentRefundCompletion',
        entityId: 'request-over-3',
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    );
  });
});
