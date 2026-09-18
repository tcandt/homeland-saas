import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { FinanceReportingService } from './finance-reporting.service';

const room = { id: 'room-1', code: 'R-1', building: { id: 'building-1', code: 'B-1', owner: { id: 'owner-1', code: 'O-1' } } };
const contract = { id: 'contract-1', code: 'C-1', customer: { id: 'customer-1' }, rentalCycle: { id: 'cycle-1' }, room };
const invoice = { id: 'invoice-1', code: 'I-1', customer: { id: 'customer-1' }, rentalCycle: { id: 'cycle-1' }, contract };

function line(id: string, entry: any, type: 'DEBIT' | 'CREDIT', amount: number, account: any) {
  return { id, tenantId: 'tenant-1', type, amount, journalEntry: entry, account, costCenter: null };
}

function serviceWith(lines: any[], overrides: Record<string, any> = {}) {
  const present = { id: 'in-scope' };
  const prisma: any = {
    journalLine: { findMany: vi.fn().mockResolvedValue(lines) },
    journalEntry: { findMany: vi.fn().mockResolvedValue([lines[0]?.journalEntry].filter(Boolean)) },
    invoice: { findMany: vi.fn().mockResolvedValue([invoice]) },
    payment: { findMany: vi.fn().mockResolvedValue([]) },
    deposit: { findMany: vi.fn().mockResolvedValue([]) },
    expense: { findMany: vi.fn().mockResolvedValue([]) },
    contract: { findFirst: vi.fn().mockResolvedValue(present), findMany: vi.fn().mockResolvedValue([]) },
    creditNote: { findMany: vi.fn().mockResolvedValue([]) },
    owner: { findFirst: vi.fn().mockResolvedValue(present) },
    building: { findFirst: vi.fn().mockResolvedValue(present) },
    room: { findFirst: vi.fn().mockResolvedValue(present) },
    customer: { findFirst: vi.fn().mockResolvedValue(present) },
    rentalCycle: { findFirst: vi.fn().mockResolvedValue(present) },
    ...overrides,
  };
  return { prisma, service: new FinanceReportingService(prisma, { dispatch: vi.fn() } as any) };
}

