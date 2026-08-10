import { UnauthorizedException } from '@nestjs/common';
import { PaymentProvider, PaymentRequestStatus, PaymentSourceType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  function createService(prismaOverrides: Record<string, any> = {}) {
    const prisma = {
      appSetting: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
      },
      paymentRequest: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      task: {
        create: vi.fn(),
      },
      creditNote: {
        create: vi.fn(),
      },
      bankAccount: {
        findFirst: vi.fn(),
      },
      invoice: {
        findFirst: vi.fn(),
      },
      deposit: {
        findFirst: vi.fn(),
      },
      ...prismaOverrides,
    };

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
    };

    return {
      prisma,
      invoicesService,
      depositsService,
      service: new PaymentsService(prisma as any, invoicesService as any, depositsService as any, communicationService as any),
    };
  }

  it('rejects SePay webhooks when no DB-backed API key is configured', async () => {
    const { service } = createService();

    await expect(service.handleSePayWebhook({ id: 'txn-1' }, 'Apikey anything')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('matches pending payment request by payment code and bank account number', async () => {
    const { service, prisma, invoicesService } = createService({
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
    const { service, prisma, invoicesService } = createService({
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
        amount: 400000,
        bankName: 'ACB',
        bankAccountNumber: '123456789',
      }),
    });
    expect(request).toMatchObject({
      id: 'request-1',
      amount: 400000,
      bankAccountNumber: '123456789',
    });
  });

  it('does not confirm SePay webhooks when the transfer amount is short', async () => {
    const { service, prisma, invoicesService } = createService({
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
    expect(prisma.paymentRequest.update).not.toHaveBeenCalled();
    expect(prisma.paymentWebhookLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: { processedAt: expect.any(Date) },
    });
  });

  it('confirms SePay webhooks with overpayment using the requested amount', async () => {
    const { service, prisma, invoicesService } = createService({
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
    expect(prisma.paymentRequest.update).toHaveBeenCalledWith({
      where: { id: 'request-1' },
      data: expect.objectContaining({
        status: PaymentRequestStatus.CONFIRMED,
        providerTransactionId: 'txn-over',
      }),
    });
  });

  it('ignores SePay webhooks with no payment code content', async () => {
    const { service, prisma, invoicesService } = createService({
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
      data: { processedAt: expect.any(Date) },
    });
  });

  it('manually assigns a SePay transaction to an invoice by invoice code', async () => {
    const { service, prisma, invoicesService } = createService({
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
      data: {
        tenantId: 'tenant-1',
        processedAt: expect.any(Date),
      },
    });
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
    const { service, prisma } = createService({
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
        create: vi.fn(),
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
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('resolves overpayment into refund pending task', async () => {
    const { service, prisma } = createService({
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
        create: vi.fn(),
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
    expect(prisma.creditNote.create).not.toHaveBeenCalled();
  });
});
