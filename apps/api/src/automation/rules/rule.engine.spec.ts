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
    };

    communicationService = {
      dispatch: vi.fn().mockResolvedValue(undefined),
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
      templateCode: 'SYSTEM_ALERT',
      context: expect.objectContaining({
        title: expect.stringContaining('INV-002'),
      }),
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
      templateCode: 'SYSTEM_ALERT',
      context: expect.objectContaining({
        title: expect.stringContaining('CTR-001'),
        message: expect.stringContaining('31-04'),
      }),
    }));
  });
});
