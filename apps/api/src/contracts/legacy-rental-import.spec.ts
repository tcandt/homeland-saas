import { describe, expect, it, vi } from 'vitest';
import { ImportExistingContractSchema } from '@homeland/shared';
import { ContractsService } from './contracts.service';
import { isLegacyBillingCovered, LEGACY_OPENING_POLICY, missingLegacyDocuments, parseLegacyDate } from './legacy-rental-import';

const command = () => ImportExistingContractSchema.parse({
  idempotencyKey: 'legacy-key-123', customerId: 'customer-1', roomId: 'room-1',
  startDate: '2026-01-01', endDate: '2027-10-15', paidThrough: '2026-10-31',
  rentAmount: 3000000, depositAmount: 6000000,
});

function subject() {
  const customer = { id: 'customer-1', tenantId: 'tenant-1', fullName: 'Old tenant', roomId: null, idImages: [] };
  const room = { id: 'room-1', tenantId: 'tenant-1', status: 'AVAILABLE', rentalType: 'WHOLE', capacity: 2 };
  let saved: any = null;
  const tx: any = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'locked' }]),
    contract: {
      findFirst: vi.fn(async (query: any) => query.where.activationIdempotencyKey ? saved : null),
      create: vi.fn(async ({ data }: any) => { saved = { id: 'contract-1', ...data }; return saved; }),
      count: vi.fn().mockResolvedValue(0),
    },
    customer: { findFirst: vi.fn().mockResolvedValue(customer), findMany: vi.fn().mockResolvedValue([customer]), updateMany: vi.fn() },
    room: { findFirst: vi.fn().mockResolvedValue(room), update: vi.fn() },
    rentalCycle: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'cycle-1' }) },
    occupancy: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
    contractParty: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), updateMany: vi.fn() },
    roomHold: { count: vi.fn().mockResolvedValue(0) },
    billingSnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
    deposit: { create: vi.fn().mockResolvedValue({ id: 'deposit-1' }) },
    depositOperation: { create: vi.fn().mockResolvedValue({ id: 'operation-1' }) },
    depositLedgerEntry: { create: vi.fn() }, documentVersion: { findFirst: vi.fn().mockResolvedValue(null) },
    auditLog: { create: vi.fn() }, invoice: { create: vi.fn() }, receipt: { create: vi.fn() },
  };
  const prisma = { tx: { $transaction: vi.fn((work: any) => work(tx)) } };
  const service = new ContractsService({} as any, {} as any, prisma as any, {} as any, {} as any);
  return { service, tx, customer, room };
}

describe('existing rental opening balances', () => {
  it('creates ACTIVE occupancy with original dates, deposit ledger and audit, without new receipts or invoices', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T08:00:00Z'));
    try {
      const { service, tx } = subject(); const input = command();
      const result = await service.importExisting(input, 'user-1', 'tenant-1', input.idempotencyKey);
      expect(result.contract).toMatchObject({ status: 'ACTIVE', startDate: new Date('2026-01-01'),
        endDate: new Date('2027-10-15'), firstPaymentDate: new Date('2026-11-01') });
      expect(result.missingDocuments).toEqual(['CCCD_FRONT', 'CCCD_BACK', 'CONTRACT_FILE']);
      expect(tx.depositLedgerEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({
        balanceEffect: 6000000, sourceType: 'REVIEWED_OPENING_BALANCE', metadata: expect.objectContaining({ cashflow: false }),
      }) });
      expect(tx.occupancy.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({
        joinedAt: new Date('2026-01-01'), tenantId: 'tenant-1', rentalCycleId: 'cycle-1',
      }) }));
      expect(tx.invoice.create).not.toHaveBeenCalled(); expect(tx.receipt.create).not.toHaveBeenCalled();
      expect(tx.auditLog.create).toHaveBeenCalledOnce();
      const replay = await service.importExisting(input, 'user-1', 'tenant-1', input.idempotencyKey);
      expect(replay.replayed).toBe(true); expect(tx.contract.create).toHaveBeenCalledOnce();
      await expect(service.importExisting({ ...input, depositAmount: 1 }, 'user-1', 'tenant-1', input.idempotencyKey))
        .rejects.toThrow('LEGACY_IMPORT_IDEMPOTENCY_KEY_REUSED');
    } finally { vi.useRealTimers(); }
  });

  it.each(['bound', 'occupied', 'pending', 'cycle', 'capacity', 'snapshot', 'foreign-file', 'foreign-room'])('fails closed for %s', async (scenario) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T08:00:00Z'));
    try {
      const { service, tx, customer } = subject(); const input = command();
      if (scenario === 'bound') customer.roomId = 'other-room' as any;
      if (scenario === 'occupied') tx.occupancy.findFirst.mockResolvedValue({ id: 'existing' });
      if (scenario === 'pending') tx.contract.findFirst.mockImplementation(async (q: any) => q.where.activationIdempotencyKey ? null : { id: 'pending' });
      if (scenario === 'cycle') tx.rentalCycle.findFirst.mockResolvedValue({ id: 'planned' });
      if (scenario === 'capacity') tx.occupancy.count.mockResolvedValue(2);
      if (scenario === 'snapshot') tx.billingSnapshot.findFirst.mockResolvedValue({ id: 'immutable' });
      if (scenario === 'foreign-file') input.attachments = ['document-storage://foreign/file.pdf'];
      if (scenario === 'foreign-room') tx.room.findFirst.mockResolvedValue(null);
      await expect(service.importExisting(input, 'user-1', 'tenant-1', input.idempotencyKey)).rejects.toThrow();
      expect(tx.contract.create).not.toHaveBeenCalled(); expect(tx.depositLedgerEntry.create).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it('does not create a fictional deposit when the opening balance is zero', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T08:00:00Z'));
    try {
      const { service, tx } = subject(); const input = { ...command(), depositAmount: 0 };
      await service.importExisting(input, 'user-1', 'tenant-1', input.idempotencyKey);
      expect(tx.deposit.create).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it('requires explicit month-end coverage and valid dates', async () => {
    const { service, tx } = subject();
    await expect(service.importExisting({ ...command(), paidThrough: '2026-10-20' }, 'u', 't', 'legacy-key-123')).rejects.toThrow('LEGACY_IMPORT_DATE_RANGE_INVALID');
    expect(() => parseLegacyDate('2026-02-30')).toThrow('LEGACY_IMPORT_DATE_INVALID');
    expect(tx.contract.create).not.toHaveBeenCalled();
  });

  it('covers imported monthly periods but resumes normal billing the following month', () => {
    const contract = { termsSnapshot: { legacyImport: { policyVersion: LEGACY_OPENING_POLICY, paidThrough: '2026-10-31' } } };
    expect(isLegacyBillingCovered(contract, '2026-10')).toBe(true);
    expect(isLegacyBillingCovered(contract, '2026-11')).toBe(false);
    expect(isLegacyBillingCovered({}, '2026-10')).toBe(false);
    expect(missingLegacyDocuments({ idImages: ['front'], idImageProvenance: [{ url: 'front', side: 'front', status: 'APPROVED', approvedBy: 'u' }] }, ['file'])).toEqual(['CCCD_BACK']);
  });
});
