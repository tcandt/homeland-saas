import { describe, expect, it, vi } from 'vitest';
import { WorkflowEngine } from './workflow.engine';

describe('WorkflowEngine', () => {
  function createEngine() {
    const prisma = {
      appSetting: {
        findUnique: vi.fn(),
      },
      customer: {
        findUnique: vi.fn(),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      chartOfAccount: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      workflowExecution: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      workflowStepExecution: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      $queryRaw: vi.fn(),
      $transaction: vi.fn(async (callback: any) => callback(prisma)),
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
      communicationService,
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

  it('sends admin group Zalo notification for SePay payment confirmation when enabled', async () => {
    const { engine, prisma, communicationService } = createEngine();
    prisma.appSetting.findUnique.mockResolvedValueOnce({ value: { adminGroupChatId: 'admin-group-1' } });

    await (engine as any).executeStep('SEND_ADMIN_GROUP_ZALO', {
      tenantId: 'tenant-1',
      sourceType: 'INVOICE',
      sourceId: 'invoice-1',
      customerName: 'Khach A',
      roomCode: '31.06',
      roomRentalTypeLabel: 'Phòng ghép',
      roomMemberCount: 2,
      buildingName: 'Toa A',
      amount: 3500000,
      paymentProvider: 'SEPAY',
      paymentRef: 'txn-1',
      metadata: { code: 'INV-001' },
    });

    expect(communicationService.dispatchDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        channel: 'ZALO',
        recipient: 'admin-group-1',
        context: expect.objectContaining({
          chatId: 'admin-group-1',
          zaloChatId: 'admin-group-1',
          adminGroupChatId: 'admin-group-1',
          title: 'Admin - Đã nhận thanh toán INV-001',
          message: expect.stringContaining('Mã giao dịch: txn-1'),
        }),
      }),
    );
  });

  it('sends booking-hold payment details to the admin group, including move-in date', async () => {
    const { engine, prisma, communicationService } = createEngine();
    prisma.appSetting.findUnique.mockResolvedValueOnce({
      value: {
        recentWebhookChats: [{ chatId: 'admin-group-from-webhook', chatType: 'group' }],
      },
    });

    await (engine as any).executeStep('SEND_ADMIN_GROUP_ZALO', {
      tenantId: 'tenant-1',
      sourceType: 'INVOICE',
      sourceId: 'invoice-1',
      customerName: 'Huỳnh Hoàng Hạnh',
      roomCode: '31-01',
      buildingName: 'LK01',
      paymentAmount: 1350000,
      paidAmount: 1350000,
      paymentProvider: 'SEPAY',
      paymentRef: 'TXN-1350',
      paidAt: '2026-09-22T01:00:00.000Z',
      moveInDate: '2026-10-01T00:00:00.000Z',
      metadata: { code: 'HD-COC-001', bookingHoldDepositInvoice: true },
    }, undefined, 'invoice.paid');

    expect(communicationService.dispatchDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'admin-group-from-webhook',
        context: expect.objectContaining({
          title: 'Admin - Đã nhận cọc giữ phòng HD-COC-001',
          message: expect.stringContaining('Ngày vào ở/dự kiến vào ở:'),
        }),
      }),
    );
    expect(communicationService.dispatchDirect.mock.calls[0][0].context.message).toContain('Mã giao dịch: TXN-1350');
    expect(communicationService.dispatchDirect.mock.calls[0][0].context.message).toContain('Phòng: 31-01');
    expect(communicationService.dispatchDirect.mock.calls[0][0].context.message).toContain('Tòa nhà: LK01');
  });

  it('still sends admin payment Zalo when customer SePay Zalo result is disabled', async () => {
    const { engine, prisma, communicationService } = createEngine();
    prisma.appSetting.findUnique.mockResolvedValueOnce({ value: { adminGroupChatId: 'admin-group-1' } });

    await (engine as any).executeStep('SEND_ADMIN_GROUP_ZALO', {
      tenantId: 'tenant-1',
      sourceType: 'INVOICE',
      sourceId: 'invoice-1',
      customerName: 'Khach A',
      amount: 150000,
      paymentProvider: 'SEPAY',
      paymentRef: 'txn-150',
      metadata: { code: 'INV-150' },
    }, undefined, 'invoice.payment.recorded');

    expect(prisma.appSetting.findUnique).toHaveBeenCalledTimes(1);
    expect(communicationService.dispatchDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'admin-group-1',
        context: expect.objectContaining({
          message: expect.stringContaining('Mã giao dịch: txn-150'),
        }),
      }),
    );
  });

  it('fails payment admin Zalo step when admin group is not configured so outbox can retry', async () => {
    const { engine, prisma, communicationService } = createEngine();
    prisma.appSetting.findUnique
      .mockResolvedValueOnce({ value: {} })
      .mockResolvedValueOnce({ value: {} });

    await expect((engine as any).executeStep('SEND_ADMIN_GROUP_ZALO', {
      tenantId: 'tenant-1',
      sourceType: 'INVOICE',
      sourceId: 'invoice-1',
      amount: 150000,
      paymentProvider: 'SEPAY',
      metadata: { code: 'INV-150' },
    }, undefined, 'invoice.payment.recorded')).rejects.toThrow('ZALO_ADMIN_GROUP_CHAT_ID_REQUIRED');

    expect(communicationService.dispatchDirect).not.toHaveBeenCalled();
  });

  it('propagates payment admin Zalo delivery errors so the workflow records a failed step', async () => {
    const { engine, prisma, communicationService } = createEngine();
    prisma.appSetting.findUnique.mockResolvedValueOnce({ value: { adminGroupChatId: 'admin-group-1' } });
    communicationService.dispatchDirect.mockRejectedValueOnce(new Error('Zalo rejected chat'));

    await expect((engine as any).executeStep('SEND_ADMIN_GROUP_ZALO', {
      tenantId: 'tenant-1',
      sourceType: 'INVOICE',
      sourceId: 'invoice-1',
      amount: 150000,
      paymentProvider: 'SEPAY',
      metadata: { code: 'INV-150' },
    }, undefined, 'invoice.payment.recorded')).rejects.toThrow('Zalo rejected chat');
  });

  it('skips Zalo payment confirmations when sepay.sendPaymentResultToZalo is false', async () => {
    const { engine, prisma, communicationService } = createEngine();
    prisma.appSetting.findUnique.mockResolvedValueOnce({ value: { sendPaymentResultToZalo: false } });

    await (engine as any).executeStep('SEND_PAYMENT_CONFIRMATION_ZALO', {
      tenantId: 'tenant-1',
      customerZaloChatId: 'chat-1',
      paymentProvider: 'SEPAY',
      metadata: { code: 'INV-001' },
    }, { templateCode: 'INVOICE_ZALO_PAYMENT_CONFIRMATION' });

    expect(communicationService.dispatchDirect).not.toHaveBeenCalled();
  });

  it('resolves the current customer Zalo chat after an outbox payload was created', async () => {
    const { engine, prisma, communicationService } = createEngine();
    prisma.appSetting.findUnique.mockResolvedValueOnce({ value: { sendPaymentResultToZalo: true } });
    prisma.customer.findUnique.mockResolvedValueOnce({ zaloChatId: 'current-chat-1', zaloUserId: null });
    communicationService.dispatchDirect.mockResolvedValue({ delivered: true });

    await (engine as any).executeStep('SEND_PAYMENT_CONFIRMATION_ZALO', {
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      paymentProvider: 'SEPAY',
      metadata: { code: 'INV-001', paymentStatus: 'PAID' },
      paymentAmount: 1000000,
      amount: 1000000,
    }, { templateCode: 'INVOICE_ZALO_PAYMENT_CONFIRMATION' });

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { id: 'customer-1', tenantId: 'tenant-1' },
      select: { zaloChatId: true, zaloUserId: true },
    });
    expect(communicationService.dispatchDirect).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'current-chat-1' }),
    );
  });

  it('creates an admin in-app notification for every active tenant user', async () => {
    const { engine, prisma, communicationService } = createEngine();
    prisma.user.findMany.mockResolvedValueOnce([
      { id: 'admin-1', roles: [{ role: { code: 'ADMIN' } }] },
      { id: 'admin-2', roles: [{ role: { code: 'FINANCE' } }] },
    ]);

    await (engine as any).executeStep('CREATE_ADMIN_IN_APP_NOTIFICATION', {
      tenantId: 'tenant-1',
      sourceType: 'INVOICE',
      sourceId: 'invoice-1',
      customerName: 'Khach A',
      amount: 1000000,
      metadata: { code: 'INV-001' },
    }, { templateCode: 'SYSTEM_ALERT' });

    expect(communicationService.dispatch).toHaveBeenCalledTimes(2);
    expect(communicationService.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'admin-1',
        channel: 'IN_APP',
      }),
    );
  });

  it('continues payment notifications when journal posting fails', async () => {
    const { engine, prisma, communicationService, journalEntryService } = createEngine();
    prisma.workflowExecution.create.mockResolvedValue({ id: 'execution-1' });
    prisma.workflowStepExecution.create.mockImplementation(async ({ data }: any) => ({ id: `step-${data.order}` }));
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'rental-revenue', code: '4000' });
    journalEntryService.createJournalEntry.mockRejectedValueOnce(new Error('Ledger unavailable'));
    prisma.user.findMany.mockResolvedValueOnce([
      { id: 'admin-1', roles: [{ role: { code: 'ADMIN' } }] },
    ]);
    prisma.appSetting.findUnique
      .mockResolvedValueOnce({ value: { sendPaymentResultToZalo: true } })
      .mockResolvedValueOnce({ value: { adminGroupChatId: 'group-1' } });
    communicationService.dispatchDirect.mockResolvedValue({ delivered: true });

    await engine.executeWorkflow('invoice.paid.workflow', 'invoice.paid', {
      tenantId: 'tenant-1',
      sourceType: 'INVOICE',
      sourceId: 'invoice-1',
      customerId: 'customer-1',
      amount: 500000,
      paymentAmount: 500000,
      paymentProvider: 'SEPAY',
      metadata: { code: 'INV-001' },
    });

    expect(communicationService.dispatchDirect).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'group-1', channel: 'ZALO' }),
    );
    expect(communicationService.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        templateCode: 'PAYMENT_RECEIVED',
      }),
    );
    expect(prisma.workflowStepExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'Ledger unavailable',
        }),
      }),
    );
    expect(prisma.workflowExecution.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  it('rejects outbox delivery when a non-blocking workflow step fails so the outbox can retry', async () => {
    const { engine, prisma, communicationService, journalEntryService } = createEngine();
    prisma.workflowExecution.create.mockResolvedValue({ id: 'execution-1' });
    prisma.workflowExecution.findFirst.mockResolvedValue(null);
    prisma.workflowStepExecution.findFirst.mockResolvedValue(null);
    prisma.workflowStepExecution.create.mockImplementation(async ({ data }: any) => ({ id: `step-${data.order}` }));
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'rental-revenue', code: '4000' });
    journalEntryService.createJournalEntry.mockRejectedValueOnce(new Error('Ledger unavailable'));
    prisma.user.findMany.mockResolvedValueOnce([
      { id: 'admin-1', roles: [{ role: { code: 'ADMIN' } }] },
    ]);
    prisma.appSetting.findUnique
      .mockResolvedValueOnce({ value: { sendPaymentResultToZalo: true } })
      .mockResolvedValueOnce({ value: { adminGroupChatId: 'group-1' } });
    communicationService.dispatchDirect.mockResolvedValue({ delivered: true });

    await expect(engine.executeWorkflow('invoice.paid.workflow', 'invoice.paid', {
      tenantId: 'tenant-1',
      sourceType: 'INVOICE',
      sourceId: 'invoice-1',
      customerId: 'customer-1',
      amount: 500000,
      paymentAmount: 500000,
      paymentProvider: 'SEPAY',
      metadata: { code: 'INV-001' },
      outboxEventId: 'outbox-1',
      outboxDelivery: true,
    })).rejects.toThrow('WORKFLOW_COMPLETED_WITH_ERRORS');

    expect(communicationService.dispatchDirect).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'group-1', channel: 'ZALO' }),
    );
    expect(prisma.workflowExecution.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  it('rejects outbox delivery when the same outbox workflow is already running', async () => {
    const { engine, prisma } = createEngine();
    prisma.workflowExecution.findFirst.mockResolvedValueOnce({
      id: 'running-execution-1',
      status: 'RUNNING',
    });

    await expect(engine.executeWorkflow('invoice.paid.workflow', 'invoice.paid', {
      tenantId: 'tenant-1',
      sourceType: 'INVOICE',
      sourceId: 'invoice-1',
      amount: 500000,
      outboxEventId: 'outbox-1',
      outboxDelivery: true,
    })).rejects.toThrow('WORKFLOW_ALREADY_RUNNING');

    expect(prisma.workflowExecution.create).not.toHaveBeenCalled();
  });

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

  it('does not post booking-hold deposit invoices as rental revenue', async () => {
    const { engine, prisma, journalEntryService } = createEngine();

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1',
      sourceType: 'INVOICE',
      sourceId: 'invoice-booking-hold-1',
      amount: 1000000,
      metadata: {
        code: 'HD-COC-001',
        period: 'Cọc giữ phòng',
        bookingHoldDepositInvoice: true,
      },
    });

    expect(prisma.chartOfAccount.findFirst).not.toHaveBeenCalled();
    expect(journalEntryService.createJournalEntry).not.toHaveBeenCalled();
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

  it('applies settlement deposit credit to liability and rental revenue accounts', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'deposit-liability', code: '1300' })
      .mockResolvedValueOnce({ id: 'rental-revenue', code: '4000' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1',
      sourceType: 'ADJUSTMENT',
      sourceId: 'contract-1',
      amount: 300000,
      metadata: { code: 'C-001', adjustmentType: 'DEPOSIT_SETTLEMENT_APPLICATION' },
    });

    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        sourceType: 'ADJUSTMENT',
        sourceId: 'contract-1',
        description: 'Can coc quyet toan C-001',
        lines: [
          expect.objectContaining({ accountId: 'deposit-liability', type: 'DEBIT', amount: 300000 }),
          expect.objectContaining({ accountId: 'rental-revenue', type: 'CREDIT', amount: 300000 }),
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

  it('splits contract settlement refunds between deposit liability and contra revenue', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'deposit-liability', code: '1300' })
      .mockResolvedValueOnce({ id: 'settlement-contra-revenue', code: '4015' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1',
      sourceType: 'REFUND',
      sourceId: 'contract-2',
      amount: 700000,
      metadata: {
        code: 'C-002',
        refundSourceType: 'CONTRACT_SETTLEMENT',
        accountingBreakdown: {
          depositRefundAmount: 500000,
          revenueRefundAmount: 200000,
        },
      },
    });

    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        sourceType: 'REFUND',
        sourceId: 'contract-2',
        lines: [
          expect.objectContaining({ accountId: 'deposit-liability', type: 'DEBIT', amount: 500000 }),
          expect.objectContaining({ accountId: 'settlement-contra-revenue', type: 'DEBIT', amount: 200000 }),
          expect.objectContaining({ accountId: 'bank-account', type: 'CREDIT', amount: 700000 }),
        ],
      }),
    );
  });
});
