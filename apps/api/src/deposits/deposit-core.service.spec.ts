import { ConflictException } from '@nestjs/common';
import { DepositStatus, DepositType, RoomRentalType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DepositCoreService } from './deposit-core.service';

describe('DepositCoreService', () => {
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
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'ledger-1' }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      roomHold: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'hold-1' }),
      },
      room: { findFirst: vi.fn() },
      occupancy: { count: vi.fn().mockResolvedValue(0) },
      rentalCycle: {
        findFirst: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      contract: { findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0) },
      creditNote: { create: vi.fn() },
      receipt: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
      outboxEvent: { create: vi.fn().mockResolvedValue({ id: 'outbox-1' }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
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
      payments: [{ id: 'payment-1', tenantId: 'tenant-1', rentalCycleId: 'cycle-1', invoiceId: 'invoice-1', status: 'CONFIRMED', amount: 100_000, provider: 'MANUAL', paidAt: new Date() }],
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
    expect(summary.payments.items[0].source).toEqual({ entity: 'Payment', id: 'payment-1', code: null });
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
});
