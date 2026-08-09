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
      },
      paymentRequest: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      bankAccount: {
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
});
