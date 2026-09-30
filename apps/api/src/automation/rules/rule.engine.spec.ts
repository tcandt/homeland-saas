import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RuleEngine } from './rule.engine';
import { PrismaService } from '../../prisma.service';
import { CommunicationService } from '../../communication/communication.service';
import { WorkflowStatus } from '../automation.constants';

describe('RuleEngine', () => {
  let engine: RuleEngine;
  let prisma: any;
  let communicationService: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T00:00:00.000Z'));

    prisma = {
      ruleExecution: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'rule-exec-1' }),
        update: vi.fn().mockResolvedValue({ id: 'rule-exec-1', status: WorkflowStatus.SUCCESS }),
      },
      task: {
        create: vi.fn().mockResolvedValue({ id: 'task-1' }),
      },
    };

    communicationService = {
      dispatch: vi.fn().mockResolvedValue(undefined),
      dispatchDirect: vi.fn().mockResolvedValue(undefined),
    };

    engine = new RuleEngine(prisma as PrismaService, communicationService as CommunicationService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips duplicate executions when correlationId already succeeded', async () => {
    prisma.ruleExecution.findFirst.mockResolvedValueOnce({
      id: 'rule-exec-existing',
      status: WorkflowStatus.SUCCESS,
      completedAt: new Date(),
    });

    const result = await engine.executeRule('invoice.overdue.7_days', {
      tenantId: 'tenant-1',
      correlationId: 'invoice.overdue.7_days:inv-1:2026-08-11',
      dueDate: new Date('2026-08-01T00:00:00.000Z'),
      status: 'OVERDUE',
      customerId: 'customer-1',
    });

    expect(result).toEqual({
      skipped: true,
      reason: 'DUPLICATE_CORRELATION',
      executionId: 'rule-exec-existing',
      status: WorkflowStatus.SUCCESS,
    });
    expect(prisma.ruleExecution.create).not.toHaveBeenCalled();
    expect(communicationService.dispatch).not.toHaveBeenCalled();
  });

  it('dispatches overdue notification when invoice is overdue by more than 7 days', async () => {
    await engine.executeRule('invoice.overdue.7_days', {
      tenantId: 'tenant-1',
      correlationId: 'invoice.overdue.7.days:inv-2:2026-08-11',
      dueDate: new Date('2026-08-01T00:00:00.000Z'),
      status: 'OVERDUE',
      customerId: 'customer-1',
      invoiceCode: 'INV-001',
    });

    expect(prisma.ruleExecution.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        ruleName: 'invoice.overdue.7_days',
        correlationId: 'invoice.overdue.7.days:inv-2:2026-08-11',
        status: WorkflowStatus.RUNNING,
      }),
    }));
    expect(communicationService.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'customer-1',
      templateCode: 'INVOICE_OVERDUE',
    }));
    expect(prisma.ruleExecution.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'rule-exec-1' },
      data: expect.objectContaining({
        status: WorkflowStatus.SUCCESS,
      }),
    }));
  });

  it('dispatches due soon notification when invoice will be due within 3 days', async () => {
    await engine.executeRule('invoice.due_soon.3_days', {
      tenantId: 'tenant-1',
      correlationId: 'invoice.due_soon.3_days:inv-3:2026-08-11',
      dueDate: new Date('2026-08-13T00:00:00.000Z'),
      status: 'ISSUED',
      customerId: 'customer-1',
      invoiceCode: 'INV-002',
      remainingAmount: 2500000,
    });

    expect(communicationService.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'customer-1',
      templateCode: 'CLIENT_INVOICE_DUE_SOON',
      context: expect.objectContaining({
        headline: '⏰ NHẮC THANH TOÁN',
        remainingAmountDisplay: '2.500.000đ',
      }),
    }));
  });

  it('uses a separate admin template when a payment promise reaches its due date', async () => {
    prisma.appSetting = { findUnique: vi.fn().mockResolvedValue({ value: { adminGroupChatId: 'admin-group-1' } }) };

    await engine.executeRule('invoice.payment_promise_due', {
      tenantId: 'tenant-1',
      correlationId: 'invoice.payment_promise_due:promise-2',
      paymentPromiseId: 'promise-2',
      promiseDueDate: new Date('2026-08-11T00:00:00.000Z'),
      promiseStatus: 'OVERDUE',
      status: 'PARTIALLY_PAID',
      customerId: 'customer-1',
      customerName: 'Khách A',
      invoiceCode: 'INV-004',
      roomCode: '31-06',
      remainingAmount: 3_000_000,
    });

    expect(communicationService.dispatchDirect).toHaveBeenCalledWith(expect.objectContaining({
      templateCode: 'ADMIN_PAYMENT_PROMISE_DUE',
      context: expect.objectContaining({ headline: '🔴 ĐẾN HẸN THANH TOÁN' }),
    }));
  });

  it('dispatches expiring contract notification when contract ends within 30 days', async () => {
    await engine.executeRule('contract.expiring.30_days', {
      tenantId: 'tenant-1',
      correlationId: 'contract.expiring.30_days:contract-1:2026-08-11',
      endDate: new Date('2026-08-31T00:00:00.000Z'),
      status: 'ACTIVE',
      customerId: 'customer-1',
      contractCode: 'CTR-001',
      roomCode: '31-04',
    });

    expect(communicationService.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'customer-1',
      templateCode: 'CLIENT_CONTRACT_EXPIRING',
      context: expect.objectContaining({
        headline: '⏳ HỢP ĐỒNG SẮP HẾT HẠN',
        roomAndBuilding: '31-04',
      }),
    }));
  });

  it('sends a payment-promise reminder using the remaining balance and creates one ops task', async () => {
    await engine.executeRule('invoice.payment_promise_due', {
      tenantId: 'tenant-1',
      correlationId: 'invoice.payment_promise_due:promise-1',
      paymentPromiseId: 'promise-1',
      promiseDueDate: new Date('2026-08-11T00:00:00.000Z'),
      promiseStatus: 'OVERDUE',
      status: 'PARTIALLY_PAID',
      customerId: 'customer-1',
      invoiceCode: 'INV-003',
      roomCode: '31-05',
      remainingAmount: 3000000,
    });

    expect(communicationService.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'customer-1',
      templateCode: 'CLIENT_PAYMENT_PROMISE_DUE',
      context: expect.objectContaining({
        headline: '⏰ ĐẾN HẸN THANH TOÁN',
        remainingAmountDisplay: '3.000.000đ',
      }),
    }));
    expect(prisma.task.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'tenant-1', priority: 'HIGH' }),
    }));
  });
});