describe('FinanceReportingService reconciliation', () => {
  it('uses each posted/reversed journal line once and nets the reversal with exact source trace', async () => {
    const revenue = { id: 'rev', code: '4000', name: 'Rental revenue', type: 'REVENUE' };
    const receivable = { id: 'ar', code: '1200', name: 'Receivable', type: 'ASSET' };
    const original = { id: 'journal-1', code: 'JE-1', status: 'REVERSED', entryDate: new Date('2026-09-01'), sourceType: 'INVOICE', sourceId: 'invoice-1' };
    const reversal = { id: 'journal-2', code: 'REV-JE-1', status: 'POSTED', entryDate: new Date('2026-09-02'), sourceType: 'REVERSAL', sourceId: 'journal-1' };
    const { service, prisma } = serviceWith([
      line('line-1', original, 'DEBIT', 100, receivable), line('line-2', original, 'CREDIT', 100, revenue),
      line('line-3', reversal, 'CREDIT', 100, receivable), line('line-4', reversal, 'DEBIT', 100, revenue),
    ], { journalEntry: { findMany: vi.fn().mockResolvedValue([original]) } });

    const result = await service.getReconciliation('tenant-1', { period: '2026-09', ownerId: 'owner-1', buildingId: 'building-1', roomId: 'room-1', customerId: 'customer-1', contractId: 'contract-1', rentalCycleId: 'cycle-1' });

    expect(result.lines).toHaveLength(4);
    expect(new Set(result.lines.map((row: any) => row.journalLineId)).size).toBe(4);
    expect(result.totals).toMatchObject({ debit: 200, credit: 200, net: 0, revenue: 0, expense: 0 });
    expect(result.lines.find((row: any) => row.journalEntryId === 'journal-2')).toMatchObject({ reversalOfJournalEntryId: 'journal-1', source: { resolved: true, path: expect.stringContaining('INVOICE:invoice-1') } });
    expect(prisma.journalLine.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }));
  });

  it('groups the same filtered lines for every dimension, including the unresolved bucket', async () => {
    const cash = { id: 'cash', code: '1100', name: 'Bank', type: 'ASSET' };
    const known = { id: 'journal-1', code: 'JE-1', status: 'POSTED', entryDate: new Date('2026-09-01'), sourceType: 'INVOICE', sourceId: 'invoice-1' };
    const unknown = { id: 'journal-unknown', code: 'JE-X', status: 'POSTED', entryDate: new Date('2026-09-01'), sourceType: 'PAYMENT', sourceId: 'foreign-payment' };
    const { service } = serviceWith([line('line-1', known, 'DEBIT', 100, cash), line('line-x', unknown, 'CREDIT', 40, cash)]);
    const result = await service.getReconciliation('tenant-1');

    expect(result.lines.find((row: any) => row.journalLineId === 'line-x').source).toMatchObject({ resolved: false, id: 'foreign-payment' });
    for (const groups of Object.values(result.groups) as any[]) {
      expect(groups.reduce((sum, group) => sum + group.net, 0)).toBe(result.totals.net);
      expect(groups.some((group) => group.bucket === 'UNRESOLVED')).toBe(true);
    }
  });

  it('resolves payment, deposit and expense only through their tenant-scoped source records', async () => {
    const expenseAccount = { id: 'expense-account', code: '6000', name: 'Repair', type: 'EXPENSE' };
    const asset = { id: 'asset', code: '1200', name: 'Receivable', type: 'ASSET' };
    const payment = { id: 'payment-1', code: 'PAY-1', invoice: { ...invoice }, rentalCycle: { id: 'cycle-1' } };
    const deposit = { id: 'deposit-1', code: 'DEP-1', customer: { id: 'customer-1' }, rentalCycle: { id: 'cycle-1' }, contract, room };
    const expense = { id: 'expense-1', code: 'EXP-1', ownerId: 'owner-1', buildingId: 'building-1', roomId: 'room-1', owner: { id: 'owner-1' }, costCenter: { id: 'cc-1', code: 'CC-1', ownerId: 'owner-1', buildingId: 'building-1' } };
    const { service } = serviceWith([
      line('payment-line', { id: 'payment-je', code: 'JE-P', status: 'POSTED', entryDate: new Date('2026-09-01'), sourceType: 'PAYMENT', sourceId: 'payment-1' }, 'DEBIT', 20, asset),
      line('deposit-line', { id: 'deposit-je', code: 'JE-D', status: 'POSTED', entryDate: new Date('2026-09-01'), sourceType: 'DEPOSIT', sourceId: 'deposit-1' }, 'CREDIT', 20, asset),
      line('expense-line', { id: 'expense-je', code: 'JE-E', status: 'POSTED', entryDate: new Date('2026-09-01'), sourceType: 'EXPENSE', sourceId: 'expense-1' }, 'DEBIT', 10, expenseAccount),
    ], {
      payment: { findMany: vi.fn().mockResolvedValue([payment]) },
      deposit: { findMany: vi.fn().mockResolvedValue([deposit]) },
      expense: { findMany: vi.fn().mockResolvedValue([expense]) },
    });
    const result = await service.getReconciliation('tenant-1', { buildingId: 'building-1' });
    expect(result.lines.map((row: any) => row.source.kind)).toEqual(['PAYMENT', 'DEPOSIT', 'EXPENSE']);
    expect(result.totals).toMatchObject({ debit: 30, credit: 20, expense: 10 });
  });

  it('rejects cross-tenant dimensions and validates dates before reading journal lines', async () => {
    const { service, prisma } = serviceWith([], { owner: { findFirst: vi.fn().mockResolvedValue(null) } });
    await expect(service.getReconciliation('tenant-1', { ownerId: 'owner-other' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getReconciliation('tenant-1', { period: '2026-13' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.journalLine.findMany).not.toHaveBeenCalled();
  });
});
