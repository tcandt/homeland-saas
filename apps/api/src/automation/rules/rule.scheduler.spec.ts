import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractStatus, InvoiceStatus } from '@prisma/client';
import { RuleScheduler } from './rule.scheduler';
import { PrismaService } from '../../prisma.service';
import { RuleEngine } from './rule.engine';

describe('RuleScheduler', () => {
  let scheduler: RuleScheduler;
  let prisma: any;
  let ruleEngine: any;

  beforeEach(() => {
    prisma = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      contract: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    ruleEngine = {
      executeRule: vi.fn().mockResolvedValue(undefined),
    };

    scheduler = new RuleScheduler(prisma as PrismaService, ruleEngine as RuleEngine);
  });

  it('schedules due soon reminders for issued invoices within the next 3 days', async () => {
    prisma.invoice.findMany.mockResolvedValueOnce([
      {
        id: 'invoice-1',
        tenantId: 'tenant-1',
        code: 'INV-001',
        dueDate: new Date('2026-08-13T08:00:00.000Z'),
        status: InvoiceStatus.ISSUED,
        customerId: 'customer-1',
        total: 3000000,
        paidAmount: 500000,
        creditAmount: 0,
        customer: {
          id: 'customer-1',
          fullName: 'Khach A',
          phone: '0900000001',
        },
      },
    ]);

    const result = await scheduler.runInvoiceDueSoon3DaysRule();

    expect(result.checked).toBe(1);
    expect(prisma.invoice.findMany).toHaveBeenCalled();
    expect(ruleEngine.executeRule).toHaveBeenCalledWith(
      'invoice.due_soon.3_days',
      expect.objectContaining({
        invoiceId: 'invoice-1',
        invoiceCode: 'INV-001',
        status: InvoiceStatus.ISSUED,
        remainingAmount: 2500000,
      }),
    );
  });

  it('schedules overdue reminders for invoices older than 7 days', async () => {
    prisma.invoice.findMany.mockResolvedValueOnce([
      {
        id: 'invoice-2',
        tenantId: 'tenant-1',
        code: 'INV-002',
        dueDate: new Date('2026-08-01T08:00:00.000Z'),
        status: InvoiceStatus.OVERDUE,
        customerId: 'customer-2',
        total: 1500000,
        paidAmount: 0,
        creditAmount: 0,
        customer: {
          id: 'customer-2',
          fullName: 'Khach B',
          phone: '0900000002',
        },
      },
    ]);

    const result = await scheduler.runInvoiceOverdue7DaysRule();

    expect(result.checked).toBe(1);
    expect(ruleEngine.executeRule).toHaveBeenCalledWith(
      'invoice.overdue.7_days',
      expect.objectContaining({
        invoiceId: 'invoice-2',
        invoiceCode: 'INV-002',
        remainingAmount: 1500000,
      }),
    );
  });

  it('schedules contract expiring reminders for active contracts within 30 days', async () => {
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        id: 'contract-1',
        tenantId: 'tenant-1',
        code: 'CTR-001',
        endDate: new Date('2026-08-31T08:00:00.000Z'),
        status: ContractStatus.ACTIVE,
        roomId: 'room-1',
        customerId: 'customer-1',
        customer: {
          id: 'customer-1',
          fullName: 'Khach A',
          phone: '0900000001',
        },
        room: {
          id: 'room-1',
          code: '31-04',
          building: {
            id: 'building-1',
            name: 'LK01-31',
          },
        },
      },
    ]);

    const result = await scheduler.runContractExpiring30DaysRule();

    expect(result.checked).toBe(1);
    expect(prisma.contract.findMany).toHaveBeenCalled();
    expect(ruleEngine.executeRule).toHaveBeenCalledWith(
      'contract.expiring.30_days',
      expect.objectContaining({
        contractId: 'contract-1',
        contractCode: 'CTR-001',
        roomCode: '31-04',
        buildingName: 'LK01-31',
      }),
    );
  });
});
