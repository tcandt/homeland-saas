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
});
