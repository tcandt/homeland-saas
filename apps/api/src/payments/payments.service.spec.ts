import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PaymentProvider, PaymentRequestStatus, PaymentSourceType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  function createService(
    prismaOverrides: Record<string, any> = {},
    dependencies: { depositOutboxPublisher?: { drain: ReturnType<typeof vi.fn> } } = {},
  ) {
    const basePrisma = {
      appSetting: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      paymentRequest: {
        findFirst: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      task: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      creditNote: {
        create: vi.fn(),
      },
      journalEntry: {
        findFirst: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 'journal-1' }),
      },
      chartOfAccount: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          if (where?.code === '1100') return { id: 'bank-account', code: '1100' };
          if (where?.code === '1300') return { id: 'liability-account', code: '1300' };
          return null;
        }),
      },
      receipt: {
        create: vi.fn().mockResolvedValue({ id: 'receipt-1', code: 'RCT-1' }),
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      bankAccount: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      owner: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      contract: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      roomPaymentAccountRoute: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'system-admin', email: 'admin@homeland.vn', role: 'ADMIN' },
        ]),
      },
      invoice: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'invoice-1',
          total: 1_000_000_000,
          paidAmount: 0,
          creditAmount: 0,
          period: '2026-09',
        }),
      },
      deposit: {
        findFirst: vi.fn(),
      },
      depositLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { balanceEffect: 0 } }),
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
    if (!prisma.$transaction) {
      prisma.$transaction = vi.fn().mockImplementation(async (callback: any) => callback(prisma));
    }
    if (prismaOverrides.$transaction) {
      prisma.$transaction = prismaOverrides.$transaction;
    }
    if (!prisma.$queryRaw) {
      prisma.$queryRaw = vi.fn().mockResolvedValue([{ lock: 'locked' }]);
    }
    if (!('tx' in prisma)) {
      prisma.tx = prisma;
    }

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
    const zaloProvider = {
      send: vi.fn().mockResolvedValue({ success: true, zaloResponse: { result: { message_id: 'zalo-msg-1' } } }),
      sendPhoto: vi.fn().mockResolvedValue({ success: true, zaloResponse: { result: { message_id: 'zalo-photo-1' } } }),
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
      zaloProvider,
      journalEntryService,
      auditService,
      service: new PaymentsService(
        prisma as any,
        invoicesService as any,
        depositsService as any,
        communicationService as any,
        zaloProvider as any,
        journalEntryService as any,
        auditService as any,
        dependencies.depositOutboxPublisher as any,
      ),
    };
  }

  it('rejects SePay webhooks when no DB-backed API key is configured', async () => {
    const { service } = createService();

    await expect(service.handleSePayWebhook({ id: 'txn-1' }, 'Apikey anything')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts SePay webhooks in HMAC mode with a valid raw-body signature', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({
      id: 'txn-hmac-1',
      code: 'PAY-TENANT-HMAC-001',
      transferType: 'in',
      transferAmount: 100000,
    });
    const signature = createHmac('sha256', 'hmac-secret-1')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const { service, prisma, invoicesService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', value: { authMode: 'hmac', hmacSecret: 'hmac-secret-1' } }]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn().mockResolvedValue({ id: 'log-hmac-1', processedAt: null }),
        update: vi.fn(),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-hmac-1',
          tenantId: 'tenant-1',
          sourceType: PaymentSourceType.INVOICE,
          sourceId: 'invoice-1',
          status: PaymentRequestStatus.PENDING,
          amount: 100000,
          bankAccountNumber: '123456789',
        }),
        update: vi.fn(),
      },
    });
    invoicesService.pay.mockResolvedValue({ id: 'invoice-1' });

    await expect(
      service.handleSePayWebhook(JSON.parse(rawBody), {
        timestamp,
        rawBody,
        signature,
      }),
    ).resolves.toEqual({ success: true });

    expect(prisma.paymentRequest.update).toHaveBeenCalledWith({
      where: { id: 'request-hmac-1' },
      data: expect.objectContaining({
        status: PaymentRequestStatus.CONFIRMED,
        providerTransactionId: 'txn-hmac-1',
      }),
    });
  });

  it('flushes payment notification outbox work before acknowledging an accepted SePay webhook', async () => {
    const depositOutboxPublisher = {
      drain: vi.fn()
        .mockResolvedValueOnce({ claimed: 1, published: 1, failed: 0 })
        .mockResolvedValueOnce({ claimed: 0, published: 0, failed: 0 }),
    };
    const { service, invoicesService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', value: { webhookApiKey: 'db-key' } }]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn().mockResolvedValue({ id: 'log-immediate-1', processedAt: null }),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-immediate-1',
          tenantId: 'tenant-1',
          sourceType: PaymentSourceType.INVOICE,
          sourceId: 'invoice-1',
          status: PaymentRequestStatus.PENDING,
          amount: 100000,
          bankAccountNumber: '123456789',
        }),
        update: vi.fn(),
      },
    }, { depositOutboxPublisher });
    invoicesService.pay.mockResolvedValue({ id: 'invoice-1' });

    await expect(service.acceptSePayWebhook({
      id: 'txn-immediate-1',
      code: 'PAY-IMMEDIATE-1',
      accountNumber: '123456789',
      transferType: 'in',
      transferAmount: 100000,
    }, 'Apikey db-key')).resolves.toMatchObject({
      success: true,
      accepted: true,
      notificationFlush: { status: 'DELIVERED', claimed: 1, published: 1, failed: 0 },
    });

    expect(depositOutboxPublisher.drain).toHaveBeenCalledTimes(2);
    expect(depositOutboxPublisher.drain).toHaveBeenNthCalledWith(1, 50);
    expect(depositOutboxPublisher.drain).toHaveBeenNthCalledWith(2, 50);
  });

  it('uses the persisted SePay API base URL when reporting the webhook endpoint', async () => {
    const { service } = createService({
      appSetting: {
        findUnique: vi.fn().mockResolvedValue({
          value: { webhookBaseUrl: 'https://staging.example.test/api/v1' },
        }),
      },
      paymentWebhookLog: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      roomPaymentAccountRoute: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    await expect(service.getSePayStatus('tenant-1')).resolves.toMatchObject({
      webhookUrl: 'https://staging.example.test/api/v1/payments/sepay/webhook',
    });
  });

  it('rejects SePay webhooks in HMAC mode when the signature is invalid', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({
      id: 'txn-hmac-bad-1',
      code: 'PAY-TENANT-HMAC-BAD-001',
      transferType: 'in',
      transferAmount: 100000,
    });

    const { service } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', value: { authMode: 'hmac', hmacSecret: 'hmac-secret-1' } }]),
        findUnique: vi.fn(),
      },
    });

    await expect(
      service.handleSePayWebhook(JSON.parse(rawBody), {
        timestamp,
        rawBody,
        signature: 'bad-signature',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts SePay webhooks in dual mode with either api key or HMAC', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({
      id: 'txn-dual-1',
      code: 'PAY-TENANT-DUAL-001',
      transferType: 'in',
      transferAmount: 100000,
    });
    const signature = createHmac('sha256', 'dual-secret-1')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const { service, prisma, invoicesService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', value: { authMode: 'dual', webhookApiKey: 'dual-key-1', hmacSecret: 'dual-secret-1' } }]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn().mockResolvedValue({ id: 'log-dual-1', processedAt: null }),
        update: vi.fn(),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-dual-1',
          tenantId: 'tenant-1',
          sourceType: PaymentSourceType.INVOICE,
          sourceId: 'invoice-1',
          status: PaymentRequestStatus.PENDING,
          amount: 100000,
          bankAccountNumber: '123456789',
        }),
        update: vi.fn(),
      },
    });
    invoicesService.pay.mockResolvedValue({ id: 'invoice-1' });

    await expect(
      service.handleSePayWebhook(JSON.parse(rawBody), {
        timestamp,
        rawBody,
        signature,
      }),
    ).resolves.toEqual({ success: true });

    expect(prisma.paymentRequest.update).toHaveBeenCalled();
  });

  it('ignores concurrent duplicate SePay webhooks for the same transaction id in the same API process', async () => {
    let releaseUpsert!: (value: any) => void;
    const upsertPromise = new Promise((resolve) => {
      releaseUpsert = resolve;
    });
    const { service, prisma } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', value: { webhookApiKey: 'db-key' } }]),
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
        findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', value: { webhookApiKey: 'db-key' } }]),
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
          bankAccountNumber: '123456789',
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
        tenantId: { in: ['tenant-1'] },
        provider: PaymentProvider.SEPAY,
        paymentCode: 'PAY-TENANT-ABC-XYZ',
      },
    });
    expect(invoicesService.pay).toHaveBeenCalledWith('invoice-1', 100000, 'SEPAY', 'txn-1', 'SEPAY_WEBHOOK', 'tenant-1');
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

  it('matches SePay virtual account requests when sandbox webhook reports the main BIDV account', async () => {
    const { service, prisma, invoicesService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', value: { webhookApiKey: 'db-key' } }]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn().mockResolvedValue({ id: 'log-va-1', processedAt: null }),
        update: vi.fn(),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-va-1',
          tenantId: 'tenant-1',
          sourceType: PaymentSourceType.INVOICE,
          sourceId: 'invoice-1',
          status: PaymentRequestStatus.PENDING,
          amount: 1000000,
          bankName: 'BIDV',
          bankAccountNumber: 'SBSEPAYMKYNGRD9RLQJ',
        }),
        update: vi.fn(),
      },
    });
    invoicesService.pay.mockResolvedValue({ id: 'invoice-1' });

    await service.handleSePayWebhook({
      gateway: 'BIDV',
      transactionDate: '2026-09-20 11:01:50',
      accountNumber: '0000000001',
      subAccount: 'SBSEPAYMKYNGRD9RLQJ',
      code: 'HD31030926',
      content: 'HD31030926',
      transferType: 'in',
      description: 'HD31030926',
      transferAmount: 1000000,
      referenceCode: 'SBBB2E343A0D45',
      accumulated: 0,
      id: 32798,
    }, 'Apikey db-key');

    expect(invoicesService.pay).toHaveBeenCalledWith('invoice-1', 1000000, 'SEPAY', '32798', 'SEPAY_WEBHOOK', 'tenant-1');
    expect(prisma.paymentRequest.update).toHaveBeenCalledWith({
      where: { id: 'request-va-1' },
      data: expect.objectContaining({
        status: PaymentRequestStatus.CONFIRMED,
        providerTransactionId: '32798',
        paidAt: expect.any(Date),
      }),
    });
    expect(prisma.paymentWebhookLog.update).toHaveBeenCalledWith({
      where: { id: 'log-va-1' },
      data: expect.objectContaining({
        status: 'PROCESSED',
        tenantId: 'tenant-1',
        processedAt: expect.any(Date),
      }),
    });
  });

  it('binds SePay credentials to the tenant that owns the payment request', async () => {
    const findFirst = vi.fn().mockImplementation(async ({ where }) => {
      const allowedTenants = where.tenantId?.in || [];
      return allowedTenants.includes('tenant-b')
        ? {
            id: 'request-b',
            tenantId: 'tenant-b',
            sourceType: PaymentSourceType.INVOICE,
            sourceId: 'invoice-b',
            status: PaymentRequestStatus.PENDING,
            amount: 100000,
          }
        : null;
    });
    const { service, prisma, invoicesService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([
          { tenantId: 'tenant-a', value: { authMode: 'api_key', webhookApiKey: 'tenant-a-key' } },
        ]),
      },
      paymentWebhookLog: {
        upsert: vi.fn().mockResolvedValue({ id: 'log-tenant-boundary', processedAt: null }),
        update: vi.fn(),
      },
      paymentRequest: { findFirst },
    });

    await service.handleSePayWebhook({
      id: 'txn-tenant-boundary',
      code: 'PAY-TENANT-B-001',
      transferType: 'in',
      transferAmount: 100000,
      accountNumber: 'BANK-B',
    }, 'Apikey tenant-a-key');

    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId: { in: ['tenant-a'] } }),
    });
    expect(invoicesService.pay).not.toHaveBeenCalled();
    expect(prisma.paymentWebhookLog.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'NEEDS_REVIEW' }),
    }));
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
      room: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'room-1',
          code: '31.01',
          name: '31.01',
          rentalType: 'WHOLE',
          buildingId: 'building-1',
          building: {
            id: 'building-1',
            code: 'LK01',
            name: 'Toa LK01',
            ownerId: 'owner-a',
          },
        }),
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
          id: 'room-1',
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

  it('serializes concurrent clients so one source has one pending request', async () => {
    const records: any[] = [];
    let lockTail = Promise.resolve();
    const makeClient = (id: string) => {
      const findFirst = vi.fn(async ({ where }: any) =>
        records.find((record) =>
          record.tenantId === where.tenantId &&
          record.sourceType === where.sourceType &&
          record.sourceId === where.sourceId &&
          record.status === where.status,
        ) || null,
      );
      const findUnique = vi.fn(async ({ where }: any) =>
        records.find((record) =>
          record.tenantId === where.tenantId_paymentCode.tenantId &&
          record.paymentCode === where.tenantId_paymentCode.paymentCode,
        ) || null,
      );
      const update = vi.fn(async ({ where, data }: any) => {
        const record = records.find((candidate) => candidate.id === where.id);
        Object.assign(record, data, { updatedAt: new Date() });
        return record;
      });
      const create = vi.fn(async ({ data }: any) => {
        const request = {
          id,
          ...data,
          status: PaymentRequestStatus.PENDING,
          provider: PaymentProvider.SEPAY,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        records.push(request);
        return request;
      });
      let releaseLock: (() => void) | undefined;
      const tx = {
        paymentRequest: { findFirst, findUnique, update, create },
        $queryRaw: vi.fn(async () => {
          const previous = lockTail;
          let release!: () => void;
          lockTail = new Promise<void>((resolve) => {
            release = resolve;
          });
          await previous;
          releaseLock = release;
          return [];
        }),
      };
      const { service } = createService({
        appSetting: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        bankAccount: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'bank-1',
            ownerId: null,
            bankName: 'ACB',
            accountNumber: '123456789',
            accountName: 'Homeland',
            isActive: true,
          }),
        },
        $transaction: vi.fn(async (callback: any) => {
          try {
            return await callback(tx);
          } finally {
            releaseLock?.();
            releaseLock = undefined;
          }
        }),
      });
      return { service, tx, create };
    };

    const clientA = makeClient('request-a');
    const clientB = makeClient('request-b');
    const command = (service: PaymentsService) =>
      (service as any).createPaymentRequest(
        'tenant-1',
        PaymentSourceType.INVOICE,
        'invoice-concurrent',
        500000,
        'INV',
        'user-1',
        { roomCode: '31.01' },
      );

    const [first, second] = await Promise.all([
      command(clientA.service),
      command(clientB.service),
    ]);

    expect(records).toHaveLength(1);
    expect(first.id).toBe(records[0].id);
    expect(second.id).toBe(records[0].id);
    expect(clientA.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(clientB.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(clientA.create.mock.calls.length + clientB.create.mock.calls.length).toBe(1);
  });

  it('keeps colliding HD and COC payment codes within SePay eight-digit patterns', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T00:00:00.000Z'));
    try {
      const bankAccount = {
        id: 'bank-owner-a',
        ownerId: 'owner-a',
        bankName: 'ACB',
        accountNumber: '123456789',
        accountName: 'Owner A',
        isActive: true,
        createdAt: new Date('2026-08-09T00:00:00.000Z'),
      };
      const findUnique = vi.fn()
        .mockResolvedValueOnce({ id: 'existing-invoice-request' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-deposit-request' })
        .mockResolvedValueOnce(null);
      const { service, prisma, invoicesService, depositsService } = createService({
        appSetting: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({ value: { paymentCodePrefix: 'PAY' } }),
        },
        bankAccount: { findFirst: vi.fn().mockResolvedValue(bankAccount) },
        room: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'room-1',
            code: '31.01',
            name: '31.01',
            rentalType: 'WHOLE',
            buildingId: 'building-1',
            building: { id: 'building-1', ownerId: 'owner-a' },
          }),
        },
        paymentRequest: {
          findFirst: vi.fn(),
          findUnique,
          update: vi.fn(),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
            id: `request-${data.sourceType.toLowerCase()}`,
            ...data,
            status: PaymentRequestStatus.PENDING,
            provider: PaymentProvider.SEPAY,
            createdAt: new Date('2026-09-26T00:00:00.000Z'),
            updatedAt: new Date('2026-09-26T00:00:00.000Z'),
          })),
        },
      });
      const room = {
        id: 'room-1',
        code: '31.01',
        name: '31.01',
        rentalType: 'WHOLE',
        buildingId: 'building-1',
        building: { id: 'building-1', ownerId: 'owner-a' },
      };
      invoicesService.getDetail.mockResolvedValue({
        id: 'invoice-1',
        tenantId: 'tenant-1',
        code: 'INV-001',
        total: 500000,
        paidAmount: 0,
        creditAmount: 0,
        customerId: 'customer-1',
        contract: { roomId: 'room-1', room },
      });
      depositsService.getDetail.mockResolvedValue({
        id: 'deposit-1',
        tenantId: 'tenant-1',
        code: 'DEP-001',
        status: 'PENDING',
        amount: 500000,
        customerId: 'customer-1',
        roomId: 'room-1',
        room,
        contract: { roomId: 'room-1', room },
      });

      await service.createInvoiceRequest('invoice-1', 'user-1');
      await service.createDepositRequest('deposit-1', 'user-1');

      const createdCodes = prisma.paymentRequest.create.mock.calls.map(
        ([{ data }]: any[]) => data.paymentCode,
      );
      expect(createdCodes).toEqual(['HD31010927', 'COC31010927']);
      expect(createdCodes.every((code: string) => /^(HD|COC)\d{8}$/.test(code))).toBe(true);
      expect(findUnique).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('requests only the remaining security-deposit balance after booking conversion', async () => {
    const bankAccount = {
      id: 'bank-owner-a',
      ownerId: 'owner-a',
      bankName: 'ACB',
      accountNumber: '123456789',
      accountName: 'Owner A',
      isActive: true,
      createdAt: new Date('2026-08-09T00:00:00.000Z'),
    };
    const { service, prisma, depositsService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ value: { paymentCodePrefix: 'DEP' } }),
      },
      bankAccount: { findFirst: vi.fn().mockResolvedValue(bankAccount) },
      room: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'room-1',
          code: '31.01',
          name: '31.01',
          rentalType: 'WHOLE',
          buildingId: 'building-1',
          building: { id: 'building-1', code: 'LK01', name: 'Toa LK01', ownerId: 'owner-a' },
        }),
      },
      depositLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { balanceEffect: 2000000 } }),
      },
      paymentRequest: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 'request-security-1',
          ...data,
          status: PaymentRequestStatus.PENDING,
          provider: PaymentProvider.SEPAY,
          createdAt: new Date('2026-08-09T00:00:00.000Z'),
          updatedAt: new Date('2026-08-09T00:00:00.000Z'),
        })),
      },
    });
    depositsService.getDetail.mockResolvedValue({
      id: 'security-deposit-1',
      tenantId: 'tenant-1',
      code: 'DEP-SECURITY-1',
      status: 'PENDING',
      amount: 5000000,
      customerId: 'customer-1',
      roomId: 'room-1',
      room: { id: 'room-1', buildingId: 'building-1', building: { ownerId: 'owner-a' } },
      contract: { roomId: 'room-1' },
    });

    const request = await service.createDepositRequest('security-deposit-1', 'user-1');

    expect(prisma.paymentRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceType: PaymentSourceType.DEPOSIT,
        sourceId: 'security-deposit-1',
        amount: 3000000,
        metadata: expect.objectContaining({ fundedAmount: 2000000, remainingAmount: 3000000 }),
      }),
    });
    expect(request.amount).toBe(3000000);
  });

  it('blocks a standalone QR for security already covered by the combined ENTRY invoice', async () => {
    const { service, prisma, depositsService } = createService();
    depositsService.getDetail.mockResolvedValue({
      id: 'security-combined-1', tenantId: 'tenant-1', status: 'PENDING', amount: 8_000_000,
      contract: {
        id: 'rental-1', tenantId: 'tenant-1', customerId: 'customer-1', rentalCycleId: 'cycle-1',
        termsSnapshot: {
          convertedFromBookingHold: {
            initialEntryInvoice: {
              invoiceId: 'entry-combined-1', paymentPolicyVersion: 'BOOKING_ENTRY_COMBINED_V1',
              securityDepositId: 'security-combined-1',
            },
          },
        },
      },
    });

    await expect(service.createDepositRequest('security-combined-1', 'user-1'))
      .rejects.toThrow('Khoản cọc đã nằm trong hóa đơn nhận phòng');
    expect(prisma.paymentRequest.create).not.toHaveBeenCalled();
  });

  it('resolves test QR by room routing before owner fallback', async () => {
    const { service, prisma } = createService({
      appSetting: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          const key = where?.tenantId_scope_ownerId_key?.key;
          if (key === 'sepay') return Promise.resolve({ value: { paymentCodePrefix: 'HL' } });
          return Promise.resolve(null);
        }),
      },
      roomPaymentAccountRoute: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'route-1',
            roomId: 'room-1',
            bankAccountId: 'bank-room-route',
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validTo: null,
            note: null,
          },
        ]),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'room-1',
          code: 'LK01.31',
          name: 'LK01.31',
          rentalType: 'WHOLE',
          buildingId: 'building-1',
          building: {
            id: 'building-1',
            code: 'LK01',
            name: 'Tòa LK01',
            ownerId: 'owner-a',
          },
        }),
      },
      bankAccount: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'bank-room-route',
            ownerId: 'owner-a',
            bankName: 'MBBank',
            accountNumber: '111122223333',
            accountName: 'Owner A',
            isActive: true,
          }),
      },
    });

    const preview = await service.previewSePayQr('tenant-1', { roomId: 'room-1', amount: 10000 });

    expect(preview.roomCode).toBe('LK01.31');
    expect(preview.bankAccountId).toBe('bank-room-route');
    expect(preview.resolvedFrom).toBe('ROOM');
    expect(prisma.bankAccount.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: 'bank-room-route',
        isActive: true,
      },
    });
  });

  it('sends test QR preview to zalo admin group', async () => {
    const { service, zaloProvider } = createService({
      appSetting: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          const key = where?.tenantId_scope_ownerId_key?.key;
          if (key === 'sepay') return Promise.resolve({ value: { paymentCodePrefix: 'HL' } });
          if (key === 'sepay-routing') return Promise.resolve({ value: { assignments: [] } });
          if (key === 'zalo-provider') return Promise.resolve({ value: { adminGroupChatId: 'zalo-group-1' } });
          return Promise.resolve(null);
        }),
      },
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'bank-1',
          ownerId: 'owner-a',
          bankName: 'MBBank',
          accountNumber: '111122223333',
          accountName: 'Owner A',
          isActive: true,
        }),
      },
    });

    const result = await service.sendPreviewSePayQrToAdminGroup('tenant-1', { amount: 20000 });

    expect(result.recipient).toBe('zalo-group-1');
    expect(zaloProvider.sendPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        recipient: 'zalo-group-1',
        photo: expect.stringContaining('https://vietqr.app/img?'),
        caption: expect.stringContaining('QR test SePay'),
      }),
    );
  });

  it('falls back to AppSetting routing storage when the routing table is not migrated', async () => {
    const { service, prisma, auditService } = createService({
      roomPaymentAccountRoute: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockRejectedValue(Object.assign(new Error('missing table'), { code: 'P2021' })),
        createMany: vi.fn(),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'room-1',
          code: 'LK01.31',
          name: 'LK01.31',
          rentalType: 'WHOLE',
          buildingId: 'building-1',
          building: {
            id: 'building-1',
            code: 'LK01',
            name: 'Tòa LK01',
            ownerId: 'owner-a',
          },
        }),
        findMany: vi.fn().mockResolvedValue([{ id: 'room-1' }]),
      },
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'bank-1',
          ownerId: 'owner-a',
          bankName: 'MBBank',
          accountNumber: '111122223333',
          accountName: 'Owner A',
          isActive: true,
        }),
        findMany: vi.fn().mockResolvedValue([{ id: 'bank-1' }]),
      },
      appSetting: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          const key = where?.tenantId_scope_ownerId_key?.key;
          if (key === 'sepay') return Promise.resolve({ value: { paymentCodePrefix: 'HL' } });
          if (key === 'sepay-routing') return Promise.resolve({ value: { assignments: [{ roomId: 'room-1', bankAccountId: 'bank-1' }] } });
          return Promise.resolve(null);
        }),
        upsert: vi.fn().mockResolvedValue({ id: 'setting-1' }),
      },
    });

    const result = await service.saveRoomPaymentAccountRoutes(
      'tenant-1',
      [{ roomId: 'room-1', bankAccountId: 'bank-1' }],
      'user-1',
    );

    expect(prisma.appSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId: 'tenant-1',
          scope: 'TENANT',
          ownerId: 'tenant-1',
          key: 'sepay-routing',
        },
      },
      update: expect.objectContaining({
        value: expect.objectContaining({
          assignments: [
            expect.objectContaining({
              roomId: 'room-1',
              bankAccountId: 'bank-1',
            }),
          ],
        }),
      }),
    }));
    expect(auditService.log).toHaveBeenCalled();
    expect(result).toBeTruthy();
  });

  it('does not confirm SePay webhooks when the transfer amount is short', async () => {
    const { service, prisma, invoicesService, auditService, communicationService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', value: { webhookApiKey: 'db-key' } }]),
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

  it('keeps a second bank transaction with the same payment memo in review instead of confirming twice', async () => {
    const { service, prisma, invoicesService, auditService, communicationService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', value: { webhookApiKey: 'db-key' } }]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn().mockResolvedValue({ id: 'log-content-duplicate', processedAt: null }),
        update: vi.fn(),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-1',
          tenantId: 'tenant-1',
          sourceType: PaymentSourceType.INVOICE,
          sourceId: 'invoice-1',
          status: PaymentRequestStatus.CONFIRMED,
          providerTransactionId: 'txn-canonical',
          amount: 100000,
        }),
        update: vi.fn(),
      },
    });

    await service.handleSePayWebhook({
      id: 'txn-second-real-transfer',
      code: 'PAY-TENANT-ABC-XYZ',
      transferType: 'in',
      transferAmount: 100000,
    }, 'Apikey db-key');

    expect(invoicesService.pay).not.toHaveBeenCalled();
    expect(prisma.paymentRequest.update).not.toHaveBeenCalled();
    expect(prisma.paymentWebhookLog.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'log-content-duplicate' },
      data: expect.objectContaining({
        status: 'NEEDS_REVIEW',
        lastError: 'SEPAY_DUPLICATE_CONTENT:txn-canonical',
      }),
    }));
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'SePayDuplicatePaymentContent',
      entityId: 'log-content-duplicate',
      tenantId: 'tenant-1',
    }));
    expect(communicationService.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'system-admin',
      templateCode: 'SYSTEM_ALERT',
    }));
  });

  it('resolves a second real transfer with the same confirmed memo by its full amount', async () => {
    const { service, prisma } = createService({
      paymentWebhookLog: {
        upsert: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'log-content-duplicate',
          tenantId: 'tenant-1',
          providerTransactionId: 'txn-second-real-transfer',
          payload: {
            id: 'txn-second-real-transfer',
            code: 'PAY-TENANT-ABC-XYZ',
            transferType: 'in',
            transferAmount: 100000,
          },
        }),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-1',
          tenantId: 'tenant-1',
          sourceType: PaymentSourceType.INVOICE,
          sourceId: 'invoice-1',
          paymentCode: 'PAY-TENANT-ABC-XYZ',
          status: PaymentRequestStatus.CONFIRMED,
          providerTransactionId: 'txn-canonical',
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
        create: vi.fn().mockResolvedValue({ id: 'credit-note-1' }),
      },
      journalEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'journal-1' }),
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
        logId: 'log-content-duplicate',
        resolution: 'CREDIT_BALANCE',
      }),
    ).resolves.toMatchObject({
      success: true,
      paymentCode: 'PAY-TENANT-ABC-XYZ',
      overpaidAmount: 100000,
    });

    expect(prisma.creditNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: 'customer-1',
        amount: 100000,
        remainingAmount: 100000,
      }),
    });
    expect(prisma.paymentRequest.update).toHaveBeenCalledWith({
      where: { id: 'request-1' },
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          overpaymentResolutions: expect.objectContaining({
            'log-content-duplicate': expect.objectContaining({
              resolution: 'CREDIT_BALANCE',
              overpaymentAmount: 100000,
            }),
          }),
        }),
      }),
    });
  });

  it('confirms SePay webhooks with overpayment using the requested amount', async () => {
    const { service, prisma, invoicesService, auditService, communicationService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', value: { webhookApiKey: 'db-key' } }]),
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

    expect(invoicesService.pay).toHaveBeenCalledWith('invoice-1', 100000, 'SEPAY', 'txn-over', 'SEPAY_WEBHOOK', 'tenant-1');
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

  it('collects linked booking deposit when SePay confirms a booking-hold invoice QR', async () => {
    const { service, prisma, invoicesService, depositsService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', value: { webhookApiKey: 'db-key' } }]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn().mockResolvedValue({ id: 'log-booking-1', processedAt: null }),
        update: vi.fn(),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-booking-1',
          tenantId: 'tenant-1',
          sourceType: PaymentSourceType.INVOICE,
          sourceId: 'invoice-booking-1',
          status: PaymentRequestStatus.PENDING,
          amount: 1000000,
        }),
        update: vi.fn(),
        create: vi.fn(),
      },
      invoice: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'invoice-booking-1',
          total: 1000000,
          paidAmount: 0,
          creditAmount: 0,
          period: 'Cọc giữ phòng',
          contractId: 'contract-booking-1',
          customerId: 'customer-1',
          contract: { roomId: 'room-1' },
        }),
      },
      deposit: {
        findFirst: vi.fn().mockResolvedValue({ id: 'deposit-booking-1' }),
      },
    });
    invoicesService.pay.mockResolvedValue({
      id: 'invoice-booking-1',
      status: 'PAID',
      total: 1000000,
      paidAmount: 1000000,
      creditAmount: 0,
    });
    depositsService.collect.mockResolvedValue({ id: 'deposit-booking-1', status: 'PAID' });

    await service.handleSePayWebhook({
      id: 'txn-booking-1',
      code: 'HD31030926',
      transferType: 'in',
      transferAmount: 1000000,
    }, 'Apikey db-key');

    expect(invoicesService.pay).toHaveBeenCalledWith(
      'invoice-booking-1',
      1000000,
      'SEPAY',
      'txn-booking-1',
      'SEPAY_WEBHOOK',
      'tenant-1',
    );
    expect(prisma.deposit.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        OR: expect.arrayContaining([
          { contractId: 'contract-booking-1' },
          { roomId: 'room-1', customerId: 'customer-1' },
        ]),
        type: { in: ['BOOKING', 'RESERVATION'] },
        status: { in: ['DRAFT', 'PENDING'] },
        deletedAt: null,
      }),
      orderBy: { createdAt: 'desc' },
      select: { id: true, rentalCycleId: true },
    });
    expect(depositsService.collect).toHaveBeenCalledWith(
      'deposit-booking-1',
      'SePay invoice confirmation txn-booking-1',
      'SEPAY_WEBHOOK',
      'sepay:invoice:invoice-booking-1:txn-booking-1',
      null,
      expect.objectContaining({
        suppressCustomerZaloConfirmation: true,
        linkedInvoicePayment: true,
        sourceInvoiceId: 'invoice-booking-1',
        paymentRequestId: 'request-booking-1',
        skipHoldCreation: true,
        skipRoomReservation: true,
      }),
    );
    expect(depositsService.collect).toHaveBeenCalledTimes(1);
    expect(prisma.paymentRequest.update.mock.invocationCallOrder[0])
      .toBeLessThan(depositsService.collect.mock.invocationCallOrder[0]);
  });

  it('ignores SePay webhooks with no payment code content', async () => {
    const { service, prisma, invoicesService, auditService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', value: { webhookApiKey: 'db-key' } }]),
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
        findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', value: { webhookApiKey: 'db-key' } }]),
        findUnique: vi.fn(),
      },
      paymentWebhookLog: {
        upsert: vi.fn().mockResolvedValue({ id: 'log-1', processedAt: null }),
        update: vi.fn(),
      },
      paymentRequest: {
        findFirst: vi
          .fn()
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
    const depositOutboxPublisher = {
      drain: vi.fn()
        .mockResolvedValueOnce({ claimed: 1, published: 1, failed: 0 })
        .mockResolvedValueOnce({ claimed: 0, published: 0, failed: 0 }),
    };
    const { service, invoicesService, communicationService, auditService } = createService({
      appSetting: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ value: { paymentCodePrefix: 'INV' } }),
      },
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue(bankAccount),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'room-1',
          code: '31.01',
          name: '31.01',
          rentalType: 'WHOLE',
          buildingId: 'building-1',
          building: {
            id: 'building-1',
            code: 'LK01',
            name: 'Toa LK01',
            ownerId: 'owner-a',
          },
        }),
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
    }, { depositOutboxPublisher });
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
    expect(depositOutboxPublisher.drain).toHaveBeenCalledTimes(2);
    expect(communicationService.dispatchDirect.mock.invocationCallOrder[0]).toBeLessThan(
      depositOutboxPublisher.drain.mock.invocationCallOrder[0],
    );
  });

  it('preserves shared-room context when sending invoice payment request to Zalo', async () => {
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
      room: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'room-1',
          code: '31.06',
          name: '31.06',
          rentalType: 'SHARED',
          buildingId: 'building-1',
          building: {
            id: 'building-1',
            code: 'LK01',
            name: 'Toa A',
            ownerId: 'owner-a',
          },
        }),
      },
      paymentRequest: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 'request-zalo-shared-1',
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
      total: 3500000,
      paidAmount: 0,
      creditAmount: 0,
      customerId: 'customer-1',
      customer: { fullName: 'Khach A', phone: '0901000001', zaloChatId: 'zalo-chat-1' },
      contract: {
        id: 'contract-1',
        roomId: 'room-1',
        memberCount: 2,
        room: {
          code: '31.06',
          buildingId: 'building-1',
          rentalType: 'SHARED',
          building: { ownerId: 'owner-a', name: 'Toa A' },
        },
      },
    });

    await service.sendInvoiceRequestToZalo('invoice-1', 'user-1');

    expect(communicationService.dispatchDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          roomCode: '31.06',
          roomRentalType: 'SHARED',
          roomRentalTypeLabel: 'Phòng ghép',
          roomMemberCount: 2,
          customerName: 'Khach A',
        }),
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
        customer: { fullName: 'Khach A', phone: '' },
        contract: {
          roomId: 'room-1',
          room: {
            id: 'room-1',
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
        customer: { fullName: 'Khach A', phone: '' },
      });

    await expect(service.sendInvoiceRequestToZalo('invoice-1', 'user-1')).rejects.toThrow(
      'Khách thuê chưa đăng ký Zalo Bot',
    );
    expect(communicationService.dispatchDirect).not.toHaveBeenCalled();
  });

  it('manually assigns a transfer with missing payment content to the operator-selected invoice', async () => {
    const { service, prisma, invoicesService, auditService } = createService({
      paymentWebhookLog: {
        upsert: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'log-1',
          payload: {
            id: 'txn-manual-1',
            content: 'NGUYEN VAN A CHUYEN HO',
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
          paymentCode: 'MANUAL-txn-manual-1',
        }),
        update: vi.fn(),
      },
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'bank-1',
          ownerId: 'owner-a',
          bankName: 'ACB',
          accountNumber: '123456789',
          accountName: 'Owner A',
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'bank-1',
            ownerId: 'owner-a',
            bankName: 'ACB',
            accountNumber: '123456789',
            accountName: 'Owner A',
          },
        ]),
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
      room: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'room-1',
          code: 'R-01',
          name: 'Room 01',
          rentalType: 'SHARED',
          buildingId: 'building-1',
          building: { id: 'building-1', code: 'B-01', name: 'Building 01', ownerId: 'owner-a' },
        }),
      },
    });
    invoicesService.pay.mockResolvedValue({ id: 'invoice-1' });

    await expect(
      service.manualAssignSePayTransaction('tenant-1', 'user-1', {
        logId: 'log-1',
        sourceType: PaymentSourceType.INVOICE,
        sourceCode: 'INV-001',
      }, 'manual-1'),
    ).resolves.toMatchObject({
      success: true,
      paymentCode: 'MANUAL-txn-manual-1',
      amount: 90000,
    });

    expect(prisma.paymentRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        sourceType: PaymentSourceType.INVOICE,
        sourceId: 'invoice-1',
        paymentCode: 'MANUAL-txn-manual-1',
        amount: 90000,
        bankAccountNumber: '123456789',
      }),
    });
    expect(invoicesService.pay).toHaveBeenCalledWith('invoice-1', 90000, 'SEPAY', 'txn-manual-1', 'user-1', 'tenant-1');
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

  it('does not collect a booking deposit when a manual assignment only partially pays its invoice', async () => {
    const { service, prisma, invoicesService, depositsService } = createService({
      paymentWebhookLog: {
        upsert: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'log-booking-partial-1',
          tenantId: 'tenant-1',
          status: 'NEEDS_REVIEW',
          payload: {
            id: 'txn-booking-partial-1',
            content: 'KHACH CHUYEN MOT PHAN',
            transferType: 'in',
            transferAmount: 400_000,
            accountNumber: '123456789',
            gateway: 'ACB',
          },
        }),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'request-booking-partial-1',
          tenantId: 'tenant-1',
          paymentCode: 'MANUAL-txn-booking-partial-1',
        }),
        update: vi.fn(),
      },
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'bank-1',
          ownerId: 'owner-a',
          bankName: 'ACB',
          accountNumber: '123456789',
          accountName: 'Owner A',
        }),
        findMany: vi.fn().mockResolvedValue([{
          id: 'bank-1',
          ownerId: 'owner-a',
          bankName: 'ACB',
          accountNumber: '123456789',
          accountName: 'Owner A',
        }]),
      },
      invoice: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'invoice-booking-partial-1',
          tenantId: 'tenant-1',
          code: 'INV-BOOKING-PARTIAL-1',
          total: 1_000_000,
          paidAmount: 0,
          creditAmount: 0,
          period: 'Cọc giữ phòng',
          customerId: 'customer-1',
          contractId: 'booking-contract-1',
          rentalCycleId: 'cycle-1',
          contract: {
            roomId: 'room-1',
            room: {
              buildingId: 'building-1',
              building: { ownerId: 'owner-a' },
            },
          },
        }),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'room-1',
          code: 'P101',
          buildingId: 'building-1',
          building: { ownerId: 'owner-a' },
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    invoicesService.pay.mockResolvedValue({
      id: 'invoice-booking-partial-1',
      status: 'PARTIALLY_PAID',
      total: 1_000_000,
      paidAmount: 400_000,
      creditAmount: 0,
    });

    await expect(service.manualAssignSePayTransaction('tenant-1', 'user-1', {
      logId: 'log-booking-partial-1',
      sourceType: PaymentSourceType.INVOICE,
      sourceCode: 'INV-BOOKING-PARTIAL-1',
    }, 'manual-booking-partial-1')).resolves.toMatchObject({ success: true, amount: 400_000 });

    expect(invoicesService.pay).toHaveBeenCalledWith(
      'invoice-booking-partial-1',
      400_000,
      'SEPAY',
      'txn-booking-partial-1',
      'user-1',
      'tenant-1',
    );
    expect(depositsService.collect).not.toHaveBeenCalled();
  });

  it('keeps a manually collected SePay deposit reclaimable when request completion fails', async () => {
    const { service, prisma, depositsService } = createService({
      paymentWebhookLog: {
        upsert: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'log-deposit-retry-1',
          tenantId: 'tenant-1',
          status: 'RECEIVED',
          payload: {
            id: 'txn-deposit-retry-1',
            code: 'PAY-TENANT-DEPOSIT-RETRY-1',
            transferType: 'in',
            transferAmount: 100000,
            accountNumber: '123456789',
          },
        }),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'request-deposit-retry-1' }),
        update: vi.fn().mockRejectedValue(new Error('REQUEST_COMPLETION_FAILED')),
      },
      deposit: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'deposit-retry-1',
          tenantId: 'tenant-1',
          code: 'DEP-RETRY-1',
          amount: 100000,
          status: 'DRAFT',
          roomId: 'room-1',
          room: { buildingId: 'building-1', building: { ownerId: 'owner-a' } },
        }),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'room-1', code: 'R-01', name: 'Room 01', rentalType: 'SHARED', buildingId: 'building-1',
          building: { id: 'building-1', code: 'B-01', name: 'Building 01', ownerId: 'owner-a' },
        }),
      },
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'bank-1', ownerId: 'owner-a', bankName: 'ACB', accountNumber: '123456789', accountName: 'Owner A',
        }),
        findMany: vi.fn().mockResolvedValue([
          { id: 'bank-1', ownerId: 'owner-a', bankName: 'ACB', accountNumber: '123456789', accountName: 'Owner A' },
        ]),
      },
    });
    depositsService.collect.mockResolvedValue({ depositId: 'deposit-retry-1', replayed: false });

    await expect(service.manualAssignSePayTransaction('tenant-1', 'user-1', {
      logId: 'log-deposit-retry-1', sourceType: PaymentSourceType.DEPOSIT, sourceCode: 'DEP-RETRY-1',
    }, 'manual-deposit-retry-1')).rejects.toThrow('REQUEST_COMPLETION_FAILED');

    expect(depositsService.collect).toHaveBeenCalledWith(
      'deposit-retry-1',
      'Manual SePay assignment txn-deposit-retry-1',
      'user-1',
      'sepay:txn-deposit-retry-1',
    );
    expect(prisma.paymentWebhookLog.update).toHaveBeenCalledWith({
      where: { id: 'log-deposit-retry-1' },
      data: expect.objectContaining({ status: 'FAILED', processedAt: undefined }),
    });
  });

  it('replays a manual SePay invoice assignment after request completion fails without another financial command', async () => {
    const logPayload = {
      id: 'txn-invoice-retry-1',
      code: 'PAY-TENANT-INVOICE-RETRY-1',
      transferType: 'in',
      transferAmount: 90000,
      accountNumber: '123456789',
    };
    let storedRequest: any = null;
    let invoiceSettled = false;
    const paymentRows: any[] = [];
    const allocationRows: any[] = [];
    const request = {
      id: 'request-invoice-retry-1',
      tenantId: 'tenant-1',
      provider: PaymentProvider.SEPAY,
      sourceType: PaymentSourceType.INVOICE,
      sourceId: 'invoice-retry-1',
      paymentCode: 'PAY-TENANT-INVOICE-RETRY-1',
      amount: 90000,
      bankAccountNumber: '123456789',
      bankName: 'ACB',
      bankAccountName: 'Owner A',
      bankAccountId: 'bank-1',
      metadata: {},
      status: PaymentRequestStatus.PENDING,
    };
    const { service, prisma, invoicesService } = createService({
      paymentWebhookLog: {
        upsert: vi.fn(),
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'log-invoice-retry-1',
            tenantId: 'tenant-1',
            status: 'RECEIVED',
            payload: logPayload,
          })
          .mockResolvedValueOnce({
            id: 'log-invoice-retry-1',
            tenantId: 'tenant-1',
            status: 'FAILED',
            payload: logPayload,
          }),
        update: vi.fn(),
      },
      paymentRequest: {
        findFirst: vi.fn().mockImplementation(async () => storedRequest),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          storedRequest = { ...request, ...data };
          return storedRequest;
        }),
        update: vi
          .fn()
          .mockRejectedValueOnce(new Error('REQUEST_COMPLETION_FAILED'))
          .mockResolvedValue({}),
      },
      payment: {
        findFirst: vi.fn().mockImplementation(async () =>
          invoiceSettled
            ? {
                id: 'payment-retry-1',
                invoiceId: 'invoice-retry-1',
                amount: 90000,
                status: 'CONFIRMED',
              }
            : null,
        ),
      },
      invoice: {
        findFirst: vi.fn().mockImplementation(async () => ({
          id: 'invoice-retry-1',
          tenantId: 'tenant-1',
          code: 'INV-RETRY-1',
          total: 90000,
          paidAmount: invoiceSettled ? 90000 : 0,
          creditAmount: 0,
          status: invoiceSettled ? 'PAID' : 'ISSUED',
          contract: {
            roomId: 'room-1',
            room: { buildingId: 'building-1', building: { ownerId: 'owner-a' } },
          },
        })),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'room-1', code: 'R-01', name: 'Room 01', rentalType: 'SHARED', buildingId: 'building-1',
          building: { id: 'building-1', code: 'B-01', name: 'Building 01', ownerId: 'owner-a' },
        }),
      },
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'bank-1', ownerId: 'owner-a', bankName: 'ACB', accountNumber: '123456789', accountName: 'Owner A',
        }),
        findMany: vi.fn().mockResolvedValue([
          { id: 'bank-1', ownerId: 'owner-a', bankName: 'ACB', accountNumber: '123456789', accountName: 'Owner A' },
        ]),
      },
    });
    invoicesService.pay.mockImplementation(async () => {
      invoiceSettled = true;
      paymentRows.push({ id: 'payment-retry-1', providerRef: 'txn-invoice-retry-1' });
      allocationRows.push({ paymentId: 'payment-retry-1', invoiceId: 'invoice-retry-1', amount: 90000 });
      return { id: 'invoice-retry-1' };
    });

    const command = () => service.manualAssignSePayTransaction(
      'tenant-1',
      'user-1',
      { logId: 'log-invoice-retry-1', sourceType: PaymentSourceType.INVOICE, sourceCode: 'INV-RETRY-1' },
      'manual-invoice-retry-1',
    );
    await expect(command()).rejects.toThrow('REQUEST_COMPLETION_FAILED');
    await expect(command()).resolves.toMatchObject({ success: true, amount: 90000 });

    expect(invoicesService.pay).toHaveBeenCalledTimes(1);
    expect(invoicesService.pay).toHaveBeenCalledWith(
      'invoice-retry-1', 90000, 'SEPAY', 'txn-invoice-retry-1', 'user-1', 'tenant-1',
    );
    expect(invoiceSettled).toBe(true);
    expect(paymentRows).toHaveLength(1);
    expect(allocationRows).toEqual([
      { paymentId: 'payment-retry-1', invoiceId: 'invoice-retry-1', amount: 90000 },
    ]);
    expect(prisma.creditNote.create).not.toHaveBeenCalled();
    expect(storedRequest.metadata).toMatchObject({
      manualAssigned: true,
      idempotencyKey: 'manual-invoice-retry-1',
      requestHash: expect.any(String),
    });
    expect(prisma.paymentRequest.update).toHaveBeenLastCalledWith({
      where: { id: 'request-invoice-retry-1' },
      data: expect.objectContaining({
        status: PaymentRequestStatus.CONFIRMED,
        providerTransactionId: 'txn-invoice-retry-1',
      }),
    });
    expect(prisma.paymentWebhookLog.update).toHaveBeenLastCalledWith({
      where: { id: 'log-invoice-retry-1' },
      data: expect.objectContaining({ status: 'PROCESSED', tenantId: 'tenant-1' }),
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
            accountNumber: '123456789',
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
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'bank-1',
          ownerId: 'owner-a',
          bankName: 'ACB',
          accountNumber: '123456789',
          accountName: 'Owner A',
        }),
      },
    });

    await expect(
      service.manualAssignSePayTransaction('tenant-1', 'user-1', {
        logId: 'log-1',
        sourceType: PaymentSourceType.DEPOSIT,
        sourceCode: 'DEP-001',
      }, 'manual-deposit-mismatch-1'),
    ).rejects.toThrow('Số tiền giao dịch phải đúng bằng tiền cọc');
  });

  it('resolves invoice overpayment into customer credit balance atomically', async () => {
    const { service, prisma, auditService } = createService({
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
        create: vi.fn().mockResolvedValue({ id: 'journal-over-1' }),
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
    expect(prisma.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
        sourceType: 'ADJUSTMENT',
        sourceId: 'credit-note-1',
        lines: { create: [
          expect.objectContaining({ tenantId: 'tenant-1', accountId: 'bank-account', type: 'DEBIT', amount: 20000 }),
          expect.objectContaining({ tenantId: 'tenant-1', accountId: 'liability-account', type: 'CREDIT', amount: 20000 }),
        ] },
        }),
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
    expect(prisma.receipt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        amount: 50000,
        status: 'PENDING',
      }),
    });
    expect(prisma.journalEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        code: 'JE-SEPAY-OVERPAY-PENDING-log-over-2',
        sourceType: 'ADJUSTMENT',
        sourceId: 'deposit-1',
        lines: {
          create: [
            expect.objectContaining({ tenantId: 'tenant-1', accountId: 'bank-account', type: 'DEBIT', amount: 50000 }),
            expect.objectContaining({ tenantId: 'tenant-1', accountId: 'liability-account', type: 'CREDIT', amount: 50000 }),
          ],
        },
      }),
    }));
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

  it('requires proof before completing an overpayment refund', async () => {
    const { service, prisma } = createService({
      paymentWebhookLog: {
        upsert: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'log-over-proof-1',
          tenantId: 'tenant-1',
          payload: {
            id: 'txn-over-proof-1',
            code: 'PAY-TENANT-OVER-PROOF-001',
            transferType: 'in',
            transferAmount: 180000,
            overpaymentResolution: 'REFUND_PENDING',
            overpaymentAmount: 30000,
          },
        }),
      },
      paymentRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-over-proof-1',
          tenantId: 'tenant-1',
          sourceType: PaymentSourceType.INVOICE,
          sourceId: 'invoice-proof-1',
          paymentCode: 'PAY-TENANT-OVER-PROOF-001',
          amount: 150000,
          metadata: {
            overpaymentResolution: 'REFUND_PENDING',
            overpaymentAmount: 30000,
          },
        }),
      },
      task: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'task-over-proof-1',
          tenantId: 'tenant-1',
          status: 'TODO',
        }),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    });

    await expect(service.completeSePayOverpaymentRefund('tenant-1', 'user-1', {
      logId: 'log-over-proof-1',
      note: 'Đã hoàn tiền nhưng chưa có chứng từ',
    })).rejects.toThrow('SEPAY_OVERPAYMENT_REFUND_PROOF_REQUIRED');

    expect(prisma.receipt.create).not.toHaveBeenCalled();
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
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
        attachmentUrls: ['/documents/storage/tenant-1/sepay-refunds/txn-over-3.jpg'],
      }),
    ).resolves.toMatchObject({
      success: true,
      paymentCode: 'PAY-TENANT-OVER-003',
      taskId: 'task-over-3',
      overpaymentAmount: 30000,
    });

    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'task-over-3', tenantId: 'tenant-1' }),
      data: expect.objectContaining({
        status: 'DONE',
      }),
    });
    expect(prisma.paymentRequest.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'request-over-3',
        tenantId: 'tenant-1',
      }),
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          overpaymentRefundCompletedBy: 'user-1',
          overpaymentRefundCompletionNote: 'Da chuyen khoan hoan du',
          overpaymentRefundAttachmentUrls: [
            '/documents/storage/tenant-1/sepay-refunds/txn-over-3.jpg',
          ],
        }),
      }),
    });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.journalEntry.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'JE-SEPAY-OVERPAY-PENDING-log-over-3',
          lines: {
            create: [
              expect.objectContaining({ tenantId: 'tenant-1', accountId: 'bank-account', type: 'DEBIT', amount: 30000 }),
              expect.objectContaining({ tenantId: 'tenant-1', accountId: 'liability-account', type: 'CREDIT', amount: 30000 }),
            ],
          },
        }),
      }),
    );
    expect(prisma.journalEntry.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'JE-SEPAY-OVERPAY-REFUND-log-over-3',
          lines: {
            create: [
              expect.objectContaining({ tenantId: 'tenant-1', accountId: 'liability-account', type: 'DEBIT', amount: 30000 }),
              expect.objectContaining({ tenantId: 'tenant-1', accountId: 'bank-account', type: 'CREDIT', amount: 30000 }),
            ],
          },
        }),
      }),
    );
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
