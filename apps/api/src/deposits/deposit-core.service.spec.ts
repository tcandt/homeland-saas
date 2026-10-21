import { ConflictException } from '@nestjs/common';
import { DepositStatus, DepositType, RoomRentalType, RoomStatus } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DepositCoreService } from './deposit-core.service';

describe('DepositCoreService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-23T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());
  function createHarness() {
    const tx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'room-1' }]),
      depositOperation: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'operation-1' }),
        update: vi.fn().mockResolvedValue({}),
      },
      deposit: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      depositLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { balanceEffect: 0 } }),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'ledger-1' }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      paymentRequest: { findFirst: vi.fn().mockResolvedValue(null) },
      payment: { count: vi.fn().mockResolvedValue(0) },
      paymentAllocation: { count: vi.fn().mockResolvedValue(0) },
      invoice: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'adjustment-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      roomHold: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'hold-1' }),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'room-1',
          tenantId: 'tenant-1',
          rentalType: RoomRentalType.WHOLE,
          capacity: 1,
          status: 'AVAILABLE',
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      occupancy: { count: vi.fn().mockResolvedValue(0) },
      customer: {
        findFirst: vi.fn().mockResolvedValue({ id: 'customer-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      rentalCycle: {
        findFirst: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 'cycle-1' }),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      contract: { findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      creditNote: { create: vi.fn() },
      receipt: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      outboxEvent: { create: vi.fn().mockResolvedValue({ id: 'outbox-1' }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      task: { create: vi.fn().mockResolvedValue({ id: 'task-1' }) },
    };
    const prisma: any = {
      tx: {
        ...tx,
        $transaction: vi.fn((callback: any) => callback(tx)),
      },
    };
    return { tx, prisma, service: new DepositCoreService(prisma) };
  }

  const booking = {
    id: 'booking-1',
    tenantId: 'tenant-1',
    rentalCycleId: 'cycle-1',
    roomId: 'room-1',
    customerId: 'customer-1',
    contractId: null,
    code: 'BOOK-1',
    type: DepositType.BOOKING,
    status: DepositStatus.PENDING,
    amount: 2_000_000,
    expiredAt: new Date('2026-10-01T00:00:00.000Z'),
    note: null,
    room: { id: 'room-1', rentalType: RoomRentalType.WHOLE, capacity: 1 },
    rentalCycle: { id: 'cycle-1' },
  };

  function financeCycle(overrides: Record<string, unknown> = {}) {
    return {
      id: 'cycle-1', tenantId: 'tenant-1', customerId: 'customer-1', roomId: 'room-1', status: 'ACTIVE',
      customer: { id: 'customer-1', tenantId: 'tenant-1', fullName: 'Tenant One', phone: '0900000000' },
      room: { id: 'room-1', tenantId: 'tenant-1', code: 'P101', name: 'Phòng 101', rentalType: 'WHOLE' },
      contracts: [{ id: 'contract-1', code: 'HD-1', tenantId: 'tenant-1', roomId: 'room-1', customerId: 'customer-1', rentalCycleId: 'cycle-1', status: 'ACTIVE', monthlyRent: 1_000_000, depositMoney: 1_000_000 }],
      deposits: [{ id: 'deposit-1', code: 'DC-1', tenantId: 'tenant-1', roomId: 'room-1', customerId: 'customer-1', rentalCycleId: 'cycle-1', type: 'SECURITY', status: 'PAID', amount: 1_000_000, contractId: 'contract-1' }],
      invoices: [{ id: 'invoice-1', code: 'HD-INV-1', tenantId: 'tenant-1', customerId: 'customer-1', contractId: 'contract-1', rentalCycleId: 'cycle-1', status: 'ISSUED', total: 500_000, paidAmount: 0, creditAmount: 0, adjustmentOfInvoiceId: null, billingKind: 'ENTRY', allocations: [] }],
      payments: [{ id: 'payment-1', tenantId: 'tenant-1', rentalCycleId: 'cycle-1', invoiceId: 'invoice-1', status: 'CONFIRMED', amount: 100_000, provider: 'SEPAY', providerRef: 'SEPAY-TXN-0001', paidAt: new Date() }],
      depositLedgerEntries: [{ id: 'ledger-1', tenantId: 'tenant-1', rentalCycleId: 'cycle-1', depositId: 'deposit-1', contractId: 'contract-1', operationId: 'operation-1', type: 'CASH_IN', amount: 1_000_000, balanceEffect: 1_000_000, sourceType: 'DEPOSIT_COLLECTION', sourceId: 'deposit-1', createdAt: new Date() }],
      depositOperations: [{ id: 'operation-1', tenantId: 'tenant-1', rentalCycleId: 'cycle-1', sourceDepositId: 'deposit-1', targetDepositId: null, contractId: 'contract-1', type: 'COLLECT', receiptId: null, result: null, createdAt: new Date() }],
      ...overrides,
    };
  }

  it('scopes operation status lookup to the authenticated tenant', async () => {
    const { tx, service } = createHarness();
    tx.depositOperation.findFirst.mockResolvedValue({ id: 'operation-1', status: 'COMPLETED' });

    await service.getOperationStatus('tenant-1', 'status-lookup-1');

    expect(tx.depositOperation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', idempotencyKey: 'status-lookup-1' },
    }));
  });

  it('fails closed when a loaded cycle contains a cross-tenant or wrong-room child relation', () => {
    const { service } = createHarness();
    expect(() => (service as any).buildRentalCycleFinanceSummary(financeCycle({
      deposits: [{ ...financeCycle().deposits[0], tenantId: 'tenant-other' }],
    }))).toThrow('FINANCE_CYCLE_RELATION_INVARIANT_VIOLATION');
    expect(() => (service as any).buildRentalCycleFinanceSummary(financeCycle({
      contracts: [{ ...financeCycle().contracts[0], roomId: 'room-other' }],
    }))).toThrow('FINANCE_CYCLE_RELATION_INVARIANT_VIOLATION');
  });

  it('returns immutable ledger rows and normalized source metadata for finance deep links', () => {
    const { service } = createHarness();
    const summary = (service as any).buildRentalCycleFinanceSummary(financeCycle());
    expect(summary.contracts[0].source).toEqual({ entity: 'Contract', id: 'contract-1', code: 'HD-1' });
    expect(summary.deposits[0].source).toEqual({ entity: 'Deposit', id: 'deposit-1', code: 'DC-1' });
    expect(summary.depositLedger.entries[0]).toMatchObject({
      id: 'ledger-1', depositId: 'deposit-1', operationId: 'operation-1', type: 'CASH_IN',
      amount: 1_000_000, balanceEffect: 1_000_000, sourceType: 'DEPOSIT_COLLECTION', sourceId: 'deposit-1',
      source: { entity: 'DepositLedgerEntry', id: 'ledger-1', code: null },
      operationSource: { entity: 'DepositOperation', id: 'operation-1', code: null },
    });
    expect(summary.payments.items[0]).toMatchObject({
      providerRef: 'SEPAY-TXN-0001',
      source: { entity: 'Payment', id: 'payment-1', code: 'SEPAY-TXN-0001' },
      invoiceSource: { entity: 'Invoice', id: 'invoice-1', code: 'HD-INV-1' },
    });
    expect(summary.pendingOperations[0].source).toEqual({ entity: 'DepositOperation', id: 'operation-1', code: null });
  });

  it('collects money and creates one active WHOLE-room hold atomically', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue(booking);

    await expect(service.collect('tenant-1', booking.id, {
      idempotencyKey: 'collect-booking-1',
      holdExpiresAt: '2026-10-01T00:00:00.000Z',
    }, 'user-1')).resolves.toMatchObject({
      depositId: booking.id,
      collectedAmount: 2_000_000,
      holdId: 'hold-1',
      status: DepositStatus.PAID,
    });

    expect(tx.roomHold.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        activeResourceKey: 'tenant-1:room-1:WHOLE',
        depositId: booking.id,
      }),
    }));
    expect(tx.depositLedgerEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ balanceEffect: 2_000_000, idempotencyKey: 'collect-booking-1:cash-in' }),
    }));
    expect(tx.deposit.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { in: [DepositStatus.DRAFT, DepositStatus.PENDING] } }),
    }));
  });

  it('rejects direct collection for a booking deposit linked to an exact booking invoice', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue({
      ...booking,
      contractId: 'booking-contract-1',
      contract: {
        id: 'booking-contract-1',
        termsSnapshot: { bookingCommand: { depositId: booking.id, invoiceId: 'booking-invoice-1' } },
      },
    });

    await expect(service.collect('tenant-1', booking.id, {
      idempotencyKey: 'booking-direct-collect-rejected-1',
    }, 'user-1')).rejects.toThrow('BOOKING_HOLD_PAY_THROUGH_LINKED_INVOICE');
    expect(tx.depositLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('requires the persisted invoice payment timestamp for a booking installment', async () => {
    const { tx, service } = createHarness();
    const paidAt = new Date('2026-09-29T03:04:05.000Z');
    const markedDeposit = {
      ...booking,
      contractId: 'booking-contract-1',
      contract: {
        id: 'booking-contract-1', tenantId: 'tenant-1', customerId: 'customer-1',
        rentalCycleId: 'cycle-1', roomId: 'room-1',
        termsSnapshot: { bookingCommand: { depositId: booking.id, invoiceId: 'booking-invoice-1' } },
      },
    };
    tx.invoice.findFirst.mockResolvedValue({
      id: 'booking-invoice-1', billingKind: 'BOOKING_HOLD', period: 'Cọc giữ phòng',
      total: 2_000_000, paidAmount: 400_000, creditAmount: 0, status: 'PARTIALLY_PAID',
      contractId: 'booking-contract-1', customerId: 'customer-1', rentalCycleId: 'cycle-1',
      contract: markedDeposit.contract,
      payments: [{ id: 'payment-400', invoiceId: 'booking-invoice-1', amount: 400_000, paidAt }],
    });
    const context = {
      linkedInvoicePayment: true, bookingInvoiceInstallment: true,
      sourceInvoiceId: 'booking-invoice-1', paymentId: 'payment-400',
      paymentAmount: 400_000, priorInvoicePaidAmount: 0,
    };

    await expect((service as any).assertBookingHoldInvoiceSettlement(
      tx, 'tenant-1', markedDeposit, 400_000, context,
    )).rejects.toThrow('BOOKING_HOLD_INVOICE_SETTLEMENT_SCOPE_INVALID');

    await expect((service as any).assertBookingHoldInvoiceSettlement(
      tx, 'tenant-1', markedDeposit, 400_000, { ...context, paidAt: paidAt.toISOString() },
    )).resolves.toBeUndefined();
  });

  it('fails closed when cancellation re-read points to an invoice other than the locked marker', async () => {
    const { tx, service } = createHarness();
    const markedDeposit = {
      ...booking,
      contractId: 'booking-contract-1',
      contract: { termsSnapshot: { bookingCommand: { depositId: booking.id, invoiceId: 'invoice-after-lock' } } },
    };

    await expect((service as any).lockAndValidateBookingCancellationInvoice(
      tx, 'tenant-1', markedDeposit, 400_000, 'invoice-locked-first',
    )).rejects.toThrow('BOOKING_HOLD_INVOICE_MARKER_INVALID');
    await expect((service as any).lockAndValidateBookingCancellationInvoice(
      tx, 'tenant-1', { ...markedDeposit, contract: { termsSnapshot: {} } }, 400_000, 'invoice-locked-first',
    )).rejects.toThrow('BOOKING_HOLD_INVOICE_MARKER_INVALID');
    expect(tx.invoice.findFirst).not.toHaveBeenCalled();
  });

  it('rejects booking cancellation when the invoice family already has a non-draft adjustment', async () => {
    const { tx, service } = createHarness();
    const contract = {
      id: 'booking-contract-1', tenantId: 'tenant-1', customerId: 'customer-1',
      rentalCycleId: 'cycle-1', roomId: 'room-1',
      termsSnapshot: { bookingCommand: { depositId: booking.id, invoiceId: 'booking-invoice-1' } },
    };
    const markedDeposit = { ...booking, contractId: contract.id, contract };
    tx.invoice.findFirst.mockResolvedValue({
      id: 'booking-invoice-1', billingKind: 'BOOKING_HOLD', adjustmentOfInvoiceId: null,
      total: 2_000_000, paidAmount: 400_000, creditAmount: 0, status: 'PARTIALLY_PAID',
      contractId: contract.id, customerId: 'customer-1', rentalCycleId: 'cycle-1', contract,
    });
    tx.invoice.count.mockResolvedValue(1);

    await expect((service as any).lockAndValidateBookingCancellationInvoice(
      tx, 'tenant-1', markedDeposit, 400_000, 'booking-invoice-1',
    )).rejects.toThrow('BOOKING_HOLD_INVOICE_SETTLEMENT_SCOPE_INVALID');
  });

  it('preserves a fully paid booking invoice history when cancellation needs no credit adjustment', async () => {
    const { tx, service } = createHarness();
    const invoice = {
      id: 'booking-invoice-1', total: 2_000_000, paidAmount: 2_000_000, creditAmount: 0,
      contractId: 'booking-contract-1', rentalCycleId: 'cycle-1', customerId: 'customer-1',
      period: 'Cọc giữ phòng', usagePeriod: null,
    };
    tx.invoice.findFirst.mockResolvedValue(null);

    await (service as any).closeModernBookingInvoiceForCancellation(
      tx, 'tenant-1', booking, invoice,
      { idempotencyKey: 'cancel-booking-paid-1', requestHash: 'hash', input: { reason: 'Khách hủy' } },
      'user-1',
    );

    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
  });

  it('cancels a marked zero-funded booking through the core command and closes its invoice family', async () => {
    const { tx, service } = createHarness();
    const contract = {
      id: 'booking-contract-1', status: 'DRAFT', tenantId: 'tenant-1', customerId: 'customer-1',
      rentalCycleId: 'cycle-1', roomId: 'room-1',
      termsSnapshot: { bookingCommand: { depositId: booking.id, invoiceId: 'booking-invoice-1' } },
    };
    const markedDeposit = { ...booking, contractId: contract.id, contract };
    const invoice = {
      id: 'booking-invoice-1', billingKind: 'BOOKING_HOLD', adjustmentOfInvoiceId: null,
      total: 2_000_000, paidAmount: 0, creditAmount: 0, status: 'ISSUED',
      contractId: contract.id, customerId: 'customer-1', rentalCycleId: 'cycle-1',
      period: 'Cọc giữ phòng', usagePeriod: null, dueDate: new Date('2026-10-01T00:00:00.000Z'), contract,
    };
    tx.deposit.findFirst.mockResolvedValue(markedDeposit);
    tx.invoice.findFirst
      .mockResolvedValueOnce(invoice)
      .mockResolvedValueOnce(null);

    await expect(service.cancel('tenant-1', booking.id, {
      idempotencyKey: 'cancel-zero-funded-booking-1',
      reason: 'Khách đổi kế hoạch',
      refundAmount: 0,
      keepAmount: 0,
      deductAmount: 0,
    }, 'user-1')).resolves.toMatchObject({
      depositId: booking.id,
      refundAmount: 0,
      keepAmount: 0,
      deductAmount: 0,
      pending: false,
      bookingContractCancelled: true,
    });

    expect(tx.depositLedgerEntry.createMany).not.toHaveBeenCalled();
    expect(tx.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        adjustmentOfInvoiceId: invoice.id,
        billingKind: 'CREDIT_ADJUSTMENT',
        total: 2_000_000,
        status: 'DRAFT',
        items: {
          create: [expect.objectContaining({
            type: 'OTHER',
            description: 'Internal closure of unpaid booking hold balance',
            servicePeriod: invoice.period,
          })],
        },
      }),
    }));
    expect(tx.invoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'adjustment-1',
        status: 'DRAFT',
        adjustmentOfInvoiceId: invoice.id,
      }),
      data: { status: 'ISSUED' },
    }));
    expect(tx.roomHold.updateMany).toHaveBeenCalled();
    expect(tx.rentalCycle.updateMany).toHaveBeenCalled();
    expect(tx.contract.updateMany).toHaveBeenCalled();
  });

  it.each([
    ['confirmed payment', (tx: any) => tx.payment.count.mockResolvedValue(1)],
    ['payment allocation', (tx: any) => tx.paymentAllocation.count.mockResolvedValue(1)],
    ['positive CASH_IN', (tx: any) => tx.depositLedgerEntry.count.mockResolvedValue(1)],
  ])('rejects zero-funded cancellation with %s history', async (_case, corrupt) => {
    const { tx, service } = createHarness();
    const invoice = { id: 'booking-invoice-1', total: 2_000_000, paidAmount: 0, creditAmount: 0, status: 'ISSUED' };
    corrupt(tx);

    await expect((service as any).assertZeroFundedModernBookingCancellation(
      tx, 'tenant-1', booking, invoice,
      { refundAmount: 0, keepAmount: 0, deductAmount: 0 },
    )).rejects.toThrow('BOOKING_HOLD_ZERO_FUNDED_CANCELLATION_INVALID');
  });

  it('uses the persisted ledger id as the booking disposition outbox identity', async () => {
    const { tx, service } = createHarness();

    await (service as any).enqueueBookingDispositionOutbox(
      tx, 'tenant-1', 'cancel-1', 'ledger-keep-1', 'booking-1', 400_000,
    );
    await (service as any).enqueueBookingDispositionOutbox(
      tx, 'tenant-1', 'cancel-1', 'ledger-zero-1', 'booking-1', 0,
    );

    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        aggregateType: 'DepositLedgerEntry',
        aggregateId: 'ledger-keep-1',
        eventName: 'deposit.booking_disposition',
        idempotencyKey: 'deposit-booking-disposition:ledger-keep-1',
      }),
    }));
  });

  it.each([
    ['missing invoiceId', { depositId: booking.id }],
    ['wrong depositId', { depositId: 'booking-deposit-other', invoiceId: 'booking-invoice-1' }],
    ['null marker', null],
    ['malformed marker', 'booking-invoice-1'],
  ])('fails closed for a present booking marker with %s', async (_case, marker) => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue({
      ...booking,
      contractId: 'booking-contract-1',
      contract: {
        id: 'booking-contract-1',
        termsSnapshot: { bookingCommand: marker },
      },
    });

    await expect(service.collect('tenant-1', booking.id, {
      idempotencyKey: `booking-invalid-marker-${String(_case).replace(/\s+/g, '-')}`,
    }, 'user-1')).rejects.toThrow('BOOKING_HOLD_INVOICE_MARKER_INVALID');
    expect(tx.depositLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects markerless booking invoice reconciliation rather than stranding invoice cash', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue({ ...booking, expiredAt: new Date('2026-09-22T00:00:00.000Z') });
    tx.paymentRequest.findFirst.mockResolvedValue({
      id: 'request-confirmed-1', amount: 2_000_000,
      providerTransactionId: 'sepay-txn-1', paidAt: new Date('2026-09-22T00:00:00.000Z'),
    });
    tx.invoice.findFirst.mockResolvedValue({
      id: 'invoice-booking-1', period: 'Cọc giữ phòng', status: 'PAID', total: 2_000_000,
      paidAmount: 2_000_000, creditAmount: 0, contractId: null, rentalCycleId: 'cycle-1',
      customerId: 'customer-1', contract: { roomId: 'room-1' },
    });

    await expect(service.collect('tenant-1', booking.id, {
      idempotencyKey: 'reconcile-booking-paid-1',
      notificationContext: {
        linkedInvoicePayment: true,
        paymentRequestId: 'request-confirmed-1',
        sourceInvoiceId: 'invoice-booking-1',
        skipHoldCreation: true,
        skipRoomReservation: true,
      },
    }, 'PAYMENT_RECONCILIATION')).rejects.toThrow('BOOKING_HOLD_INVOICE_MARKER_INVALID');

    expect(tx.roomHold.create).not.toHaveBeenCalled();
    expect(tx.rentalCycle.updateMany).not.toHaveBeenCalled();
    expect(tx.depositLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects reconciliation when invoice status is PAID but numeric balances remain unpaid', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue(booking);
    tx.paymentRequest.findFirst.mockResolvedValue({
      id: 'request-stale-paid-1', amount: 2_000_000,
      providerTransactionId: 'sepay-stale-paid-1', paidAt: new Date('2026-09-22T00:00:00.000Z'),
    });
    tx.invoice.findFirst.mockResolvedValue({
      id: 'invoice-stale-paid-1', period: 'Cọc giữ phòng', status: 'PAID', total: 2_000_000,
      paidAmount: 0, creditAmount: 0, contractId: null, rentalCycleId: 'cycle-1',
      customerId: 'customer-1', contract: { roomId: 'room-1' },
    });

    await expect(service.collect('tenant-1', booking.id, {
      idempotencyKey: 'reconcile-stale-paid-1', // gitleaks:allow — deterministic test key
      notificationContext: {
        linkedInvoicePayment: true,
        paymentRequestId: 'request-stale-paid-1',
        sourceInvoiceId: 'invoice-stale-paid-1',
        skipHoldCreation: true,
        skipRoomReservation: true,
      },
    }, 'PAYMENT_RECONCILIATION')).rejects.toThrow('BOOKING_HOLD_INVOICE_MARKER_INVALID');

    expect(tx.depositLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects a forged, unpaid, or out-of-scope booking invoice reconciliation proof', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue(booking);
    tx.paymentRequest.findFirst.mockResolvedValue(null);

    await expect(service.collect('tenant-1', booking.id, {
      idempotencyKey: 'reconcile-booking-forged-1',
      notificationContext: {
        linkedInvoicePayment: true,
        paymentRequestId: 'forged-request',
        sourceInvoiceId: 'foreign-invoice',
        skipHoldCreation: true,
      },
    }, 'PAYMENT_RECONCILIATION')).rejects.toThrow('DEPOSIT_RECONCILIATION_PROOF_INVALID');
    expect(tx.depositLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('recovers an expired booking hold only with an explicit future expiry and no room conflict', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue({ ...booking, expiredAt: new Date('2026-09-22T00:00:00.000Z') });

    await expect((service as any).ensureActiveHoldForConversionInTransaction(
      tx, 'tenant-1', booking.id, null, 'user-1', 'convert-hold-missing-1',
    )).rejects.toThrow('BOOKING_CONVERT_HOLD_RECOVERY_REQUIRES_EXPIRY');

    await expect((service as any).ensureActiveHoldForConversionInTransaction(
      tx, 'tenant-1', booking.id, '2026-10-01T00:00:00.000Z', 'user-1', 'convert-hold-recover-1',
    )).resolves.toMatchObject({ id: 'hold-1' });
    expect(tx.roomHold.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ depositId: booking.id, expiresAt: new Date('2026-10-01T00:00:00.000Z') }),
    }));

    tx.occupancy.count.mockResolvedValue(1);
    await expect((service as any).ensureActiveHoldForConversionInTransaction(
      tx, 'tenant-1', booking.id, '2026-10-02T00:00:00.000Z', 'user-1', 'convert-hold-conflict-1',
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects fresh hold recovery for unavailable rooms and foreign reservations, while replaying an owned active hold', async () => {
    const { tx, service } = createHarness();
    const command = (expiresAt: string | null, key: string) =>
      (service as any).ensureActiveHoldForConversionInTransaction(
        tx, 'tenant-1', booking.id, expiresAt, 'user-1', key,
      );
    tx.deposit.findFirst.mockResolvedValue({
      ...booking,
      room: { ...booking.room, status: RoomStatus.CLEANING },
    });
    tx.room.findFirst.mockResolvedValue({
      id: 'room-1', tenantId: 'tenant-1', rentalType: RoomRentalType.WHOLE,
      capacity: 1, status: RoomStatus.CLEANING,
    });
    await expect(command('2026-10-01T00:00:00.000Z', 'convert-hold-cleaning-1'))
      .rejects.toThrow('BOOKING_CONVERT_HOLD_ROOM_UNAVAILABLE');

    tx.deposit.findFirst.mockResolvedValue({ ...booking, room: { ...booking.room, status: RoomStatus.AVAILABLE } });
    tx.room.findFirst.mockResolvedValue({
      id: 'room-1', tenantId: 'tenant-1', rentalType: RoomRentalType.WHOLE,
      capacity: 1, status: RoomStatus.AVAILABLE,
    });
    tx.contract.findFirst.mockResolvedValue({ id: 'foreign-contract-1' });
    await expect(command('2026-10-01T00:00:00.000Z', 'convert-hold-foreign-contract-1'))
      .rejects.toThrow('BOOKING_CONVERT_HOLD_FOREIGN_CONTRACT');

    tx.contract.findFirst.mockResolvedValue(null);
    tx.rentalCycle.findFirst.mockResolvedValue({ id: 'foreign-cycle-1' });
    await expect(command('2026-10-01T00:00:00.000Z', 'convert-hold-foreign-cycle-1'))
      .rejects.toThrow('BOOKING_CONVERT_HOLD_FOREIGN_CYCLE');

    tx.rentalCycle.findFirst.mockResolvedValue(null);
    tx.roomHold.findFirst.mockResolvedValue({ id: 'owned-active-hold' });
    await expect(command(null, 'convert-hold-replay-1')).resolves.toEqual({ id: 'owned-active-hold' });
    expect(tx.roomHold.create).not.toHaveBeenCalled();
  });

  it('uses room-type-aware capacity checks for fresh and existing conversion holds', async () => {
    const { tx, service } = createHarness();
    const sharedBooking = {
      ...booking,
      room: { id: 'room-1', rentalType: RoomRentalType.SHARED, capacity: 2 },
    };
    const recover = (key: string, expiresAt: string | null = '2026-10-01T00:00:00.000Z') =>
      (service as any).ensureActiveHoldForConversionInTransaction(
        tx, 'tenant-1', booking.id, expiresAt, 'user-1', key,
      );
    tx.deposit.findFirst.mockResolvedValue(sharedBooking);
    tx.room.findFirst.mockResolvedValue({
      id: 'room-1', tenantId: 'tenant-1', rentalType: RoomRentalType.SHARED,
      capacity: 2, status: RoomStatus.AVAILABLE,
    });
    tx.occupancy.count.mockResolvedValue(1);
    tx.roomHold.count.mockResolvedValue(0);
    await expect(recover('convert-shared-spare-1')).resolves.toMatchObject({ id: 'hold-1' });

    tx.occupancy.count.mockResolvedValue(2);
    await expect(recover('convert-shared-full-1')).rejects.toThrow('ROOM_CAPACITY_EXCEEDED');

    tx.deposit.findFirst.mockResolvedValue(booking);
    tx.room.findFirst.mockResolvedValue({
      id: 'room-1', tenantId: 'tenant-1', rentalType: RoomRentalType.WHOLE,
      capacity: 1, status: RoomStatus.AVAILABLE,
    });
    tx.occupancy.count.mockResolvedValue(0);
    tx.roomHold.count.mockResolvedValue(0);
    tx.roomHold.findFirst.mockResolvedValue({ id: 'own-active-hold' });
    await expect(recover('convert-own-active-1', null)).resolves.toEqual({ id: 'own-active-hold' });
    expect(tx.roomHold.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [{ depositId: { not: booking.id } }, { depositId: null }] }),
    }));

    tx.room.findFirst.mockResolvedValue({
      id: 'room-1', tenantId: 'tenant-1', rentalType: RoomRentalType.WHOLE,
      capacity: 1, status: RoomStatus.MAINTENANCE,
    });
    await expect(recover('convert-own-maintenance-1', null))
      .rejects.toThrow('BOOKING_CONVERT_HOLD_ROOM_UNAVAILABLE');

    tx.room.findFirst.mockResolvedValue({
      id: 'room-1', tenantId: 'tenant-1', rentalType: RoomRentalType.WHOLE,
      capacity: 1, status: RoomStatus.AVAILABLE,
    });
    tx.occupancy.count.mockResolvedValue(1);
    await expect(recover('convert-own-occupied-1', null)).rejects.toThrow('ROOM_HOLD_CONFLICT');
  });

  it('rejects a WHOLE-room hold when the room already has an occupant', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue(booking);
    tx.occupancy.count.mockResolvedValue(1);

    await expect(service.collect('tenant-1', booking.id, {
      idempotencyKey: 'collect-conflict-1',
    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.depositLedgerEntry.create).not.toHaveBeenCalled();
    expect(tx.deposit.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a booking cancellation when the linked rental contract is already active', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue({
      ...booking,
      status: DepositStatus.PAID,
      contract: { id: 'contract-active-1', status: 'ACTIVE' },
    });
    tx.depositLedgerEntry.aggregate.mockResolvedValue({ _sum: { balanceEffect: 2_000_000 } });

    await expect(service.cancel('tenant-1', booking.id, {
      idempotencyKey: 'cancel-active-booking-1',
      reason: 'Không được hủy hợp đồng thuê đang hiệu lực',
      refundAmount: 2_000_000,
      keepAmount: 0,
      deductAmount: 0,
      refundStatus: 'PENDING',
    }, 'user-1')).rejects.toThrow('BOOKING_HOLD_ACTIVE_CONTRACT_CANNOT_CANCEL');

    expect(tx.deposit.update).not.toHaveBeenCalled();
    expect(tx.depositLedgerEntry.createMany).not.toHaveBeenCalled();
    expect(tx.contract.updateMany).not.toHaveBeenCalled();
  });

  it('records uploaded refund proof in the core operation, audit, and notification event', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue({
      ...booking,
      status: DepositStatus.PAID,
      contract: { id: 'contract-draft-1', status: 'DRAFT' },
    });
    tx.depositLedgerEntry.aggregate.mockResolvedValue({ _sum: { balanceEffect: 2_000_000 } });
    tx.receipt.create.mockResolvedValue({ id: 'receipt-proof-1' });

    await expect(service.cancel('tenant-1', booking.id, {
      idempotencyKey: 'cancel-proof-booking-1',
      reason: 'Hoàn theo thỏa thuận từng trường hợp',
      refundAmount: 2_000_000,
      keepAmount: 0,
      deductAmount: 0,
      refundStatus: 'COMPLETED',
      attachmentUrls: [
        '/documents/storage/tenant-1/booking-deposit-refunds/proof.jpg',
        '/documents/storage/tenant-1/booking-deposit-refunds/receipt.pdf',
      ],
    }, 'user-1')).resolves.toMatchObject({
      attachmentUrls: [
        '/documents/storage/tenant-1/booking-deposit-refunds/proof.jpg',
        '/documents/storage/tenant-1/booking-deposit-refunds/receipt.pdf',
      ],
      bookingContractCancelled: true,
      refundStatus: 'COMPLETED',
    });

    expect(tx.contract.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'contract-draft-1' }),
      data: expect.objectContaining({ status: 'CANCELLED' }),
    }));
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventName: 'deposit.refunded',
        payload: expect.objectContaining({
          metadata: expect.objectContaining({
            attachmentUrls: [
              '/documents/storage/tenant-1/booking-deposit-refunds/proof.jpg',
              '/documents/storage/tenant-1/booking-deposit-refunds/receipt.pdf',
            ],
          }),
        }),
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'CANCEL',
        after: expect.objectContaining({
          attachmentUrls: expect.arrayContaining(['/documents/storage/tenant-1/booking-deposit-refunds/proof.jpg']),
        }),
      }),
    }));
  });

  it('requires proof before a refund is marked as immediately completed', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue({ ...booking, status: DepositStatus.PAID, contract: null });
    tx.depositLedgerEntry.aggregate.mockResolvedValue({ _sum: { balanceEffect: 2_000_000 } });

    await expect(service.cancel('tenant-1', booking.id, {
      idempotencyKey: 'cancel-proof-required-1',
      reason: 'Hoàn ngay nhưng chưa có chứng từ',
      refundAmount: 2_000_000,
      keepAmount: 0,
      deductAmount: 0,
      refundStatus: 'COMPLETED',
    }, 'user-1')).rejects.toThrow('DEPOSIT_REFUND_PROOF_REQUIRED');
    expect(tx.receipt.create).not.toHaveBeenCalled();
  });

  it('stores proof uploaded when a pending refund is actually paid out', async () => {
    const { tx, service } = createHarness();
    tx.depositOperation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'pending-refund-1',
        tenantId: 'tenant-1',
        rentalCycleId: 'cycle-1',
        sourceDepositId: booking.id,
        targetDepositId: null,
        contractId: null,
        status: 'PENDING',
        receiptId: 'receipt-pending-1',
        result: { pending: true },
      });
    tx.receipt.findFirst.mockResolvedValue({
      id: 'receipt-pending-1',
      amount: 2_000_000,
      status: 'PENDING',
    });
    tx.depositLedgerEntry.aggregate.mockResolvedValue({ _sum: { balanceEffect: 2_000_000 } });

    await expect(service.completePendingRefund(
      'tenant-1',
      'pending-refund-1',
      'complete-refund-proof-1',
      'user-1',
      {
        note: 'Đã chuyển khoản FT123',
        attachmentUrls: ['/documents/storage/tenant-1/deposit-refunds/ft123.jpg'],
      },
    )).resolves.toMatchObject({
      completedOperationId: 'pending-refund-1',
      status: 'COMPLETED',
      note: 'Đã chuyển khoản FT123',
      attachmentUrls: ['/documents/storage/tenant-1/deposit-refunds/ft123.jpg'],
    });

    expect(tx.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventName: 'deposit.refunded',
        payload: expect.objectContaining({
          metadata: expect.objectContaining({
            attachmentUrls: ['/documents/storage/tenant-1/deposit-refunds/ft123.jpg'],
          }),
        }),
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        entity: 'DepositOperation',
        action: 'UPDATE',
        after: expect.objectContaining({
          attachmentUrls: ['/documents/storage/tenant-1/deposit-refunds/ft123.jpg'],
        }),
      }),
    }));
  });

  it('collects only the remaining security shortfall after a booking transfer', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue({
      ...booking,
      id: 'security-1',
      type: DepositType.SECURITY,
      amount: 5_000_000,
      status: DepositStatus.PENDING,
    });
    tx.depositLedgerEntry.aggregate.mockResolvedValue({ _sum: { balanceEffect: 2_000_000 } });

    await expect(service.collect('tenant-1', 'security-1', {
      idempotencyKey: 'collect-security-shortfall-1',
    }, 'user-1')).resolves.toMatchObject({
      collectedAmount: 3_000_000,
      balance: 5_000_000,
      holdId: null,
    });
    expect(tx.depositLedgerEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 3_000_000, balanceEffect: 3_000_000 }),
    }));
  });

  it('replays a completed command without writing money twice', async () => {
    const { tx, service } = createHarness();
    const firstInput = { idempotencyKey: 'collect-replay-1', note: null };
    const requestHash = (service as any).hash(firstInput);
    tx.depositOperation.findFirst.mockResolvedValue({
      status: 'COMPLETED',
      requestHash,
      result: { operationId: 'operation-old', collectedAmount: 2_000_000 },
    });

    await expect(service.collect('tenant-1', booking.id, firstInput, 'user-1')).resolves.toMatchObject({
      operationId: 'operation-old',
      replayed: true,
    });
    expect(tx.deposit.findFirst).not.toHaveBeenCalled();
    expect(tx.depositLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('retries a PostgreSQL serializable conflict with the same command', async () => {
    const { tx, prisma, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue(booking);
    prisma.tx.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementation((callback: any) => callback(tx));

    await expect(service.collect('tenant-1', booking.id, {
      idempotencyKey: 'collect-serializable-retry-1',
    }, 'user-1')).resolves.toMatchObject({ depositId: booking.id, status: DepositStatus.PAID });
    expect(prisma.tx.$transaction).toHaveBeenCalledTimes(2);
  });

  it('retries PostgreSQL 40001 when Prisma wraps the raw lock failure as P2010', async () => {
    const { tx, prisma, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue(booking);
    prisma.tx.$transaction
      .mockRejectedValueOnce({ code: 'P2010', meta: { code: '40001', message: 'could not serialize access' } })
      .mockImplementation((callback: any) => callback(tx));

    await expect(service.collect('tenant-1', booking.id, {
      idempotencyKey: 'collect-raw-lock-retry-1',
    }, 'user-1')).resolves.toMatchObject({ depositId: booking.id, status: DepositStatus.PAID });
    expect(prisma.tx.$transaction).toHaveBeenCalledTimes(2);
  });

  it('converts B < C into transfer plus an explicit additional-cash requirement', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue({ ...booking, status: DepositStatus.PAID });
    tx.depositLedgerEntry.aggregate.mockResolvedValue({ _sum: { balanceEffect: 2_000_000 } });
    tx.deposit.create.mockResolvedValue({
      ...booking,
      id: 'security-1',
      code: 'SEC-1',
      type: DepositType.SECURITY,
      status: DepositStatus.PENDING,
      amount: 5_000_000,
    });

    await expect(service.convertToSecurity('tenant-1', booking.id, {
      idempotencyKey: 'convert-booking-1',
      securityRequired: 5_000_000,
    }, 'user-1')).resolves.toMatchObject({
      bookingDepositId: booking.id,
      securityDepositId: 'security-1',
      transferAmount: 2_000_000,
      additionalCashRequired: 3_000_000,
      excessAmount: 0,
    });
    expect(tx.depositLedgerEntry.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ balanceEffect: -2_000_000, idempotencyKey: 'convert-booking-1:transfer-out' }),
        expect.objectContaining({ balanceEffect: 2_000_000, idempotencyKey: 'convert-booking-1:transfer-in' }),
      ]),
    });
    expect(tx.deposit.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'security-1', tenantId: 'tenant-1' },
      data: expect.objectContaining({ status: DepositStatus.PENDING }),
    }));
    expect(tx.roomHold.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', rentalCycleId: 'cycle-1', status: 'ACTIVE' },
      data: { depositId: 'security-1' },
    });
  });

  it('creates a deposit rental cycle operation and outbox event atomically', async () => {
    const { tx, service } = createHarness();
    tx.customer.findFirst.mockResolvedValue({
      id: 'customer-1', roomId: null, fullName: 'Khách cọc', phone: '0901000001', zaloChatId: 'chat-1', zaloUserId: null,
    });
    tx.room.findFirst.mockResolvedValue({
      id: 'room-1', tenantId: 'tenant-1', code: 'PN 31-02', name: 'PN 31-02', rentalType: RoomRentalType.WHOLE,
      capacity: 1, status: 'AVAILABLE', building: { name: 'Tòa LK01-31', code: 'LK01-31' },
    });
    tx.roomHold.create.mockResolvedValue({ id: 'hold-1', expiresAt: new Date('2026-11-01T16:59:59.000Z') });
    tx.rentalCycle.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ expectedMoveInAt: new Date('2026-11-01T00:00:00.000Z') });
    tx.deposit.create.mockResolvedValue({
      id: 'deposit-1',
      tenantId: 'tenant-1',
      code: 'DEP-CREATE-1',
      type: DepositType.BOOKING,
      roomId: 'room-1',
      customerId: 'customer-1',
      contractId: null,
      rentalCycleId: 'cycle-1',
      amount: 1_500_000,
      status: DepositStatus.PENDING,
      expiredAt: null,
      note: null,
    });

    const result = await service.create('tenant-1', {
      idempotencyKey: 'create-deposit-1',
      code: 'DEP-CREATE-1',
      roomId: 'room-1',
      customerId: 'customer-1',
      type: DepositType.BOOKING,
      amount: 1_500_000,
      note: null,
    }, 'user-1');

    expect(result).toMatchObject({ id: 'deposit-1', operationId: 'operation-1', rentalCycleId: 'cycle-1' });
    expect(tx.deposit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        code: 'DEP-CREATE-1',
        roomId: 'room-1',
        customerId: 'customer-1',
        rentalCycleId: 'cycle-1',
      }),
    }));
    expect(tx.depositOperation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        rentalCycleId: 'cycle-1',
        sourceDepositId: 'deposit-1',
        contractId: null,
        type: 'CREATE',
        status: 'PENDING',
        idempotencyKey: 'create-deposit-1',
      }),
      select: { id: true },
    }));
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventName: 'deposit.created',
        idempotencyKey: 'deposit-operation:operation-1:deposit.created',
        payload: expect.objectContaining({
          customerName: 'Khách cọc',
          roomCode: 'PN 31-02',
          buildingName: 'Tòa LK01-31',
          bookingHoldUntil: '2026-11-01T16:59:59.000Z',
          expectedMoveInDate: '2026-11-01T00:00:00.000Z',
        }),
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'CREATE', entityId: 'deposit-1' }),
    }));
  });

  it('locks and revalidates a contract-scoped deposit before creating it', async () => {
    const { tx, service } = createHarness();
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: 'room-1' }])
      .mockResolvedValueOnce([{ id: 'contract-1' }]);
    tx.contract.findFirst.mockResolvedValue({ id: 'contract-1', rentalCycleId: 'cycle-1' });
    tx.rentalCycle.findFirst.mockResolvedValue({ id: 'cycle-1' });
    tx.deposit.create.mockResolvedValue({
      id: 'deposit-contract', tenantId: 'tenant-1', code: 'DEP-CONTRACT', type: DepositType.SECURITY,
      roomId: 'room-1', customerId: 'customer-1', contractId: 'contract-1', rentalCycleId: 'cycle-1',
      amount: 1_000_000, status: DepositStatus.PENDING, expiredAt: null, note: null,
    });

    await service.create('tenant-1', {
      idempotencyKey: 'contract-deposit-create', roomId: 'room-1', customerId: 'customer-1',
      contractId: 'contract-1', type: DepositType.SECURITY, amount: 1_000_000,
    }, 'user-1');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(4);
    expect(tx.contract.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'contract-1', tenantId: 'tenant-1', roomId: 'room-1', customerId: 'customer-1' }),
    }));
  });

  it('rejects a deposit that would silently move a customer bound to another room', async () => {
    const { tx, service } = createHarness();
    tx.customer.findFirst.mockResolvedValue({ id: 'customer-1', roomId: 'room-2' });

    await expect(service.create('tenant-1', {
      idempotencyKey: 'cross-room-customer-guard',
      roomId: 'room-1',
      customerId: 'customer-1',
      type: DepositType.BOOKING,
      amount: 1_000_000,
    }, 'user-1')).rejects.toThrow('DEPOSIT_CUSTOMER_ALREADY_BOUND');
    expect(tx.deposit.create).not.toHaveBeenCalled();
  });

  it('rejects a deposit when an active contract still binds the customer elsewhere', async () => {
    const { tx, service } = createHarness();
    tx.customer.findFirst.mockResolvedValue({ id: 'customer-1', roomId: null });
    tx.contract.count.mockResolvedValue(1);

    await expect(service.create('tenant-1', {
      idempotencyKey: 'active-contract-customer-guard',
      roomId: 'room-1',
      customerId: 'customer-1',
      type: DepositType.BOOKING,
      amount: 1_000_000,
    }, 'user-1')).rejects.toThrow('DEPOSIT_CUSTOMER_ACTIVE_CONTRACT');
    expect(tx.deposit.create).not.toHaveBeenCalled();
  });

  it('replays an idempotent deposit create without writing a second deposit', async () => {
    const { tx, service } = createHarness();
    tx.depositOperation.findFirst.mockResolvedValue({
      id: 'operation-1',
      requestHash: (service as any).hash({
        amount: 1_500_000,
        customerId: 'customer-1',
        idempotencyKey: 'create-deposit-replay-1',
        roomId: 'room-1',
        type: DepositType.BOOKING,
      }),
      status: 'COMPLETED',
      result: { depositId: 'deposit-1', operationId: 'operation-1' },
    });

    await expect(service.create('tenant-1', {
      idempotencyKey: 'create-deposit-replay-1',
      roomId: 'room-1',
      customerId: 'customer-1',
      type: DepositType.BOOKING,
      amount: 1_500_000,
    }, 'user-1')).resolves.toEqual({
      depositId: 'deposit-1',
      operationId: 'operation-1',
      replayed: true,
    });
    expect(tx.deposit.create).not.toHaveBeenCalled();
    expect(tx.depositOperation.create).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('renews only an active hold and keeps its resource key', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue({ ...booking, status: DepositStatus.PAID });
    tx.roomHold.findFirst.mockResolvedValue({
      id: 'hold-1',
      expiresAt: new Date(Date.now() + 60_000),
      activeResourceKey: 'tenant-1:room-1:WHOLE',
    });
    const expiresAt = new Date(Date.now() + 120_000).toISOString();

    await expect(service.renewHold('tenant-1', booking.id, {
      idempotencyKey: 'renew-hold-booking-1',
      expiresAt,
    }, 'user-1')).resolves.toMatchObject({ holdId: 'hold-1', status: 'ACTIVE' });
    expect(tx.roomHold.update).toHaveBeenCalledWith({
      where: { id: 'hold-1' },
      data: { expiresAt: new Date(expiresAt), releaseReason: null },
    });
  });

  it('moves a hold and all deposits in the cycle to a target room atomically', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue({ ...booking, status: DepositStatus.PAID });
    tx.roomHold.findFirst.mockResolvedValue({ id: 'hold-source', expiresAt: new Date(Date.now() + 120_000) });
    tx.room.findFirst.mockResolvedValue({ id: 'room-2', rentalType: RoomRentalType.SHARED, capacity: 3 });
    tx.roomHold.create.mockResolvedValue({ id: 'hold-target' });

    await expect(service.transferHold('tenant-1', booking.id, {
      idempotencyKey: 'transfer-hold-booking-1',
      targetRoomId: 'room-2',
    }, 'user-1')).resolves.toMatchObject({
      sourceHoldId: 'hold-source',
      targetHoldId: 'hold-target',
      targetRoomId: 'room-2',
    });
    expect(tx.deposit.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', rentalCycleId: 'cycle-1', deletedAt: null },
      data: { roomId: 'room-2' },
    });
    expect(tx.rentalCycle.update).toHaveBeenCalledWith({ where: { id: 'cycle-1' }, data: { roomId: 'room-2' } });
    expect(tx.roomHold.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ activeResourceKey: 'tenant-1:room-2:SHARED:cycle-1' }),
    }));
  });

  it('reverses a ledger entry with an opposite append-only entry', async () => {
    const { tx, service } = createHarness();
    tx.depositLedgerEntry.findFirst
      .mockResolvedValueOnce({
        id: 'cash-in-1',
        operationId: 'collect-operation-1',
        tenantId: 'tenant-1',
        rentalCycleId: 'cycle-1',
        depositId: booking.id,
        contractId: null,
        type: 'CASH_IN',
        amount: 2_000_000,
        balanceEffect: 2_000_000,
      })
      .mockResolvedValueOnce(null);
    tx.depositLedgerEntry.findMany.mockResolvedValue([{
      id: 'cash-in-1',
      operationId: 'collect-operation-1',
      tenantId: 'tenant-1',
      rentalCycleId: 'cycle-1',
      depositId: booking.id,
      contractId: null,
      type: 'CASH_IN',
      amount: 2_000_000,
      balanceEffect: 2_000_000,
      sourceType: 'DEPOSIT_COLLECTION',
    }]);
    tx.depositLedgerEntry.aggregate.mockResolvedValue({ _sum: { balanceEffect: 2_000_000 } });

    await expect(service.reverseLedgerEntry('tenant-1', 'cash-in-1', {
      idempotencyKey: 'reverse-cash-in-entry-1',
      reason: 'Sửa chứng từ nhập nhầm',
    }, 'user-1')).resolves.toMatchObject({
      reversedOperationId: 'collect-operation-1',
      balances: { [booking.id]: 0 },
      reversalEntries: [expect.objectContaining({ reversedEntryId: 'cash-in-1', balanceEffect: -2_000_000 })],
    });
    expect(tx.depositLedgerEntry.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([expect.objectContaining({
        type: 'REVERSAL',
        reversalOfId: 'cash-in-1',
        balanceEffect: -2_000_000,
      })]),
    }));
  });

  it('keeps B > C refund pending out of the posted ledger until cash-out completes', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue({ ...booking, status: DepositStatus.PAID, amount: 7_000_000 });
    tx.depositLedgerEntry.aggregate.mockResolvedValue({ _sum: { balanceEffect: 7_000_000 } });
    tx.deposit.create.mockResolvedValue({
      ...booking,
      id: 'security-2',
      code: 'SEC-2',
      type: DepositType.SECURITY,
      status: DepositStatus.PENDING,
      amount: 5_000_000,
    });
    tx.receipt.create.mockResolvedValue({ id: 'receipt-1' });

    await expect(service.convertToSecurity('tenant-1', booking.id, {
      idempotencyKey: 'convert-refund-1',
      securityRequired: 5_000_000,
      excessAction: 'REFUND',
      refundStatus: 'PENDING',
    }, 'user-1')).resolves.toMatchObject({
      transferAmount: 5_000_000,
      excessAmount: 2_000_000,
      refundReceiptId: 'receipt-1',
      refundStatus: 'PENDING',
      pending: true,
    });
    expect(tx.depositLedgerEntry.create).not.toHaveBeenCalled();
    expect(tx.depositOperation.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETED' }),
    }));
  });

  it('requires proof before an excess conversion refund can be completed immediately', async () => {
    const { tx, service } = createHarness();
    tx.deposit.findFirst.mockResolvedValue({ ...booking, status: DepositStatus.PAID, amount: 7_000_000 });
    tx.depositLedgerEntry.aggregate.mockResolvedValue({ _sum: { balanceEffect: 7_000_000 } });
    tx.deposit.create.mockResolvedValue({
      ...booking,
      id: 'security-proof-1',
      code: 'SEC-PROOF-1',
      type: DepositType.SECURITY,
      status: DepositStatus.PENDING,
      amount: 5_000_000,
    });

    await expect(service.convertToSecurity('tenant-1', booking.id, {
      idempotencyKey: 'convert-refund-proof-required-1',
      securityRequired: 5_000_000,
      excessAction: 'REFUND',
      refundStatus: 'COMPLETED',
    }, 'user-1')).rejects.toThrow('DEPOSIT_REFUND_PROOF_REQUIRED');

    expect(tx.receipt.create).not.toHaveBeenCalled();
    expect(tx.depositLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('refuses to complete a refund that exceeds the current ledger balance', async () => {
    const { tx, service } = createHarness();
    tx.depositOperation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'pending-operation-1',
        tenantId: 'tenant-1',
        rentalCycleId: 'cycle-1',
        sourceDepositId: 'booking-1',
        targetDepositId: null,
        contractId: null,
        status: 'PENDING',
        receiptId: 'receipt-over',
        result: { pending: true },
      });
    tx.receipt.findFirst.mockResolvedValue({ id: 'receipt-over', amount: 6_000_000, status: 'PENDING' });
    tx.depositLedgerEntry.aggregate.mockResolvedValue({ _sum: { balanceEffect: 5_000_000 } });

    await expect(service.completePendingRefund(
      'tenant-1',
      'pending-operation-1',
      'complete-refund-over-1',
      'user-1',
    )).rejects.toThrow('DEPOSIT_REFUND_EXCEEDS_BALANCE');
    expect(tx.depositLedgerEntry.create).not.toHaveBeenCalled();
  });

  describe('P3: Atomic Booking Transaction, Replay & Error Injection', () => {
    it('P3.2: rejects idempotency replay when payload differs under the same key', async () => {
      const { tx, service } = createHarness();
      tx.depositOperation.findFirst.mockResolvedValue({
        status: 'COMPLETED',
        requestHash: 'original-hash-12345',
        result: { depositId: 'deposit-1', operationId: 'operation-1' },
      });

      await expect(service.create('tenant-1', {
        idempotencyKey: 'same-key-different-payload',
        roomId: 'room-1',
        customerId: 'customer-1',
        type: DepositType.BOOKING,
        amount: 2_000_000, // Different amount produces different requestHash
      }, 'user-1')).rejects.toThrow(ConflictException);

      expect(tx.deposit.create).not.toHaveBeenCalled();
      expect(tx.depositOperation.create).not.toHaveBeenCalled();
    });

    it('P3.1 & P3.3: rolls back entire atomic transaction when mid-step fails (no orphan resource)', async () => {
      const { tx, prisma, service } = createHarness();
      // Simulate mid-transaction failure at outbox event creation
      tx.outboxEvent.create.mockRejectedValue(new Error('DATABASE_CONNECTION_LOST'));
      tx.deposit.create.mockResolvedValue({ id: 'deposit-temp', code: 'DEP-TEMP', type: DepositType.BOOKING, roomId: 'room-1', customerId: 'customer-1' });

      // Run transactional command
      await expect(service.create('tenant-1', {
        idempotencyKey: 'atomic-failure-test-key',
        roomId: 'room-1',
        customerId: 'customer-1',
        type: DepositType.BOOKING,
        amount: 1_000_000,
      }, 'user-1')).rejects.toThrow('DATABASE_CONNECTION_LOST');

      // Since Prisma $transaction wraps the callback, the error bubbles and Prisma rolls back the entire unit of work
      expect(prisma.tx.$transaction).toHaveBeenCalled();
    });
  });
});
