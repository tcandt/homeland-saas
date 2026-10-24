import { describe, expect, it, vi } from 'vitest';
import { DepositCoreService } from './deposit-core.service';
import { ROOM_VISIBLE_CONTRACT_STATUSES } from '../contracts/contracts.adapter';

function cycle(id: string, status = 'ACTIVE', amount = 100) {
  return {
    id, tenantId: 'tenant', customerId: 'same-customer', roomId: 'room', status: 'ACTIVE',
    customer: { id: 'same-customer', tenantId: 'tenant', fullName: 'Returning customer' },
    room: { id: 'room', tenantId: 'tenant', code: '101' },
    contracts: [{ id: `contract-${id}`, tenantId: 'tenant', customerId: 'same-customer', roomId: 'room', rentalCycleId: id, status, monthlyRent: 100, depositMoney: 0 }],
    deposits: [], payments: [], depositLedgerEntries: [], depositOperations: [],
    invoices: [{ id: `invoice-${id}`, code: `INV-${id}`, tenantId: 'tenant', customerId: 'same-customer', contractId: `contract-${id}`, rentalCycleId: id, status: 'ISSUED', total: amount, allocations: [] }],
  };
}

function fixture(rows: any[]) {
  const tx = {
    room: { findFirst: vi.fn().mockResolvedValue({ id: 'room', code: '101' }) },
    rentalCycle: { findMany: vi.fn().mockResolvedValue(rows) },
  };
  return { tx, service: new DepositCoreService({ tx } as any) };
}

describe('current room finance read scope', () => {
  it('selects by tenant/room/cycle relationships, not customer identity, and totals only returned cycles', async () => {
    const { tx, service } = fixture([cycle('new', 'DRAFT', 8_064_516)]);
    const summary = await service.getRoomFinanceSummary('tenant', 'room', 'current');
    const args = tx.rentalCycle.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ tenantId: 'tenant', roomId: 'room' });
    expect(args.where.OR).toEqual([
      { contracts: { some: { tenantId: 'tenant', roomId: 'room', deletedAt: null, status: { in: ROOM_VISIBLE_CONTRACT_STATUSES } } } },
      { occupancies: { some: { tenantId: 'tenant', roomId: 'room', leftAt: null, joinedAt: { lte: expect.any(Date) } } } },
      { contracts: { none: { tenantId: 'tenant', deletedAt: null } }, roomHolds: { some: { tenantId: 'tenant', roomId: 'room', status: 'ACTIVE', expiresAt: { gt: expect.any(Date) } } } },
    ]);
    expect(summary.totals).toMatchObject({ rentalCycles: 1, invoiceTotal: 8_064_516, outstanding: 8_064_516 });
    expect(summary.rentalCycles[0].invoices.families[0].sourceEntities).toEqual([{ entity: 'Invoice', id: 'invoice-new', code: 'INV-new' }]);
  });

  it('keeps the default historical endpoint and its totals unchanged for returning customers', async () => {
    const { tx, service } = fixture([cycle('old', 'TERMINATED', 200), cycle('new', 'DRAFT', 100)]);
    const summary = await service.getRoomFinanceSummary('tenant', 'room');
    expect(tx.rentalCycle.findMany.mock.calls[0][0].where).toEqual({ tenantId: 'tenant', roomId: 'room' });
    expect(summary.totals).toMatchObject({ rentalCycles: 2, invoiceTotal: 300, outstanding: 300 });
  });

  it('returns only the later current cycle when the same customer previously terminated a contract in this room', async () => {
    const oldCycle = cycle('old-return', 'TERMINATED', 200);
    const currentCycle = cycle('new-return', 'DRAFT', 8_064_516);
    const { tx, service } = fixture([oldCycle, currentCycle]);
    tx.rentalCycle.findMany.mockImplementation(async ({ where }: any) => {
      const visibleStatuses = where.OR[0].contracts.some.status.in;
      // This small relation-aware mock models the query boundary: the service
      // cannot decide currentness by customer identity or invoice history.
      return [oldCycle, currentCycle].filter((row) =>
        row.contracts.some((contract: any) => visibleStatuses.includes(contract.status)),
      );
    });

    const summary = await service.getRoomFinanceSummary('tenant', 'room', 'current');

    expect(summary.rentalCycles).toHaveLength(1);
    expect(summary.rentalCycles[0]).toMatchObject({ rentalCycleId: 'new-return' });
    expect(summary.rentalCycles[0].invoices.total).toBe(8_064_516);
    expect(summary.totals).toMatchObject({ rentalCycles: 1, invoiceTotal: 8_064_516, outstanding: 8_064_516 });
    expect(ROOM_VISIBLE_CONTRACT_STATUSES).not.toContain('TERMINATED');
  });

  it('retains every current shared-room cycle and returns zero for an empty room', async () => {
    const { tx, service } = fixture([cycle('active'), cycle('expiring', 'EXPIRING')]);
    expect((await service.getRoomFinanceSummary('tenant', 'room', 'current')).totals.rentalCycles).toBe(2);
    tx.rentalCycle.findMany.mockResolvedValueOnce([]);
    expect((await service.getRoomFinanceSummary('tenant', 'room', 'current')).totals).toMatchObject({ rentalCycles: 0, invoiceTotal: 0, outstanding: 0, depositBalance: 0 });
  });

  it('rejects an invalid scope before querying any data', async () => {
    const { tx, service } = fixture([]);
    await expect(service.getRoomFinanceSummary('tenant', 'room', 'unknown')).rejects.toThrow('INVALID_ROOM_FINANCE_SCOPE');
    expect(tx.room.findFirst).not.toHaveBeenCalled();
  });
});
