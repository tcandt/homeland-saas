import { describe, expect, it, vi } from 'vitest';
import { WorkflowEngine } from './workflow.engine';

describe('WorkflowEngine', () => {
  function createEngine() {
    const prisma = {
      chartOfAccount: {
        findFirst: vi.fn(),
      },
      workflowExecution: {
        create: vi.fn(),
        update: vi.fn(),
      },
      workflowStepExecution: {
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const communicationService = {
      dispatch: vi.fn(),
      dispatchDirect: vi.fn(),
    };
    const analyticsCache = {
      invalidateDashboard: vi.fn(),
      invalidateFinance: vi.fn(),
    };
    const journalEntryService = {
      createJournalEntry: vi.fn(),
    };
    const documentsService = {
      generateDocument: vi.fn(),
      requestSignature: vi.fn(),
    };

    return {
      prisma,
      journalEntryService,
      engine: new WorkflowEngine(
        prisma as any,
        communicationService as any,
        analyticsCache as any,
        journalEntryService as any,
        documentsService as any,
      ),
    };
  }

  it('posts collected deposits to bank and deposit liability accounts', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'deposit-liability', code: '1300' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1',
      sourceType: 'DEPOSIT',
      sourceId: 'deposit-1',
      amount: 100000,
      metadata: { code: 'DEP-001' },
    });

    expect(prisma.chartOfAccount.findFirst).toHaveBeenNthCalledWith(2, {
      where: { tenantId: 'tenant-1', code: '1300' },
    });
    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        sourceType: 'DEPOSIT',
        sourceId: 'deposit-1',
        lines: [
          expect.objectContaining({ accountId: 'bank-account', type: 'DEBIT', amount: 100000 }),
          expect.objectContaining({ accountId: 'deposit-liability', type: 'CREDIT', amount: 100000 }),
        ],
      }),
    );
  });

  it('posts paid invoices to bank and rental revenue accounts', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'rental-revenue', code: '4000' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1',
      sourceType: 'INVOICE',
      sourceId: 'invoice-1',
      amount: 500000,
      metadata: { code: 'INV-001' },
    });

    expect(prisma.chartOfAccount.findFirst).toHaveBeenNthCalledWith(2, {
      where: { tenantId: 'tenant-1', code: '4000' },
    });
    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        sourceType: 'INVOICE',
        sourceId: 'invoice-1',
        lines: [
          expect.objectContaining({ accountId: 'bank-account', type: 'DEBIT', amount: 500000 }),
          expect.objectContaining({ accountId: 'rental-revenue', type: 'CREDIT', amount: 500000 }),
        ],
      }),
    );
  });

  it('posts refunded deposits to deposit liability and bank accounts', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'deposit-liability', code: '1300' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1',
      sourceType: 'REFUND',
      sourceId: 'deposit-1',
      amount: 100000,
      metadata: { code: 'DEP-001', refundSourceType: 'DEPOSIT' },
    });

    expect(prisma.chartOfAccount.findFirst).toHaveBeenNthCalledWith(2, {
      where: { tenantId: 'tenant-1', code: '1300' },
    });
    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        sourceType: 'REFUND',
        sourceId: 'deposit-1',
        lines: [
          expect.objectContaining({ accountId: 'deposit-liability', type: 'DEBIT', amount: 100000 }),
          expect.objectContaining({ accountId: 'bank-account', type: 'CREDIT', amount: 100000 }),
        ],
      }),
    );
  });

  it('posts deducted deposits to deposit liability and forfeiture revenue accounts', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'deposit-liability', code: '1300' })
      .mockResolvedValueOnce({ id: 'forfeiture-revenue', code: '4300' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1',
      sourceType: 'ADJUSTMENT',
      sourceId: 'deposit-1',
      amount: 100000,
      metadata: { code: 'DEP-001', adjustmentType: 'DEPOSIT_DEDUCTION' },
    });

    expect(prisma.chartOfAccount.findFirst).toHaveBeenNthCalledWith(1, {
      where: { tenantId: 'tenant-1', code: '1300' },
    });
    expect(prisma.chartOfAccount.findFirst).toHaveBeenNthCalledWith(2, {
      where: { tenantId: 'tenant-1', code: '4300' },
    });
    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        sourceType: 'ADJUSTMENT',
        sourceId: 'deposit-1',
        lines: [
          expect.objectContaining({ accountId: 'deposit-liability', type: 'DEBIT', amount: 100000 }),
          expect.objectContaining({ accountId: 'forfeiture-revenue', type: 'CREDIT', amount: 100000 }),
        ],
      }),
    );
  });

  it('posts retained deposits to deposit liability and forfeiture revenue accounts', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'deposit-liability', code: '1300' })
      .mockResolvedValueOnce({ id: 'forfeiture-revenue', code: '4300' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1',
      sourceType: 'ADJUSTMENT',
      sourceId: 'deposit-keep-1',
      amount: 4000000,
      metadata: { code: 'DEP-KEEP-001', adjustmentType: 'DEPOSIT_RETAINED' },
    });

    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        sourceType: 'ADJUSTMENT',
        sourceId: 'deposit-keep-1',
        description: 'Giu coc DEP-KEEP-001',
        lines: [
          expect.objectContaining({ accountId: 'deposit-liability', type: 'DEBIT', amount: 4000000 }),
          expect.objectContaining({ accountId: 'forfeiture-revenue', type: 'CREDIT', amount: 4000000 }),
        ],
      }),
    );
  });

  it('posts contract settlement refunds to contra revenue and bank accounts', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'settlement-contra-revenue', code: '4015' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1',
      sourceType: 'REFUND',
      sourceId: 'contract-1',
      amount: 350000,
      metadata: { code: 'C-001', refundSourceType: 'CONTRACT_SETTLEMENT' },
    });

    expect(prisma.chartOfAccount.findFirst).toHaveBeenNthCalledWith(1, {
      where: { tenantId: 'tenant-1', code: '1100' },
    });
    expect(prisma.chartOfAccount.findFirst).toHaveBeenNthCalledWith(2, {
      where: { tenantId: 'tenant-1', code: '4015' },
    });
    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        sourceType: 'REFUND',
        sourceId: 'contract-1',
        lines: [
          expect.objectContaining({ accountId: 'settlement-contra-revenue', type: 'DEBIT', amount: 350000 }),
          expect.objectContaining({ accountId: 'bank-account', type: 'CREDIT', amount: 350000 }),
        ],
      }),
    );
  });
});
