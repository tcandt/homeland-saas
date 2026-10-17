import { describe, expect, it, vi } from 'vitest';
import { TemplateEngine } from '../../communication/templates/template.engine';
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
      journalEntry: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      payment: { findFirst: vi.fn() },
      receipt: { findFirst: vi.fn() },
      deposit: { findFirst: vi.fn() },
      depositOperation: { findFirst: vi.fn() },
      depositLedgerEntry: { findFirst: vi.fn() },
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
      isExactReplay: vi.fn(),
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

  it('uses the deposit-collected template for a booking-hold invoice payment', async () => {
    const { engine, prisma, communicationService } = createEngine();
    prisma.appSetting.findUnique.mockResolvedValueOnce({ value: { adminGroupChatId: 'admin-group-1' } });

    await (engine as any).executeStep('SEND_ADMIN_GROUP_ZALO', {
      tenantId: 'tenant-1',
      sourceType: 'INVOICE',
      sourceId: 'invoice-hold-1',
      customerName: 'Khách A',
      amount: 2_000_000,
      paymentProvider: 'SEPAY',
      metadata: { code: 'HD-COC-001', bookingHoldDepositInvoice: true },
    }, { templateCode: 'ADMIN_INVOICE_PAID' }, 'invoice.paid');

    expect(communicationService.dispatchDirect).toHaveBeenCalledWith(expect.objectContaining({
      templateCode: 'ADMIN_DEPOSIT_COLLECTED',
      context: expect.objectContaining({
        headline: '✅ ĐÃ NHẬN CỌC',
        secondaryValue: 'Đã thu: 2.000.000 đ',
      }),
    }));
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

  it('sends a cash payment confirmation to the customer even when SePay result notifications are disabled', async () => {
    const { engine, prisma, communicationService } = createEngine();
    prisma.appSetting.findUnique.mockResolvedValueOnce({ value: { sendPaymentResultToZalo: false } });
    prisma.customer.findUnique.mockResolvedValueOnce({ zaloChatId: 'cash-client-1', zaloUserId: null });
    communicationService.dispatchDirect.mockResolvedValue({ delivered: true });

    await (engine as any).executeStep('SEND_PAYMENT_CONFIRMATION_ZALO', {
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      paymentProvider: 'MANUAL',
      paymentAmount: 4000000,
      amount: 4000000,
      metadata: { code: 'INV-CASH-001', paymentStatus: 'PAID' },
    }, { templateCode: 'INVOICE_ZALO_PAYMENT_CONFIRMATION' });

    expect(communicationService.dispatchDirect).toHaveBeenCalledWith(expect.objectContaining({
      recipient: 'cash-client-1',
      context: expect.objectContaining({
        paymentStatusLabel: 'Đã thu đủ bằng tiền mặt',
        paymentReceiptMessage: 'Đã nhận được thanh toán bằng tiền mặt với số tiền: 4.000.000 VND',
      }),
    }));
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

  it('uses the partial-payment template with the balance remaining after this payment', async () => {
    const { engine, prisma, communicationService } = createEngine();
    prisma.appSetting.findUnique.mockResolvedValueOnce({ value: { sendPaymentResultToZalo: true } });
    prisma.customer.findUnique.mockResolvedValueOnce({ zaloChatId: 'current-chat-1', zaloUserId: null });
    communicationService.dispatchDirect.mockResolvedValue({ delivered: true });

    await (engine as any).executeStep('SEND_PAYMENT_CONFIRMATION_ZALO', {
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      paymentProvider: 'SEPAY',
      paymentAmount: 3000000,
      paidAmount: 3000000,
      metadata: { code: 'INV-002', grossTotal: 6850000, creditAmount: 0, paymentStatus: 'PARTIALLY_PAID' },
    }, { templateCode: 'INVOICE_ZALO_PARTIAL_PAYMENT_CONFIRMATION' });

    expect(communicationService.dispatchDirect).toHaveBeenCalledWith(expect.objectContaining({
      templateCode: 'INVOICE_ZALO_PARTIAL_PAYMENT_CONFIRMATION',
      recipient: 'current-chat-1',
      context: expect.objectContaining({ paymentAmount: 3000000, remainingAmount: 3850000 }),
    }));
  });

  it('uses the invoice gross total when rendering the admin remaining balance', () => {
    const { engine } = createEngine();

    const context = (engine as any).buildZaloEventTemplateContext({
      paymentAmount: 3000000,
      paidAmount: 3000000,
      metadata: { grossTotal: 6850000, creditAmount: 0 },
    }, { templateCode: 'ADMIN_INVOICE_PARTIAL' }, 'invoice.payment.recorded');

    expect(context.secondaryValue).toBe('Còn thiếu: 3.850.000 đ');
  });

  it('renders a settlement refund without assuming its payment status', () => {
    const { engine } = createEngine();

    const context = (engine as any).buildZaloEventTemplateContext({
      metadata: { refundToCustomer: 5650000 },
    }, { templateCode: 'ADMIN_CONTRACT_SETTLEMENT_COMPLETED' }, 'contract.settlement.completed');

    expect(context.primaryValue).toBe('Cọc hoàn lại: 5.650.000 đ');
    expect(context.secondaryValue).toBe('');
    expect(context.action).toBe('Kiểm tra trạng thái hoàn cọc.');
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

  it('supplies required SYSTEM_ALERT values for a raw deposit.created outbox payload', async () => {
    const { engine, communicationService } = createEngine();
    const templateEngine = new TemplateEngine();
    communicationService.dispatch.mockImplementation(({ context }: any) => {
      expect(templateEngine.compile('{{title}}\n{{message}}', context)).toContain('Cọc giữ phòng mới DEP-001');
    });

    await (engine as any).executeStep('CREATE_IN_APP_NOTIFICATION', {
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      sourceType: 'DEPOSIT',
      sourceId: 'deposit-1',
      amount: 2_000_000,
      metadata: { code: 'DEP-001' },
    }, { templateCode: 'SYSTEM_ALERT' }, 'deposit.created');

    expect(communicationService.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      templateCode: 'SYSTEM_ALERT',
      context: expect.objectContaining({
        title: 'Cọc giữ phòng mới DEP-001',
        message: expect.stringContaining('Cần chuẩn bị phòng'),
      }),
    }));
  });

  it('renders contract settlement alerts with the durable contract and customer context', async () => {
    const { engine, prisma, communicationService } = createEngine();
    prisma.appSetting.findUnique.mockResolvedValueOnce({ value: { adminGroupChatId: 'admin-group-1' } });
    const payload = {
      tenantId: 'tenant-1',
      userId: 'user-1',
      customerId: 'customer-1',
      customerName: 'Khách quyết toán',
      customerPhone: '0909000001',
      sourceType: 'CONTRACT',
      sourceId: 'contract-1',
      roomCode: 'P-101',
      roomRentalTypeLabel: 'Nguyên căn',
      buildingName: 'Tòa nhà A',
      amount: 250000,
      metadata: { code: 'CT-01', settlementId: 'settlement-1' },
    };
    const params = { templateCode: 'SYSTEM_ALERT', alertKind: 'CONTRACT_SETTLEMENT_COMPLETED' };

    await (engine as any).executeStep('CREATE_IN_APP_NOTIFICATION', payload, params, 'contract.settlement.completed');
    await (engine as any).executeStep('SEND_ADMIN_GROUP_ZALO', payload, params, 'contract.settlement.completed');

    const inAppContext = communicationService.dispatch.mock.calls[0][0].context;
    const adminContext = communicationService.dispatchDirect.mock.calls[0][0].context;
    for (const context of [inAppContext, adminContext]) {
      expect(context.title).toBe('Cập nhật quyết toán hợp đồng CT-01');
      expect(context.message).toContain('HomeLand - Quyết toán hợp đồng');
      expect(context.message).toContain('Mã: CT-01');
      expect(context.message).toContain('Khách: Khách quyết toán');
      expect(context.message).toContain('Phòng: P-101 (Nguyên căn)');
      expect(context.message).toContain('Tòa nhà: Tòa nhà A');
    }
  });

  it('continues payment notifications when journal posting fails', async () => {
    const { engine, prisma, communicationService, journalEntryService } = createEngine();
    prisma.workflowExecution.create.mockResolvedValue({ id: 'execution-1' });
    prisma.workflowStepExecution.create.mockImplementation(async ({ data }: any) => ({ id: `step-${data.order}` }));
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'rental-revenue', code: '4000' });
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-1', tenantId: 'tenant-1', invoiceId: 'invoice-1',
      amount: 500000, status: 'CONFIRMED', paidAt: new Date('2026-10-17T03:04:05.000Z'),
    });
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
      paymentId: 'payment-1',
      paymentProvider: 'SEPAY',
      metadata: { code: 'INV-001', paymentJournalIdentity: 'PAYMENT_V1' },
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
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-1', tenantId: 'tenant-1', invoiceId: 'invoice-1',
      amount: 500000, status: 'CONFIRMED', paidAt: new Date('2026-10-17T03:04:05.000Z'),
    });
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
      paymentId: 'payment-1',
      paymentProvider: 'SEPAY',
      metadata: { code: 'INV-001', paymentJournalIdentity: 'PAYMENT_V1' },
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

  it('posts each verified modern booking keep ledger entry from persisted evidence, not payload money', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    const createdAt = new Date('2026-10-17T04:05:06.000Z');
    prisma.depositLedgerEntry.findFirst.mockResolvedValue({
      id: 'ledger-keep-1', tenantId: 'tenant-1', depositId: 'booking-1', operationId: 'cancel-1',
      type: 'KEEP', amount: 400_000, balanceEffect: -400_000, sourceType: 'DEPOSIT_CANCELLATION', sourceId: 'booking-1', createdAt,
      operation: { id: 'cancel-1', tenantId: 'tenant-1', sourceDepositId: 'booking-1', type: 'CANCEL', status: 'COMPLETED', receiptId: null },
      deposit: { id: 'booking-1', tenantId: 'tenant-1', type: 'BOOKING', contract: { termsSnapshot: { bookingCommand: { depositId: 'booking-1', invoiceId: 'invoice-1' } } } },
    });
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'deposit-liability', code: '1300' })
      .mockResolvedValueOnce({ id: 'forfeiture-revenue', code: '4300' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1', sourceType: 'DEPOSIT', sourceId: 'booking-1', amount: 400_000,
      metadata: {
        bookingDispositionLedgerId: 'ledger-keep-1', bookingDispositionOperationId: 'cancel-1', bookingDispositionJournalMode: 'LEDGER_V1',
      },
    });

    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      code: 'JE-BC-5D0896BBE992C64CE7CB', sourceType: 'DEPOSIT', sourceId: 'booking-1', entryDate: createdAt, idempotent: true,
      lines: [
        expect.objectContaining({ accountId: 'deposit-liability', type: 'DEBIT', amount: 400_000 }),
        expect.objectContaining({ accountId: 'forfeiture-revenue', type: 'CREDIT', amount: 400_000 }),
      ],
    }));

    journalEntryService.createJournalEntry.mockClear();
    await expect((engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1', sourceType: 'DEPOSIT', sourceId: 'booking-other', amount: 1,
      metadata: {
        bookingDispositionLedgerId: 'ledger-keep-1', bookingDispositionOperationId: 'cancel-other', bookingDispositionJournalMode: 'LEDGER_V1',
      },
    })).rejects.toThrow('BOOKING_DISPOSITION_LEDGER_EVIDENCE_INVALID');
    expect(journalEntryService.createJournalEntry).not.toHaveBeenCalled();
  });

  it('posts completed booking refunds only after the persisted completion ledger and parent cancellation agree', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    const createdAt = new Date('2026-10-17T04:06:07.000Z');
    prisma.depositLedgerEntry.findFirst.mockResolvedValue({
      id: 'ledger-refund-1', tenantId: 'tenant-1', depositId: 'booking-1', operationId: 'completion-1',
      type: 'REFUND', amount: 400_000, balanceEffect: -400_000, sourceType: 'RECEIPT', sourceId: 'receipt-1', createdAt,
      operation: { id: 'completion-1', tenantId: 'tenant-1', sourceDepositId: 'booking-1', type: 'COMPLETE_REFUND', status: 'COMPLETED', receiptId: 'receipt-1' },
      deposit: { id: 'booking-1', tenantId: 'tenant-1', type: 'BOOKING', contract: { termsSnapshot: { bookingCommand: { depositId: 'booking-1', invoiceId: 'invoice-1' } } } },
    });
    prisma.receipt.findFirst.mockResolvedValue({ id: 'receipt-1', amount: 400_000, status: 'COMPLETED' });
    prisma.depositOperation.findFirst.mockResolvedValue({ id: 'cancel-1' });
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'deposit-liability', code: '1300' })
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1', sourceType: 'DEPOSIT', sourceId: 'booking-1', amount: 400_000,
      metadata: {
        bookingDispositionLedgerId: 'ledger-refund-1', bookingDispositionOperationId: 'completion-1', bookingDispositionJournalMode: 'LEDGER_V1',
      },
    });

    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      sourceType: 'DEPOSIT', sourceId: 'booking-1', entryDate: createdAt,
      lines: [
        expect.objectContaining({ accountId: 'deposit-liability', type: 'DEBIT', amount: 400_000 }),
        expect.objectContaining({ accountId: 'bank-account', type: 'CREDIT', amount: 400_000 }),
      ],
    }));
  });

  it('rejects an invalid booking disposition ledger without posting a journal', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.depositLedgerEntry.findFirst.mockResolvedValue({
      id: 'ledger-invalid-1', tenantId: 'tenant-1', depositId: 'booking-1', type: 'REFUND', amount: 400_000,
      balanceEffect: -400_000, sourceType: 'RECEIPT', sourceId: 'receipt-1', createdAt: new Date(),
      operation: { id: 'cancel-1', tenantId: 'tenant-1', sourceDepositId: 'booking-1', type: 'CANCEL', status: 'PENDING', receiptId: 'receipt-1' },
      deposit: { id: 'booking-1', tenantId: 'tenant-1', type: 'BOOKING', contract: { termsSnapshot: { bookingCommand: { depositId: 'booking-1', invoiceId: 'invoice-1' } } } },
    });

    await expect((engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1', sourceType: 'DEPOSIT', sourceId: 'booking-1', amount: 400_000,
      metadata: {
        bookingDispositionLedgerId: 'ledger-invalid-1', bookingDispositionOperationId: 'cancel-1', bookingDispositionJournalMode: 'LEDGER_V1',
      },
    })).rejects.toThrow('BOOKING_DISPOSITION_LEDGER_EVIDENCE_INVALID');
    expect(journalEntryService.createJournalEntry).not.toHaveBeenCalled();
  });

  it('suppresses legacy refund journaling only after verifying modern booking ownership', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.deposit.findFirst.mockResolvedValue({
      id: 'booking-1', contract: { termsSnapshot: { bookingCommand: { depositId: 'booking-1', invoiceId: 'invoice-1' } } },
    });
    prisma.depositOperation.findFirst.mockResolvedValue({ id: 'completion-1', type: 'COMPLETE_REFUND', status: 'COMPLETED' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1', sourceType: 'DEPOSIT', sourceId: 'booking-1', amount: 400_000,
      metadata: { bookingDispositionJournalMode: 'LEDGER_V1', operationId: 'completion-1' },
    });

    expect(journalEntryService.createJournalEntry).not.toHaveBeenCalled();
  });

  it('suppresses a pending modern booking deduction secondary event after receipt and allocations verify', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.deposit.findFirst.mockResolvedValue({
      id: 'booking-1', contract: { termsSnapshot: { bookingCommand: { depositId: 'booking-1', invoiceId: 'invoice-1' } } },
    });
    prisma.depositOperation.findFirst.mockResolvedValue({
      id: 'cancel-pending-1', type: 'CANCEL', status: 'PENDING', receiptId: 'receipt-pending-1',
      result: { refundAmount: 300_000, keepAmount: 100_000, deductAmount: 200_000, pending: true, refundStatus: 'PENDING' },
    });
    prisma.receipt.findFirst.mockResolvedValue({ id: 'receipt-pending-1', amount: 300_000, status: 'PENDING' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1', sourceType: 'DEPOSIT', sourceId: 'booking-1', amount: 200_000,
      metadata: { bookingDispositionJournalMode: 'LEDGER_V1', operationId: 'cancel-pending-1' },
    });

    expect(journalEntryService.createJournalEntry).not.toHaveBeenCalled();
  });

  it.each([
    ['KEEP', 100_000, 100_000, 200_000],
    ['DEDUCT', 200_000, 100_000, 200_000],
  ])('posts pending booking cancellation %s only with matching allocation and pending receipt', async (type, amount, keepAmount, deductAmount) => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.depositLedgerEntry.findFirst.mockResolvedValue({
      id: `ledger-${type.toLowerCase()}-pending`, tenantId: 'tenant-1', depositId: 'booking-1', operationId: 'cancel-pending-1',
      type, amount, balanceEffect: -amount, sourceType: 'DEPOSIT_CANCELLATION', sourceId: 'booking-1', createdAt: new Date('2026-10-17T04:07:08.000Z'),
      operation: {
        id: 'cancel-pending-1', tenantId: 'tenant-1', sourceDepositId: 'booking-1', type: 'CANCEL', status: 'PENDING', receiptId: 'receipt-pending-1',
        result: { refundAmount: 300_000, keepAmount, deductAmount, pending: true, refundStatus: 'PENDING' },
      },
      deposit: { id: 'booking-1', tenantId: 'tenant-1', type: 'BOOKING', contract: { termsSnapshot: { bookingCommand: { depositId: 'booking-1', invoiceId: 'invoice-1' } } } },
    });
    prisma.receipt.findFirst.mockResolvedValue({ id: 'receipt-pending-1', amount: 300_000, status: 'PENDING' });
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'deposit-liability', code: '1300' })
      .mockResolvedValueOnce({ id: 'forfeiture-revenue', code: '4300' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1', sourceType: 'DEPOSIT', sourceId: 'booking-1', amount,
      metadata: {
        bookingDispositionLedgerId: `ledger-${type.toLowerCase()}-pending`, bookingDispositionOperationId: 'cancel-pending-1', bookingDispositionJournalMode: 'LEDGER_V1',
      },
    });

    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      sourceType: 'DEPOSIT', sourceId: 'booking-1',
      lines: [
        expect.objectContaining({ accountId: 'deposit-liability', type: 'DEBIT', amount }),
        expect.objectContaining({ accountId: 'forfeiture-revenue', type: 'CREDIT', amount }),
      ],
    }));
  });

  it('fails closed for a flagged legacy event when modern booking ownership is not verified', async () => {
    const { engine, journalEntryService } = createEngine();

    await expect((engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1', sourceType: 'DEPOSIT', sourceId: 'booking-unknown', amount: 400_000,
      metadata: { bookingDispositionJournalMode: 'LEDGER_V1', operationId: 'operation-unknown' },
    })).rejects.toThrow('BOOKING_DISPOSITION_EVENT_EVIDENCE_INVALID');
    expect(journalEntryService.createJournalEntry).not.toHaveBeenCalled();
  });

  it('retains payment-id duplicate suppression for non-invoice events', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.journalEntry.findFirst.mockResolvedValue({ id: 'journal-deposit-existing' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1', sourceType: 'DEPOSIT', sourceId: 'deposit-1', amount: 100000,
      paymentId: 'payment-deposit-1', metadata: { code: 'DEP-001' },
    });

    expect(prisma.journalEntry.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', sourceType: 'DEPOSIT', sourceId: 'payment-deposit-1' },
      select: { id: true },
    });
    expect(journalEntryService.createJournalEntry).not.toHaveBeenCalled();
  });

  it('posts a booking-hold installment from its immutable payment evidence', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'deposit-liability', code: '1300' });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1',
      sourceType: 'DEPOSIT',
      sourceId: 'deposit-booking-1',
      amount: 400000,
      paymentId: 'payment-booking-400',
      paidAt: '2026-09-29T03:04:05.000Z',
      metadata: {
        code: 'DEP-BOOKING-001',
        bookingInvoiceInstallment: true,
        linkedInvoicePayment: true,
      },
    });

    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        code: 'JE-BH-ABFF269104C19CEABE2E',
        sourceType: 'PAYMENT',
        sourceId: 'payment-booking-400',
        entryDate: new Date('2026-09-29T03:04:05.000Z'),
        idempotent: true,
        lines: [
          expect.objectContaining({ accountId: 'bank-account', type: 'DEBIT', amount: 400000 }),
          expect.objectContaining({ accountId: 'deposit-liability', type: 'CREDIT', amount: 400000 }),
        ],
      }),
    );
    expect(prisma.journalEntry.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a booking-hold installment without persisted payment time', async () => {
    const { engine, prisma, journalEntryService } = createEngine();

    await expect((engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1',
      sourceType: 'DEPOSIT',
      amount: 400000,
      paymentId: 'payment-booking-400',
      metadata: { bookingInvoiceInstallment: true, linkedInvoicePayment: true },
    })).rejects.toThrow('BOOKING_HOLD_INSTALLMENT_JOURNAL_EVIDENCE_INVALID');

    expect(prisma.chartOfAccount.findFirst).not.toHaveBeenCalled();
    expect(journalEntryService.createJournalEntry).not.toHaveBeenCalled();
  });

  it('posts a normal invoice increment from persisted payment evidence', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'rental-revenue', code: '4000' });
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-invoice-500', tenantId: 'tenant-1', invoiceId: 'invoice-1',
      amount: 500000, status: 'CONFIRMED', paidAt: new Date('2026-10-17T03:04:05.000Z'),
    });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1',
      sourceType: 'INVOICE',
      sourceId: 'invoice-1',
      amount: 750000,
      paymentId: 'payment-invoice-500',
      paymentAmount: 500000,
      metadata: { code: 'INV-001', paymentJournalIdentity: 'PAYMENT_V1' },
    });

    expect(prisma.chartOfAccount.findFirst).toHaveBeenNthCalledWith(2, {
      where: { tenantId: 'tenant-1', code: '4000' },
    });
    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        code: expect.stringMatching(/^JE-IP-[A-F0-9]{20}$/),
        sourceType: 'INVOICE',
        sourceId: 'invoice-1',
        entryDate: new Date('2026-10-17T03:04:05.000Z'),
        idempotent: true,
        lines: [
          expect.objectContaining({ accountId: 'bank-account', type: 'DEBIT', amount: 500000 }),
          expect.objectContaining({ accountId: 'rental-revenue', type: 'CREDIT', amount: 500000 }),
        ],
      }),
    );
  });

  it('creates a deterministic journal for a legacy payment event only when no candidate exists', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'rental-revenue', code: '4000' });
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-legacy-1', tenantId: 'tenant-1', invoiceId: 'invoice-legacy-1',
      amount: 400000, status: 'CONFIRMED', paidAt: new Date('2026-10-17T03:04:05.000Z'),
    });

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
      tenantId: 'tenant-1', sourceType: 'INVOICE', sourceId: 'invoice-legacy-1', amount: 400000,
      paymentId: 'payment-legacy-1', paymentAmount: 400000, metadata: { code: 'INV-LEGACY-1' },
    });

    expect(prisma.journalEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', sourceType: 'INVOICE', sourceId: 'invoice-legacy-1' },
    }));
    expect(journalEntryService.createJournalEntry).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      sourceId: 'invoice-legacy-1', sourceType: 'INVOICE', idempotent: true,
    }));
  });

  it('replays exactly one proven legacy journal and rejects ambiguous or mismatched candidates', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.chartOfAccount.findFirst.mockResolvedValue({ id: 'bank-account', code: '1100' });
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-legacy-2', tenantId: 'tenant-1', invoiceId: 'invoice-legacy-2',
      amount: 400000, status: 'CONFIRMED', paidAt: new Date('2026-10-17T03:04:05.000Z'),
    });
    const payload = {
      tenantId: 'tenant-1', sourceType: 'INVOICE', sourceId: 'invoice-legacy-2', amount: 400000,
      paymentId: 'payment-legacy-2', paymentAmount: 400000, metadata: { code: 'INV-LEGACY-2' },
    };
    prisma.journalEntry.findMany.mockResolvedValue([{ id: 'legacy-exact-1', lines: [] }]);
    journalEntryService.isExactReplay.mockReturnValue(true);

    await expect((engine as any).executeStep('CREATE_JOURNAL_ENTRY', payload)).resolves.toBeUndefined();
    expect(journalEntryService.createJournalEntry).not.toHaveBeenCalled();

    prisma.journalEntry.findMany.mockResolvedValue([{ id: 'legacy-1', lines: [] }, { id: 'legacy-2', lines: [] }]);
    await expect((engine as any).executeStep('CREATE_JOURNAL_ENTRY', payload))
      .rejects.toThrow('LEGACY_PAYMENT_JOURNAL_REVIEW_REQUIRED');

    prisma.journalEntry.findMany.mockResolvedValue([{ id: 'legacy-mismatch', lines: [] }]);
    journalEntryService.isExactReplay.mockReturnValue(false);
    await expect((engine as any).executeStep('CREATE_JOURNAL_ENTRY', payload))
      .rejects.toThrow('LEGACY_PAYMENT_JOURNAL_REVIEW_REQUIRED');
  });

  it('keeps one invoice source while creating distinct deterministic journals for two payments', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'rental-revenue', code: '4000' })
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'rental-revenue', code: '4000' });
    prisma.payment.findFirst
      .mockResolvedValueOnce({ id: 'payment-1', tenantId: 'tenant-1', invoiceId: 'invoice-shared-1', amount: 400000, status: 'CONFIRMED', paidAt: new Date('2026-10-17T03:04:05.000Z') })
      .mockResolvedValueOnce({ id: 'payment-2', tenantId: 'tenant-1', invoiceId: 'invoice-shared-1', amount: 600000, status: 'CONFIRMED', paidAt: new Date('2026-10-17T03:05:05.000Z') });

    for (const [paymentId, paymentAmount] of [['payment-1', 400000], ['payment-2', 600000]] as const) {
      await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', {
        tenantId: 'tenant-1', sourceType: 'INVOICE', sourceId: 'invoice-shared-1', amount: paymentAmount,
        paymentId, paymentAmount, metadata: { code: 'INV-SHARED-1', paymentJournalIdentity: 'PAYMENT_V1' },
      });
    }

    expect(journalEntryService.createJournalEntry).toHaveBeenCalledTimes(2);
    expect(journalEntryService.createJournalEntry.mock.calls.map(([, entry]: any[]) => entry.sourceId)).toEqual(['invoice-shared-1', 'invoice-shared-1']);
    expect(journalEntryService.createJournalEntry.mock.calls[0][1].code)
      .not.toBe(journalEntryService.createJournalEntry.mock.calls[1][1].code);
  });

  it('reuses the deterministic invoice-payment identity after a post-journal retry', async () => {
    const { engine, prisma, journalEntryService } = createEngine();
    prisma.chartOfAccount.findFirst
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'rental-revenue', code: '4000' })
      .mockResolvedValueOnce({ id: 'bank-account', code: '1100' })
      .mockResolvedValueOnce({ id: 'rental-revenue', code: '4000' });
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-retry-1', tenantId: 'tenant-1', invoiceId: 'invoice-retry-1',
      amount: 500000, status: 'CONFIRMED', paidAt: new Date('2026-10-17T03:04:05.000Z'),
    });
    const payload = {
      tenantId: 'tenant-1', sourceType: 'INVOICE', sourceId: 'invoice-retry-1', amount: 500000,
      paymentId: 'payment-retry-1', paymentAmount: 500000,
      metadata: { code: 'INV-RETRY-1', paymentJournalIdentity: 'PAYMENT_V1' },
    };

    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', payload);
    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', payload);

    expect(journalEntryService.createJournalEntry).toHaveBeenCalledTimes(2);
    expect(journalEntryService.createJournalEntry.mock.calls[0][1].code)
      .toBe(journalEntryService.createJournalEntry.mock.calls[1][1].code);
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
