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
      appSetting: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      invoice: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      contract: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      paymentPromise: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
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
        contract: {
          id: 'contract-1',
          memberCount: 4,
          room: {
            id: 'room-1',
            code: '31-01',
            rentalType: 'SHARED',
            building: { id: 'building-1', name: 'LK01-31' },
          },
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
        roomRentalTypeLabel: 'Phòng ghép',
        roomMemberCount: 4,
      }),
    );
  });

  it('uses tenant notification settings for invoice reminder days', async () => {
    const now = new Date();
    const dueInTenDays = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10, 8, 0, 0, 0);
    prisma.appSetting.findMany.mockResolvedValueOnce([
      { tenantId: 'tenant-1', value: { reminderDays: { invoiceDueSoonDays: 5 } } },
      { tenantId: 'tenant-2', value: { reminderDays: { invoiceDueSoonDays: 14 } } },
    ]);
    prisma.invoice.findMany.mockResolvedValueOnce([
      {
        id: 'invoice-skip',
        tenantId: 'tenant-1',
        code: 'INV-SKIP',
        dueDate: dueInTenDays,
        status: InvoiceStatus.ISSUED,
        customerId: 'customer-1',
        total: 100,
        paidAmount: 0,
        creditAmount: 0,
        customer: {},
        contract: null,
      },
      {
        id: 'invoice-send',
        tenantId: 'tenant-2',
        code: 'INV-SEND',
        dueDate: dueInTenDays,
        status: InvoiceStatus.ISSUED,
        customerId: 'customer-2',
        total: 100,
        paidAmount: 0,
        creditAmount: 0,
        customer: {},
        contract: null,
      },
    ]);

    await scheduler.runInvoiceDueSoon3DaysRule();

    expect(ruleEngine.executeRule).toHaveBeenCalledTimes(1);
    expect(ruleEngine.executeRule).toHaveBeenCalledWith(
      'invoice.due_soon.3_days',
      expect.objectContaining({ invoiceId: 'invoice-send' }),
    );
  });

  it('merges notification and contract rule settings for the same tenant', async () => {
    const now = new Date();
    const dueInFourDays = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4, 8, 0, 0, 0);
    prisma.appSetting.findMany.mockResolvedValueOnce([
      { tenantId: 'tenant-1', key: 'notifications', value: { reminderDays: { invoiceDueSoonDays: 5 } } },
      { tenantId: 'tenant-1', key: 'contract-rules', value: { renewalReminderDays: 14 } },
    ]);
    prisma.invoice.findMany.mockResolvedValueOnce([
      {
        id: 'invoice-merged',
        tenantId: 'tenant-1',
        code: 'INV-MERGED',
        dueDate: dueInFourDays,
        status: InvoiceStatus.ISSUED,
        customerId: 'customer-1',
        total: 100,
        paidAmount: 0,
        creditAmount: 0,
        customer: {},
        contract: null,
      },
    ]);

    await scheduler.runInvoiceDueSoon3DaysRule();

    // The configured invoice threshold remains 5 days; the contract-rules
    // record must not reset it back to the default while adding renewal days.
    expect(ruleEngine.executeRule).toHaveBeenCalledWith(
      'invoice.due_soon.3_days',
      expect.objectContaining({ invoiceId: 'invoice-merged', thresholdDays: 5 }),
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
        contract: {
          id: 'contract-2',
          memberCount: 1,
          room: {
            id: 'room-2',
            code: '32-02',
            rentalType: 'WHOLE',
            building: { id: 'building-1', name: 'LK01-31' },
          },
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
        roomRentalTypeLabel: 'Nguyên căn',
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
          rentalType: 'SHARED',
          building: {
            id: 'building-1',
            name: 'LK01-31',
          },
        },
        memberCount: 2,
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
        roomRentalTypeLabel: 'Phòng ghép',
        roomMemberCount: 2,
      }),
    );
  });

  it('marks a due partial-payment promise overdue and emits one canonical reminder', async () => {
    prisma.paymentPromise.findMany.mockResolvedValueOnce([
      {
        id: 'promise-1',
        tenantId: 'tenant-1',
        dueDate: new Date('2026-08-10T08:00:00.000Z'),
        invoice: {
          id: 'invoice-1',
          code: 'INV-001',
          dueDate: new Date('2026-08-01T08:00:00.000Z'),
          status: InvoiceStatus.PARTIALLY_PAID,
          customerId: 'customer-1',
          total: 5000000,
          paidAmount: 2000000,
          creditAmount: 0,
          customer: { fullName: 'Khach A', phone: '0900000001' },
          contract: { room: { id: 'room-1', code: '31-01', rentalType: 'SHARED', building: { id: 'building-1', name: 'LK01-31' } } },
        },
      },
    ]);

    const result = await scheduler.runPaymentPromiseDueRule();

    expect(result).toMatchObject({ checked: 1, due: 1 });
    expect(prisma.paymentPromise.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'promise-1', status: 'PENDING' }),
      data: { status: 'OVERDUE' },
    }));
    expect(ruleEngine.executeRule).toHaveBeenCalledWith('invoice.payment_promise_due', expect.objectContaining({
      paymentPromiseId: 'promise-1',
      invoiceId: 'invoice-1',
      remainingAmount: 3000000,
    }));
  });

  it('uses the full Asia/Ho_Chi_Minh promise due date when the worker host is on UTC', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T18:30:00.000Z'));

    try {
      await scheduler.runPaymentPromiseDueRule();

      expect(prisma.paymentPromise.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          dueDate: { lt: new Date('2026-08-11T17:00:00.000Z') },
        }),
      }));
    } finally {
      vi.useRealTimers();
    }
  });
});
