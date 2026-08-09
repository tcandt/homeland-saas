import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { JournalEntryService } from './journal-entry.service';

describe('JournalEntryService', () => {
  function createService(prismaOverrides: Record<string, any> = {}) {
    const prisma = {
      journalEntry: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prisma)),
      ...prismaOverrides,
    };

    return {
      prisma,
      service: new JournalEntryService(prisma as any),
    };
  }

  it('creates a posted reversal entry with debit and credit lines swapped', async () => {
    const original = {
      id: 'journal-1',
      tenantId: 'tenant-1',
      code: 'JE-001',
      sourceType: 'EXPENSE',
      sourceId: 'expense-1',
      description: 'Expense paid',
      status: 'POSTED',
      lines: [
        { accountId: 'expense-account', costCenterId: 'cc-1', type: 'DEBIT', amount: 100000, description: 'Expense' },
        { accountId: 'cash-account', costCenterId: null, type: 'CREDIT', amount: 100000, description: 'Cash' },
      ],
    };
    const { service, prisma } = createService();
    prisma.journalEntry.findFirst
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(null);
    prisma.journalEntry.create.mockResolvedValue({
      id: 'reversal-1',
      code: 'REV-JE-001',
      lines: [],
    });

    await expect(service.reverseJournalEntry('tenant-1', 'journal-1', 'user-1', 'Fix posted entry')).resolves.toMatchObject({
      id: 'reversal-1',
      code: 'REV-JE-001',
    });

    expect(prisma.journalEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        code: 'REV-JE-001',
        sourceType: 'REVERSAL',
        sourceId: 'journal-1',
        status: 'POSTED',
        createdBy: 'user-1',
        lines: {
          create: [
            expect.objectContaining({ accountId: 'expense-account', type: 'CREDIT', amount: 100000 }),
            expect.objectContaining({ accountId: 'cash-account', type: 'DEBIT', amount: 100000 }),
          ],
        },
      }),
      include: { lines: true },
    }));
    expect(prisma.journalEntry.update).toHaveBeenCalledWith({
      where: { id: 'journal-1' },
      data: expect.objectContaining({
        status: 'REVERSED',
        reversedAt: expect.any(Date),
      }),
    });
  });

  it('returns existing reversal instead of creating a duplicate', async () => {
    const existingReversal = { id: 'reversal-1', sourceType: 'REVERSAL', sourceId: 'journal-1', lines: [] };
    const { service, prisma } = createService();
    prisma.journalEntry.findFirst
      .mockResolvedValueOnce({ id: 'journal-1', tenantId: 'tenant-1', code: 'JE-001', status: 'REVERSED', lines: [] })
      .mockResolvedValueOnce(existingReversal);

    await expect(service.reverseJournalEntry('tenant-1', 'journal-1')).resolves.toBe(existingReversal);
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    expect(prisma.journalEntry.update).not.toHaveBeenCalled();
  });

  it('rejects draft journal entries', async () => {
    const { service, prisma } = createService();
    prisma.journalEntry.findFirst.mockResolvedValueOnce({
      id: 'journal-1',
      tenantId: 'tenant-1',
      code: 'JE-001',
      status: 'DRAFT',
      lines: [],
    });

    await expect(service.reverseJournalEntry('tenant-1', 'journal-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });
});
