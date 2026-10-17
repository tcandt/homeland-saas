import { BadRequestException } from '@nestjs/common';
import { DepositStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DepositsService } from './deposits.service';

describe('DepositsService', () => {
  function createService(depositCoreService?: any) {
    const repository = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      paginate: vi.fn(),
    };
    const prisma: any = {
      deposit: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      receipt: {
        findFirst: vi.fn(),
      },
      task: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      tx: {
        deposit: {
          update: vi.fn(),
        },
        receipt: {
          create: vi.fn(),
          update: vi.fn(),
        },
        task: {
          create: vi.fn(),
          update: vi.fn(),
        },
        depositOperation: {
          findFirst: vi.fn(),
        },
        depositLedgerEntry: {
          findFirst: vi.fn(),
        },
        $transaction: vi.fn((callback) => callback(prisma.tx)),
        $queryRaw: vi.fn().mockResolvedValue([{ id: 'rental' }]),
        contract: { findFirst: vi.fn() },
      },
    };
    const auditService = { log: vi.fn().mockResolvedValue(true) };
    const eventPublisher = { publish: vi.fn() };
    return {
      prisma,
      repository,
      auditService,
      eventPublisher,
      service: new DepositsService(
        repository as any,
        auditService as any,
        eventPublisher as any,
        prisma as any,
        depositCoreService as any,
      ),
    };
  }

  it('blocks a separate cash collection when security is covered by the combined entry invoice', async () => {
    const depositCoreService = { collect: vi.fn() };
    const { service } = createService(depositCoreService);
    vi.spyOn(service, 'getDetail').mockResolvedValue({
      id: 'security-1',
      type: 'SECURITY',
      status: DepositStatus.PENDING,
      contract: {
        termsSnapshot: {
          initialEntryInvoice: {
            invoiceId: 'entry-1',
            paymentPolicyVersion: 'BOOKING_ENTRY_COMBINED_V1',
            securityDepositId: 'security-1',
          },
        },
      },
    } as any);

    await expect(service.collect('security-1', null, 'user-1', 'cash-security-1'))
      .rejects.toThrow('Thu tiền một lần trên hóa đơn liên kết');
    expect(depositCoreService.collect).not.toHaveBeenCalled();
  });

  describe('booking conversion deposit list', () => {
    it('does not generate security deposits for booking-hold or deleted contracts', async () => {
      const { service, prisma } = createService();
      prisma.contract = {
        findMany: vi.fn().mockResolvedValue([
          { id: 'booking', tenantId: 'tenant-1', code: 'HD-COC-PN-1', depositMoney: 1_000_000 },
          { id: 'booking-purpose', tenantId: 'tenant-1', code: 'OTHER', purpose: 'Cọc giữ phòng', depositMoney: 1_000_000 },
          { id: 'converted', tenantId: 'tenant-1', code: 'OLD', depositMoney: 1_000_000, termsSnapshot: { bookingConversion: { rentalContractId: 'rental' } } },
          { id: 'rental', tenantId: 'tenant-1', code: 'HD-THUE-1', depositMoney: 8_000_000, status: 'DRAFT', termsSnapshot: { convertedFromBookingHold: { sourceContractId: 'booking' } } },
        ]),
      };
      prisma.tx.contract.findFirst.mockResolvedValue({
        id: 'rental', tenantId: 'tenant-1', code: 'HD-THUE-1', roomId: 'room-1', customerId: 'customer-1',
        rentalCycleId: null, depositMoney: 8_000_000, status: 'DRAFT', termsSnapshot: { convertedFromBookingHold: { sourceContractId: 'booking' } },
      });
      prisma.tx.deposit.create = vi.fn().mockResolvedValue({});

      await service.syncMissingContractDeposits('tenant-1');

      expect(prisma.contract.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', deletedAt: null }),
      }));
      expect(prisma.tx.deposit.create).toHaveBeenCalledTimes(1);
      expect(prisma.tx.deposit.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ contractId: 'rental', amount: 8_000_000, type: 'SECURITY' }),
      }));
    });

    it('excludes only unreferenced generated booking duplicates before pagination', async () => {
      const { service, prisma, repository } = createService();
      prisma.contract = { findMany: vi.fn().mockResolvedValue([]) };
      const source = { code: 'HD-COC-1', termsSnapshot: { bookingConversion: { status: 'RENTAL_CONTRACT_CREATED', rentalContractId: 'rental' } } };
      prisma.deposit.findMany.mockResolvedValue([
        { id: 'generated', code: 'DC-HD-COC-1', contract: source },
        { id: 'referenced', code: 'DC-HD-COC-1', contract: source },
        { id: 'manual', code: 'MANUAL-SECURITY', contract: source },
        { id: 'unlinked', code: 'DC-HD-COC-1', contract: { ...source, termsSnapshot: { bookingConversion: { status: 'RENTAL_CONTRACT_CREATED' } } } },
      ]);
      prisma.paymentRequest = { findMany: vi.fn().mockResolvedValue([{ sourceId: 'referenced' }]) };
      repository.paginate.mockResolvedValue({ data: [{ id: 'security' }, { id: 'booking' }], meta: { total: 12 } });

      const result = await service.listDeposits(2, 10, 'Hanh', undefined, undefined, undefined, undefined, 'building-1', 'tenant-1');

      expect(result).toEqual({ items: [{ id: 'security' }, { id: 'booking' }], total: 12 });
      expect(prisma.deposit.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1', deletedAt: null, type: 'SECURITY',
          status: { in: ['DRAFT', 'PENDING'] },
          ledgerEntries: { none: {} }, sourceOperations: { none: {} }, targetOperations: { none: {} }, roomHolds: { none: {} },
          contract: { is: expect.objectContaining({ tenantId: 'tenant-1', deletedAt: null }) },
        }),
      }));
      expect(prisma.paymentRequest.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', sourceType: 'DEPOSIT', sourceId: { in: ['generated', 'referenced'] } },
        select: { sourceId: true },
      });
      expect(repository.paginate).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', id: { notIn: ['generated'] }, room: { buildingId: 'building-1' }, OR: expect.any(Array) }),
        2, 10, { createdAt: 'desc' },
        expect.objectContaining({
          customer: { select: expect.objectContaining({ idImages: true }) },
          contract: { select: expect.objectContaining({ status: true, attachments: true }) },
        }),
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('applies the same duplicate exclusion to pipeline counts', async () => {
      const { service, prisma } = createService();
      prisma.deposit.findMany.mockResolvedValueOnce([
        { id: 'generated', code: 'DC-HD-COC-1', contract: { code: 'HD-COC-1', termsSnapshot: { bookingConversion: { rentalContractId: 'rental' } } } },
      ]).mockResolvedValueOnce([]);
      prisma.paymentRequest = { findMany: vi.fn().mockResolvedValue([]) };

      await service.getDepositStats('tenant-1');

      expect(prisma.deposit.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
        where: { tenantId: 'tenant-1', deletedAt: null, id: { notIn: ['generated'] } },
      }));
    });
  });

  it('returns authoritative ledger balance and pending refund operation in deposit detail', async () => {
    const depositCoreService = { getBalance: vi.fn().mockResolvedValue(2_500_000) };
    const { service, repository, prisma } = createService(depositCoreService);
    repository.findById.mockResolvedValue({
      id: 'deposit-ledger-1',
      tenantId: 'tenant-1',
      code: 'DEP-LEDGER-001',
      amount: 5_000_000,
      status: DepositStatus.CANCELLED,
    });
    prisma.receipt.findFirst.mockResolvedValue({
      id: 'receipt-1',
      status: 'PENDING',
      amount: 2_500_000,
    });
    prisma.task.findFirst.mockResolvedValue(null);
    prisma.tx.depositOperation.findFirst.mockResolvedValue({
      id: 'operation-1',
      receiptId: 'receipt-1',
      status: 'PENDING',
      result: { attachmentUrls: ['document-storage://tenant-1/deposit-refunds/proof.jpg'] },
      createdAt: new Date(),
    });

    await expect(service.getDetail('deposit-ledger-1')).resolves.toEqual(
      expect.objectContaining({
        availableBalance: 2_500_000,
        pendingOperationId: 'operation-1',
        refundSummary: expect.objectContaining({
          operationId: 'operation-1',
          receiptId: 'receipt-1',
          pending: true,
          attachmentUrls: ['document-storage://tenant-1/deposit-refunds/proof.jpg'],
        }),
      }),
    );
    expect(depositCoreService.getBalance).toHaveBeenCalledWith('tenant-1', 'deposit-ledger-1');
    expect(prisma.tx.depositOperation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          sourceDepositId: 'deposit-ledger-1',
          status: 'PENDING',
        }),
      }),
    );
  });

  it('requires recovery for a fully funded booking hold that has expired', async () => {
    const depositCoreService = { getBalance: vi.fn().mockResolvedValue(1_000_000) };
    const { service, repository, prisma } = createService(depositCoreService);
    repository.findById.mockResolvedValue({
      id: 'booking-1', tenantId: 'tenant-1', code: 'DEP-BOOKING-1', type: 'BOOKING',
      amount: 1_000_000, status: DepositStatus.PAID, contractId: 'contract-1',
      customerId: 'customer-1', rentalCycleId: 'cycle-1',
      contract: { termsSnapshot: { bookingCommand: { depositId: 'booking-1', invoiceId: 'invoice-1' } } },
    });
    prisma.invoice = {
      findFirst: vi.fn().mockResolvedValue({
        id: 'invoice-1', total: 1_000_000, paidAmount: 1_000_000, creditAmount: 0, status: 'PAID',
      }),
      findMany: vi.fn().mockResolvedValue([]),
    };
    prisma.roomHold = { findFirst: vi.fn().mockResolvedValue({ status: 'ACTIVE', expiresAt: new Date('2026-09-01T00:00:00.000Z') }) };

    await expect(service.getDetail('booking-1')).resolves.toMatchObject({
      bookingHold: { fundedInvalidAggregate: false, validPartialActive: false, requiresRecovery: true },
    });
  });

  it('flags NAS-style booking invoice cash that is absent from the ledger, while retaining a valid active partial hold', async () => {
    const depositCoreService = { getBalance: vi.fn() };
    const { service, repository, prisma } = createService(depositCoreService);
    const deposit = {
      id: 'booking-1', tenantId: 'tenant-1', code: 'DEP-BOOKING-1', type: 'BOOKING',
      amount: 1_000_000, status: DepositStatus.PENDING, contractId: 'contract-1',
      customerId: 'customer-1', rentalCycleId: 'cycle-1',
      contract: { termsSnapshot: { bookingCommand: { depositId: 'booking-1', invoiceId: 'invoice-1' } } },
    };
    repository.findById.mockResolvedValue(deposit);
    prisma.invoice = {
      findFirst: vi.fn()
        .mockResolvedValueOnce({ id: 'invoice-1', total: 1_000_000, paidAmount: 1_000_000, creditAmount: 0, status: 'PAID' })
        .mockResolvedValueOnce({ id: 'invoice-1', total: 1_000_000, paidAmount: 400_000, creditAmount: 0, status: 'PARTIALLY_PAID' }),
      findMany: vi.fn().mockResolvedValue([]),
    };
    prisma.roomHold = { findFirst: vi.fn().mockResolvedValue({ status: 'ACTIVE', expiresAt: new Date('2099-09-01T00:00:00.000Z') }) };
    depositCoreService.getBalance.mockResolvedValueOnce(0).mockResolvedValueOnce(400_000);

    await expect(service.getDetail('booking-1')).resolves.toMatchObject({
      bookingHold: { fundedInvalidAggregate: true, validPartialActive: false, requiresRecovery: true },
    });
    await expect(service.getDetail('booking-1')).resolves.toMatchObject({
      bookingHold: { fundedInvalidAggregate: false, validPartialActive: true, requiresRecovery: false },
    });
  });

  it('accepts terminal booking disposition only with a completed cancellation or conversion operation', async () => {
    const depositCoreService = { getBalance: vi.fn().mockResolvedValue(0) };
    const { service, repository, prisma } = createService(depositCoreService);
    const deposit = {
      id: 'booking-terminal-1', tenantId: 'tenant-1', type: 'BOOKING',
      amount: 1_000_000, status: DepositStatus.CANCELLED, contractId: 'contract-1',
      customerId: 'customer-1', rentalCycleId: 'cycle-1',
      contract: { termsSnapshot: { bookingCommand: { depositId: 'booking-terminal-1', invoiceId: 'invoice-1' } } },
    };
    repository.findById.mockResolvedValue(deposit);
    prisma.invoice = {
      findFirst: vi.fn().mockResolvedValue({
        id: 'invoice-1', total: 1_000_000, paidAmount: 1_000_000, creditAmount: 0, status: 'PAID',
      }),
      findMany: vi.fn().mockResolvedValue([]),
    };
    prisma.tx.depositOperation.findFirst.mockResolvedValue({
      id: 'operation-cancel-1', type: 'CANCEL', result: { refundAmount: 0, keepAmount: 1_000_000, deductAmount: 0 }, receiptId: null,
    });

    await expect(service.getDetail('booking-terminal-1')).resolves.toMatchObject({
      bookingHold: { fundedInvalidAggregate: false, requiresRecovery: false },
    });
    expect(prisma.tx.depositOperation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ type: { in: ['CANCEL', 'CONVERT_TO_SECURITY'] } }),
    }));

    prisma.tx.depositOperation.findFirst.mockResolvedValue(null);
    await expect(service.getDetail('booking-terminal-1')).resolves.toMatchObject({
      bookingHold: { fundedInvalidAggregate: true, requiresRecovery: true },
    });

    prisma.tx.depositOperation.findFirst.mockResolvedValue({ id: 'operation-convert-1', type: 'CONVERT_TO_SECURITY' });
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'invoice-1', total: 999_999, paidAmount: 1_000_000, creditAmount: 0, status: 'PAID',
    });
    await expect(service.getDetail('booking-terminal-1')).resolves.toMatchObject({
      bookingHold: { fundedInvalidAggregate: true, requiresRecovery: true },
    });
  });

  it('accepts a partially funded completed cancellation only with canonical closure and conserved allocations', async () => {
    const depositCoreService = { getBalance: vi.fn().mockResolvedValue(0) };
    const { service, repository, prisma } = createService(depositCoreService);
    repository.findById.mockResolvedValue({
      id: 'booking-partial-cancel-1', tenantId: 'tenant-1', code: 'DEP-PARTIAL-1', type: 'BOOKING',
      amount: 1_000_000, status: DepositStatus.CANCELLED, contractId: 'contract-1', customerId: 'customer-1', rentalCycleId: 'cycle-1',
      contract: { termsSnapshot: { bookingCommand: { depositId: 'booking-partial-cancel-1', invoiceId: 'invoice-1' } } },
    });
    prisma.invoice = {
      findFirst: vi.fn().mockResolvedValue({ id: 'invoice-1', total: 1_000_000, paidAmount: 400_000, creditAmount: 0, status: 'PARTIALLY_PAID' }),
      findMany: vi.fn().mockResolvedValue([{
        id: 'adjustment-1', adjustmentOfInvoiceId: 'invoice-1', billingKind: 'CREDIT_ADJUSTMENT', total: 600_000,
        paidAmount: 0, creditAmount: 0, status: 'ISSUED',
      }]),
    };
    const completed = {
      id: 'cancel-1', type: 'CANCEL', receiptId: null,
      result: { refundAmount: 0, keepAmount: 150_000, deductAmount: 250_000 },
    };
    prisma.tx.depositOperation.findFirst.mockImplementation(async ({ where }: any) =>
      where.status === 'COMPLETED' ? completed : null,
    );

    await expect(service.getDetail('booking-partial-cancel-1')).resolves.toMatchObject({
      bookingInvoice: { remainingAmount: 0 },
      bookingHold: { fundedInvalidAggregate: false, requiresRecovery: false },
    });

    completed.result.deductAmount = 249_999;
    await expect(service.getDetail('booking-partial-cancel-1')).resolves.toMatchObject({
      bookingHold: { fundedInvalidAggregate: true, requiresRecovery: true },
    });
  });

  it('keeps a fully evidenced pending booking refund out of recovery until completion', async () => {
    const depositCoreService = { getBalance: vi.fn().mockResolvedValue(400_000) };
    const { service, repository, prisma } = createService(depositCoreService);
    repository.findById.mockResolvedValue({
      id: 'booking-pending-refund-1', tenantId: 'tenant-1', code: 'DEP-PENDING-1', type: 'BOOKING',
      amount: 1_000_000, status: DepositStatus.CANCELLED, contractId: 'contract-1', customerId: 'customer-1', rentalCycleId: 'cycle-1',
      contract: { termsSnapshot: { bookingCommand: { depositId: 'booking-pending-refund-1', invoiceId: 'invoice-1' } } },
    });
    prisma.invoice = {
      findFirst: vi.fn().mockResolvedValue({ id: 'invoice-1', total: 1_000_000, paidAmount: 400_000, creditAmount: 0, status: 'PARTIALLY_PAID' }),
      findMany: vi.fn().mockResolvedValue([{
        id: 'adjustment-1', adjustmentOfInvoiceId: 'invoice-1', billingKind: 'CREDIT_ADJUSTMENT', total: 600_000,
        paidAmount: 0, creditAmount: 0, status: 'ISSUED',
      }]),
    };
    const pending = {
      id: 'cancel-pending-1', type: 'CANCEL', receiptId: 'receipt-pending-1',
      result: { refundAmount: 400_000, keepAmount: 0, deductAmount: 0 },
    };
    prisma.tx.depositOperation.findFirst.mockImplementation(async ({ where }: any) =>
      where.status === 'PENDING' || !where.status ? pending : null,
    );
    prisma.receipt.findFirst.mockResolvedValue({ id: 'receipt-pending-1', amount: 400_000, status: 'PENDING' });

    await expect(service.getDetail('booking-pending-refund-1')).resolves.toMatchObject({
      pendingOperationId: 'cancel-pending-1',
      bookingHold: { fundedInvalidAggregate: false, requiresRecovery: false },
    });
  });

  it('accepts a completed pending-refund ledger only when its completion operation and receipt agree', async () => {
    const depositCoreService = { getBalance: vi.fn().mockResolvedValue(0) };
    const { service, repository, prisma } = createService(depositCoreService);
    repository.findById.mockResolvedValue({
      id: 'booking-completed-refund-1', tenantId: 'tenant-1', code: 'DEP-COMPLETE-1', type: 'BOOKING',
      amount: 1_000_000, status: DepositStatus.CANCELLED, contractId: 'contract-1', customerId: 'customer-1', rentalCycleId: 'cycle-1',
      contract: { termsSnapshot: { bookingCommand: { depositId: 'booking-completed-refund-1', invoiceId: 'invoice-1' } } },
    });
    prisma.invoice = {
      findFirst: vi.fn().mockResolvedValue({ id: 'invoice-1', total: 1_000_000, paidAmount: 400_000, creditAmount: 0, status: 'PARTIALLY_PAID' }),
      findMany: vi.fn().mockResolvedValue([{
        id: 'adjustment-1', adjustmentOfInvoiceId: 'invoice-1', billingKind: 'CREDIT_ADJUSTMENT', total: 600_000,
        paidAmount: 0, creditAmount: 0, status: 'ISSUED',
      }]),
    };
    const cancelled = {
      id: 'cancel-completed-1', type: 'CANCEL', receiptId: 'receipt-completed-1',
      result: { refundAmount: 400_000, keepAmount: 0, deductAmount: 0 },
    };
    prisma.tx.depositOperation.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.type === 'COMPLETE_REFUND') return { id: 'completion-1' };
      if (where.status === 'COMPLETED' || !where.status) return cancelled;
      return null;
    });
    prisma.receipt.findFirst.mockResolvedValue({ id: 'receipt-completed-1', amount: 400_000, status: 'COMPLETED' });
    prisma.tx.depositLedgerEntry.findFirst.mockResolvedValue({ operationId: 'completion-1' });

    await expect(service.getDetail('booking-completed-refund-1')).resolves.toMatchObject({
      bookingHold: { fundedInvalidAggregate: false, requiresRecovery: false },
    });
  });

  it('blocks cancelling paid deposits without an explicit resolution action', async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue({
      id: 'deposit-1',
      tenantId: 'tenant-1',
      status: DepositStatus.PAID,
    });

    await expect(service.cancel('deposit-1', 'Khach huy', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('routes every marked modern pending booking cancellation through the core command', async () => {
    const depositCoreService = { getBalance: vi.fn().mockResolvedValue(400_000) };
    const { service, repository, prisma } = createService(depositCoreService);
    const deposit = {
      id: 'booking-pending-1', tenantId: 'tenant-1', type: 'BOOKING', amount: 1_000_000,
      status: DepositStatus.PENDING, contractId: 'contract-1', customerId: 'customer-1', rentalCycleId: 'cycle-1',
      contract: { termsSnapshot: { bookingCommand: { depositId: 'booking-pending-1', invoiceId: 'invoice-1' } } },
    };
    repository.findById.mockResolvedValue(deposit);

    await expect(service.cancel('booking-pending-1', 'Khach huy', 'user-1'))
      .rejects.toThrow('BOOKING_HOLD_FUNDED_CANCELLATION_REQUIRES_CORE_COMMAND');
    expect(repository.update).not.toHaveBeenCalled();
    expect(prisma.tx.deposit.update).not.toHaveBeenCalled();

    depositCoreService.getBalance.mockResolvedValue(0);
    prisma.invoice = { findFirst: vi.fn().mockResolvedValue({
      id: 'invoice-1', total: 1_000_000, paidAmount: 1_000_000, creditAmount: 0, status: 'PAID',
    }) };
    await expect(service.cancel('booking-pending-1', 'Khach huy', 'user-1'))
      .rejects.toThrow('BOOKING_HOLD_FUNDED_CANCELLATION_REQUIRES_CORE_COMMAND');
    expect(repository.update).not.toHaveBeenCalled();
    expect(prisma.tx.deposit.update).not.toHaveBeenCalled();

    prisma.invoice.findFirst.mockResolvedValue({
      id: 'invoice-1', total: 1_000_000, paidAmount: 0, creditAmount: 0, status: 'ISSUED',
    });
    await expect(service.cancel('booking-pending-1', 'Khach huy', 'user-1'))
      .rejects.toThrow('BOOKING_HOLD_FUNDED_CANCELLATION_REQUIRES_CORE_COMMAND');
    expect(repository.update).not.toHaveBeenCalled();
    expect(prisma.tx.deposit.update).not.toHaveBeenCalled();
  });

  it('publishes a deposit.created event when creating a deposit', async () => {
    const { service, repository, auditService, eventPublisher } = createService();
    repository.create.mockResolvedValue({ id: 'deposit-1' });
    repository.findById.mockResolvedValue({
      id: 'deposit-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      code: 'DEP-001',
      amount: 1500000,
      customer: {
        fullName: 'Nguyen Van A',
        phone: '0909000001',
      },
      room: {
        code: '31-01',
        building: {
          name: 'LK01-31',
        },
      },
    });

    const payload = {
      tenant: { connect: { id: 'tenant-1' } },
      customer: { connect: { id: 'customer-1' } },
      amount: 1500000,
    };

    const result = await service.create(payload, 'user-1', 'Deposits');

    expect(result).toMatchObject({ id: 'deposit-1' });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'Deposit',
        entityId: 'deposit-1',
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.created',
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        customerId: 'customer-1',
        customerName: 'Nguyen Van A',
        customerPhone: '0909000001',
        sourceId: 'deposit-1',
        sourceType: 'DEPOSIT',
        amount: 1500000,
        metadata: expect.objectContaining({
          code: 'DEP-001',
          roomCode: '31-01',
          buildingName: 'LK01-31',
        }),
      }),
    );
  });

  it('creates and links a planned RentalCycle for a booking deposit without a contract', async () => {
    const { service, repository, prisma } = createService();
    repository.create.mockResolvedValue({
      id: 'deposit-1', tenantId: 'tenant-1', customerId: 'customer-1', roomId: 'room-1',
      contractId: null, rentalCycleId: null, status: DepositStatus.PENDING,
    });
    repository.findById.mockResolvedValue({
      id: 'deposit-1', tenantId: 'tenant-1', customerId: 'customer-1', code: 'DEP-1', amount: 1000,
      customer: {}, room: {},
    });
    prisma.tx.rentalCycle = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'cycle-1' }),
    };
    prisma.tx.contract = { findFirst: vi.fn() };
    prisma.tx.deposit.update.mockResolvedValue({ id: 'deposit-1', rentalCycleId: 'cycle-1' });

    await service.create({ customerId: 'customer-1', roomId: 'room-1', amount: 1000 });

    expect(prisma.tx.rentalCycle.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PLANNED' }),
    }));
    expect(prisma.tx.deposit.update).toHaveBeenCalledWith({
      where: { id: 'deposit-1' }, data: { rentalCycleId: 'cycle-1' },
    });
  });

  it('never reuses a terminal RentalCycle when a returning customer creates a new deposit', async () => {
    const { service, repository, prisma } = createService();
    repository.create.mockResolvedValue({
      id: 'deposit-new', tenantId: 'tenant-1', customerId: 'customer-1', roomId: 'room-1',
      contractId: null, rentalCycleId: null, status: DepositStatus.PENDING,
    });
    repository.findById.mockResolvedValue({
      id: 'deposit-new', tenantId: 'tenant-1', customerId: 'customer-1', code: 'DEP-NEW', amount: 1000,
      customer: {}, room: {},
    });
    prisma.tx.rentalCycle = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'cycle-new' }),
    };
    prisma.tx.contract = { findFirst: vi.fn() };
    prisma.tx.deposit.update.mockResolvedValue({ id: 'deposit-new', rentalCycleId: 'cycle-new' });

    await service.create({ customerId: 'customer-1', roomId: 'room-1', amount: 1000 });

    expect(prisma.tx.rentalCycle.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        customerId: 'customer-1',
        roomId: 'room-1',
        status: { in: ['PLANNED', 'RESERVED'] },
      }),
    }));
    expect(prisma.tx.rentalCycle.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customerId: 'customer-1', roomId: 'room-1', status: 'PLANNED' }),
    }));
    expect(prisma.tx.deposit.update).toHaveBeenCalledWith({
      where: { id: 'deposit-new' }, data: { rentalCycleId: 'cycle-new' },
    });
  });

  it('allows cancelling paid deposits when refund keep or deduct resolution is provided', async () => {
    const { service, repository, auditService, prisma } = createService();
    const deposit = {
      id: 'deposit-1',
      tenantId: 'tenant-1',
      code: 'DEP-CANCEL-001',
      amount: 1000000,
      status: DepositStatus.PAID,
      customer: {
        fullName: 'Nguyen Van A',
        phone: '0909000001',
      },
    };
    repository.findById.mockResolvedValue(deposit);
    prisma.tx.deposit.update.mockResolvedValue({ ...deposit, status: DepositStatus.CANCELLED, note: '[REFUND] Khach huy\nHoàn lại 1,000,000 VND' });
    prisma.tx.receipt.create.mockResolvedValue({
      id: 'receipt-cancel-1',
      code: 'RCT-DEP-CANCEL-001-REFUND-1',
      amount: 1000000,
      status: 'PENDING',
      description: 'Deposit cancellation refund for DEP-CANCEL-001 - Khach huy',
    });
    prisma.tx.task.create.mockResolvedValue({
      id: 'task-cancel-1',
      title: 'Xu ly hoan coc DEP-CANCEL-001',
      status: 'TODO',
    });

    await expect(service.cancel('deposit-1', 'Khach huy', 'user-1', 'REFUND')).resolves.toMatchObject({
      status: DepositStatus.CANCELLED,
      note: expect.stringContaining('[REFUND] Khach huy'),
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CANCEL',
        entity: 'Deposit',
        entityId: 'deposit-1',
      }),
    );
  });

  it('publishes a deposit.refunded event when refunding a paid deposit immediately', async () => {
    const { service, repository, auditService, eventPublisher, prisma } = createService();
    const deposit = {
      id: 'deposit-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      code: 'DEP-001',
      amount: 1500000,
      status: DepositStatus.PAID,
      note: null,
      customer: {
        fullName: 'Nguyen Van A',
        phone: '0909000001',
      },
    };

    repository.findById.mockResolvedValue(deposit);
    prisma.tx.deposit.update.mockResolvedValue({
      ...deposit,
      status: DepositStatus.REFUNDED,
      note: 'Tra coc',
    });
    prisma.tx.receipt.create.mockResolvedValue({
      id: 'receipt-1',
      code: 'RCT-DEP-001-REFUND-1',
      amount: 1500000,
      status: 'COMPLETED',
      description: 'Deposit refund for DEP-001 - Tra coc',
    });

    await expect(service.refund(
      'deposit-1',
      'Tra coc',
      'user-1',
      'COMPLETED',
      ['document-storage://tenant-1/deposit-refunds/refund-1.jpg'],
    )).resolves.toMatchObject({
      status: DepositStatus.REFUNDED,
      note: 'Tra coc',
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REFUND',
        entity: 'Deposit',
        entityId: 'deposit-1',
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.refunded',
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        customerId: 'customer-1',
        customerName: 'Nguyen Van A',
        customerPhone: '0909000001',
        sourceId: 'deposit-1',
        sourceType: 'REFUND',
        amount: 1500000,
        paymentProvider: 'MANUAL',
        metadata: expect.objectContaining({
          code: 'DEP-001',
          note: 'Tra coc',
          refundSourceType: 'DEPOSIT',
        }),
      }),
    );
  });

  it('creates a pending receipt and follow-up task when deposit refund is not completed yet', async () => {
    const { service, repository, eventPublisher, prisma } = createService();
    const deposit = {
      id: 'deposit-2',
      tenantId: 'tenant-1',
      customerId: 'customer-2',
      code: 'DEP-002',
      amount: 2300000,
      status: DepositStatus.PAID,
      note: null,
      customer: {
        fullName: 'Tran Thi B',
        phone: '0909000002',
      },
    };

    repository.findById.mockResolvedValue(deposit);
    prisma.tx.deposit.update.mockResolvedValue({
      ...deposit,
      status: DepositStatus.REFUNDED,
      note: 'Hoan coc theo yeu cau',
    });
    prisma.tx.receipt.create.mockResolvedValue({
      id: 'receipt-2',
      code: 'RCT-DEP-002-REFUND-1',
      amount: 2300000,
      status: 'PENDING',
      description: 'Deposit refund for DEP-002 - Hoan coc theo yeu cau',
    });
    prisma.tx.task.create.mockResolvedValue({
      id: 'task-2',
      title: 'Xu ly hoan coc DEP-002',
      status: 'TODO',
    });

    await expect(
      service.refund('deposit-2', 'Hoan coc theo yeu cau', 'user-1', 'PENDING', ['https://example.test/deposit-proof.pdf']),
    ).resolves.toMatchObject({
      status: DepositStatus.REFUNDED,
    });

    expect(prisma.tx.receipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
        }),
      }),
    );
    expect(prisma.tx.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'TODO',
          priority: 'HIGH',
        }),
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.refund_requested',
      expect.objectContaining({
        sourceId: 'deposit-2',
        metadata: expect.objectContaining({
          code: 'DEP-002',
          receiptCode: 'RCT-DEP-002-REFUND-1',
          attachmentUrls: ['https://example.test/deposit-proof.pdf'],
        }),
      }),
    );
    expect(eventPublisher.publish).not.toHaveBeenCalledWith('deposit.refunded', expect.anything());
  });

  it('supports partial deposit refund and records retained amount in metadata', async () => {
    const { service, repository, eventPublisher, prisma } = createService();
    const deposit = {
      id: 'deposit-2b',
      tenantId: 'tenant-1',
      customerId: 'customer-2',
      code: 'DEP-002B',
      amount: 2300000,
      status: DepositStatus.PAID,
      note: null,
      customer: {
        fullName: 'Tran Thi B',
        phone: '0909000002',
      },
    };

    repository.findById.mockResolvedValue(deposit);
    prisma.tx.deposit.update.mockResolvedValue({
      ...deposit,
      status: DepositStatus.REFUNDED,
      note: 'Hoan mot phan',
    });
    prisma.tx.receipt.create.mockResolvedValue({
      id: 'receipt-2b',
      code: 'RCT-DEP-002B-REFUND-1',
      amount: 1800000,
      status: 'COMPLETED',
      description: 'Deposit refund for DEP-002B - Hoan mot phan (retain 500,000 VND)',
    });

    await expect(
      service.refund(
        'deposit-2b',
        'Hoan mot phan',
        'user-1',
        'COMPLETED',
        ['document-storage://tenant-1/deposit-refunds/refund-2b.pdf'],
        1800000,
      ),
    ).resolves.toMatchObject({
      status: DepositStatus.REFUNDED,
    });

    expect(prisma.tx.receipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 1800000,
        }),
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.refunded',
      expect.objectContaining({
        amount: 1800000,
        metadata: expect.objectContaining({
          originalAmount: 2300000,
          refundAmount: 1800000,
          retainedAmount: 500000,
        }),
      }),
    );
  });

  it('rejects refund amount greater than deposit amount', async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue({
      id: 'deposit-over',
      tenantId: 'tenant-1',
      customerId: 'customer-2',
      code: 'DEP-OVER',
      amount: 1000000,
      status: DepositStatus.PAID,
    });

    await expect(service.refund('deposit-over', 'Vuot muc', 'user-1', 'COMPLETED', [], 1200000)).rejects.toThrow(
      'DEPOSIT_REFUND_AMOUNT_INVALID',
    );
  });

  it('completes a pending deposit refund and publishes deposit.refunded', async () => {
    const { service, repository, eventPublisher, prisma } = createService();
    const deposit = {
      id: 'deposit-3',
      tenantId: 'tenant-1',
      customerId: 'customer-3',
      code: 'DEP-003',
      amount: 1800000,
      status: DepositStatus.REFUNDED,
      note: 'Dang cho xu ly',
      customer: {
        fullName: 'Le Van C',
        phone: '0909000003',
      },
    };

    repository.findById.mockResolvedValue(deposit);
    prisma.receipt.findFirst.mockResolvedValue({
      id: 'receipt-3',
      code: 'RCT-DEP-003-REFUND-1',
      amount: 1800000,
      status: 'PENDING',
      description: 'Deposit refund for DEP-003',
    });
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-3',
      title: 'Xu ly hoan coc DEP-003',
      status: 'TODO',
      description: 'Can hoan tien',
    });
    prisma.tx.receipt.update.mockResolvedValue({
      id: 'receipt-3',
      code: 'RCT-DEP-003-REFUND-1',
      amount: 1800000,
      status: 'COMPLETED',
      description: 'Deposit refund for DEP-003\nCompleted note: Da chuyen khoan',
    });
    prisma.tx.task.update.mockResolvedValue({
      id: 'task-3',
      title: 'Xu ly hoan coc DEP-003',
      status: 'DONE',
      description: 'Can hoan tien\nHoan tat: Da chuyen khoan',
    });

    await expect(service.completePendingRefund('deposit-3', 'user-1', 'Da chuyen khoan')).resolves.toEqual(
      expect.objectContaining({
        success: true,
        receiptId: 'receipt-3',
        taskId: 'task-3',
        amount: 1800000,
      }),
    );

    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.refunded',
      expect.objectContaining({
        sourceId: 'deposit-3',
        metadata: expect.objectContaining({
          code: 'DEP-003',
          completedFromPending: true,
          refundCompletionNote: 'Da chuyen khoan',
        }),
      }),
    );
  });

  it('publishes a deposit.deducted event when deducting a paid deposit on cancel', async () => {
    const { service, repository, auditService, eventPublisher, prisma } = createService();
    const deposit = {
      id: 'deposit-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      code: 'DEP-001',
      amount: 1500000,
      status: DepositStatus.PAID,
      note: null,
      customer: {
        fullName: 'Nguyen Van A',
        phone: '0909000001',
      },
    };

    repository.findById.mockResolvedValue(deposit);
    prisma.tx.deposit.update.mockResolvedValue({
      ...deposit,
      status: DepositStatus.CANCELLED,
      note: '[DEDUCT] Giu lai tien coc',
    });

    await expect(service.cancel('deposit-1', 'Giu lai tien coc', 'user-1', 'DEDUCT')).resolves.toMatchObject({
      status: DepositStatus.CANCELLED,
      note: '[DEDUCT] Giu lai tien coc',
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CANCEL',
        entity: 'Deposit',
        entityId: 'deposit-1',
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.deducted',
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        customerId: 'customer-1',
        customerName: 'Nguyen Van A',
        customerPhone: '0909000001',
        sourceId: 'deposit-1',
        sourceType: 'ADJUSTMENT',
        amount: 1500000,
        paymentProvider: 'MANUAL',
        metadata: expect.objectContaining({
          code: 'DEP-001',
          note: 'Giu lai tien coc',
          adjustmentType: 'DEPOSIT_DEDUCTION',
          resolutionAction: 'DEDUCT',
        }),
      }),
    );
  });

  it('keeps part of a paid deposit and creates a pending refund for the remainder on cancel', async () => {
    const { service, repository, prisma, eventPublisher } = createService();
    const deposit = {
      id: 'deposit-keep-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      code: 'DEP-KEEP-001',
      amount: 2000000,
      status: DepositStatus.PAID,
      note: null,
      customer: {
        fullName: 'Nguyen Van A',
        phone: '0909000001',
      },
    };

    repository.findById.mockResolvedValue(deposit);
    prisma.tx.deposit.update.mockResolvedValue({
      ...deposit,
      status: DepositStatus.CANCELLED,
      note: '[KEEP] Giu coc theo chinh sach',
    });
    prisma.tx.receipt.create.mockResolvedValue({
      id: 'receipt-keep-1',
      code: 'RCT-DEP-KEEP-001-REFUND-1',
      amount: 500000,
      status: 'PENDING',
      description: 'Deposit cancellation refund for DEP-KEEP-001 - Giu coc theo chinh sach',
    });
    prisma.tx.task.create.mockResolvedValue({
      id: 'task-keep-1',
      title: 'Xu ly hoan coc DEP-KEEP-001',
      status: 'TODO',
    });

    await expect(
      service.cancel('deposit-keep-1', 'Giu coc theo chinh sach', 'user-1', 'KEEP', 1500000, 'PENDING', ['https://example.test/keep-proof.pdf']),
    ).resolves.toMatchObject({
      status: DepositStatus.CANCELLED,
    });

    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.deducted',
      expect.objectContaining({
        amount: 1500000,
        metadata: expect.objectContaining({
          adjustmentType: 'DEPOSIT_RETAINED',
          retainedAmount: 1500000,
          refundableAmount: 500000,
        }),
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.refund_requested',
      expect.objectContaining({
        amount: 500000,
        metadata: expect.objectContaining({
          resolutionAction: 'KEEP',
          refundAmount: 500000,
          retainedAmount: 1500000,
        }),
      }),
    );
  });

  it('deducts part of a paid deposit and immediately refunds the remainder on cancel', async () => {
    const { service, repository, prisma, eventPublisher } = createService();
    const deposit = {
      id: 'deposit-deduct-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      code: 'DEP-DEDUCT-001',
      amount: 2000000,
      status: DepositStatus.PAID,
      note: null,
      customer: {
        fullName: 'Nguyen Van A',
        phone: '0909000001',
      },
    };

    repository.findById.mockResolvedValue(deposit);
    prisma.tx.deposit.update.mockResolvedValue({
      ...deposit,
      status: DepositStatus.CANCELLED,
      note: '[DEDUCT] Khau tru phi vi pham',
    });
    prisma.tx.receipt.create.mockResolvedValue({
      id: 'receipt-deduct-1',
      code: 'RCT-DEP-DEDUCT-001-REFUND-1',
      amount: 1200000,
      status: 'COMPLETED',
      description: 'Deposit cancellation refund for DEP-DEDUCT-001 - Khau tru phi vi pham',
    });

    await expect(
      service.cancel('deposit-deduct-1', 'Khau tru phi vi pham', 'user-1', 'DEDUCT', 800000, 'COMPLETED'),
    ).resolves.toMatchObject({
      status: DepositStatus.CANCELLED,
    });

    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.deducted',
      expect.objectContaining({
        amount: 800000,
        metadata: expect.objectContaining({
          adjustmentType: 'DEPOSIT_DEDUCTION',
          deductedAmount: 800000,
          refundableAmount: 1200000,
        }),
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.refunded',
      expect.objectContaining({
        amount: 1200000,
        metadata: expect.objectContaining({
          resolutionAction: 'DEDUCT',
          refundAmount: 1200000,
          deductedAmount: 800000,
        }),
      }),
    );
  });

  it('aggregates deposit statistics and pipeline properly', async () => {
    const { service, prisma } = createService();
    prisma.deposit.findMany.mockResolvedValue([
      { id: '1', amount: 5000000, status: 'PAID', type: 'SECURITY', updatedAt: new Date() },
      { id: '2', amount: 3000000, status: 'PAID', type: 'BOOKING', updatedAt: new Date() },
      { id: '3', amount: 2000000, status: 'DRAFT', type: 'BOOKING', updatedAt: new Date() },
      { id: '4', amount: 1000000, status: 'REFUNDED', type: 'BOOKING', updatedAt: new Date() },
    ]);

    const stats = await service.getDepositStats('tenant-1');
    expect(stats.kpi.totalFund).toBe(8000000);
    expect(stats.kpi.securityFund).toBe(5000000);
    expect(stats.kpi.bookingFund).toBe(3000000);
    expect(stats.pipeline).toHaveLength(5);
  });

  describe('cleanupOrphanDeposits', () => {
    it('must use soft-delete (updateMany) to clean up orphan deposits', async () => {
      const { service, prisma, auditService } = createService();
      
      prisma.deposit.findMany.mockResolvedValue([
        { id: '1', roomId: 'r1', customerId: 'c1', type: 'BOOKING', status: 'PAID', room: { id: 'r1', deletedAt: null }, customer: { id: 'c1', deletedAt: null } },
        { id: '2', roomId: 'r2', customerId: 'c1', type: 'BOOKING', status: 'PAID', room: null, customer: { id: 'c1' } },
        { id: '3', roomId: 'r1', customerId: 'c2', type: 'BOOKING', status: 'PAID', room: { id: 'r1' }, customer: { id: 'c2', deletedAt: new Date() } },
        { id: '4', roomId: 'r1', customerId: 'c1', type: 'SECURITY', status: 'PAID', room: { id: 'r1' }, customer: { id: 'c1' }, contractId: 'con1', contract: { id: 'con1', deletedAt: new Date() } },
        { id: '5', roomId: 'r1', customerId: 'c1', type: 'BOOKING', status: 'DRAFT', room: { id: 'r1' }, customer: { id: 'c1' } },
        { id: '6', roomId: 'r1', customerId: 'c1', type: 'BOOKING', status: 'PENDING', room: { id: 'r1' }, customer: { id: 'c1' } },
      ]);
      prisma.deposit.updateMany = vi.fn().mockResolvedValue({ count: 4 });
      prisma.deposit.deleteMany = vi.fn().mockResolvedValue({ count: 4 });

      const res = await service.cleanupOrphanDeposits('tenant-1', 'user-1');
      
      expect(res.success).toBe(true);
      expect(res.deletedCount).toBe(4);
      
      const deletedIds = ['2', '3', '4', '6'];
      
      // MUST use soft delete via updateMany
      expect(prisma.deposit.updateMany).toHaveBeenCalledWith({
        where: { id: { in: deletedIds }, tenantId: 'tenant-1', deletedAt: null },
        data: { deletedAt: expect.any(Date) }
      });
      
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE',
        entityId: 'CLEANUP',
      }));
    });

    it('must NOT use hard-delete (deleteMany) to clean up orphan deposits', async () => {
      const { service, prisma } = createService();
      
      prisma.deposit.findMany.mockResolvedValue([
        { id: '2', roomId: 'r2', customerId: 'c1', type: 'BOOKING', status: 'PAID', room: null, customer: { id: 'c1' } },
      ]);
      prisma.deposit.updateMany = vi.fn().mockResolvedValue({ count: 1 });
      prisma.deposit.deleteMany = vi.fn().mockResolvedValue({ count: 1 });

      await service.cleanupOrphanDeposits('tenant-1', 'user-1');
      
      // MUST NOT use hard delete
      expect(prisma.deposit.deleteMany).not.toHaveBeenCalled();
    });
  });
});
