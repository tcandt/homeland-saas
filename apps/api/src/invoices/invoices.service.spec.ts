import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InvoicesService } from './invoices.service';
import { InvoiceStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let repository: any;
  let auditService: any;
  let eventPublisher: any;
  let prisma: any;

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      paginate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };
    auditService = { log: vi.fn() };
    eventPublisher = { publish: vi.fn() };
    prisma = {
      tx: {
        invoice: {
          findUniqueOrThrow: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
        },
        $transaction: vi.fn((cb) => cb(prisma.tx)),
        payment: { create: vi.fn() },
        paymentAllocation: { create: vi.fn() },
      }
    };

    service = new InvoicesService(repository, auditService, eventPublisher, prisma);
  });

  describe('issue', () => {
    it('should change status to ISSUED', async () => {
      prisma.tx.invoice.findUniqueOrThrow.mockResolvedValue({
        id: 'inv-1',
        status: InvoiceStatus.DRAFT,
        items: [{ amount: 100 }],
        discount: 10,
        total: 0,
      });

      prisma.tx.invoice.update.mockResolvedValue({ id: 'inv-1', status: InvoiceStatus.ISSUED, total: 90 });

      const result = await service.issue('inv-1', 'user-1');
      expect(result.status).toBe(InvoiceStatus.ISSUED);
      expect(prisma.tx.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: InvoiceStatus.ISSUED, subtotal: 100, total: 90 },
      });
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should throw if total <= 0', async () => {
      prisma.tx.invoice.findUniqueOrThrow.mockResolvedValue({
        id: 'inv-1',
        status: InvoiceStatus.DRAFT,
        items: [{ amount: 100 }],
        discount: 100,
      });

      await expect(service.issue('inv-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw if not DRAFT', async () => {
      prisma.tx.invoice.findUniqueOrThrow.mockResolvedValue({
        id: 'inv-1',
        status: InvoiceStatus.ISSUED,
      });

      await expect(service.issue('inv-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('pay', () => {
    it('should transition to PARTIALLY_PAID if payment is less than total', async () => {
      prisma.tx.invoice.findUniqueOrThrow.mockResolvedValue({
        id: 'inv-1',
        status: InvoiceStatus.ISSUED,
        total: 100,
        paidAmount: 0,
        tenantId: 'tenant-1',
      });
      prisma.tx.payment.create.mockResolvedValue({ id: 'pay-1' });
      prisma.tx.paymentAllocation.create.mockResolvedValue({ id: 'alloc-1' });
      prisma.tx.invoice.update.mockResolvedValue({ status: InvoiceStatus.PARTIALLY_PAID, paidAmount: 40 });

      const result = await service.pay('inv-1', 40, 'MANUAL', '', 'user-1');
      
      expect(prisma.tx.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { paidAmount: 40, status: InvoiceStatus.PARTIALLY_PAID }
      });
      expect(result.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    });

    it('should transition to PAID if payment covers remainder', async () => {
      prisma.tx.invoice.findUniqueOrThrow.mockResolvedValue({
        id: 'inv-1',
        status: InvoiceStatus.PARTIALLY_PAID,
        total: 100,
        paidAmount: 40,
        tenantId: 'tenant-1',
      });
      prisma.tx.payment.create.mockResolvedValue({ id: 'pay-2' });
      prisma.tx.paymentAllocation.create.mockResolvedValue({ id: 'alloc-2' });
      prisma.tx.invoice.update.mockResolvedValue({ status: InvoiceStatus.PAID, paidAmount: 100 });

      const result = await service.pay('inv-1', 60, 'MANUAL', '', 'user-1');
      
      expect(prisma.tx.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { paidAmount: 100, status: InvoiceStatus.PAID }
      });
      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(eventPublisher.publish).toHaveBeenCalledWith('invoice.paid', expect.any(Object));
    });

    it('should throw if paying more than remaining', async () => {
      prisma.tx.invoice.findUniqueOrThrow.mockResolvedValue({
        id: 'inv-1',
        status: InvoiceStatus.PARTIALLY_PAID,
        total: 100,
        paidAmount: 80,
      });

      await expect(service.pay('inv-1', 50, 'MANUAL', '', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('markOverdueInvoices', () => {
    it('marks issued and partially paid invoices as overdue when due date has passed', async () => {
      prisma.tx.invoice.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markOverdueInvoices('tenant-1');

      expect(prisma.tx.invoice.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          deletedAt: null,
          status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
          dueDate: { lt: expect.any(Date) },
        },
        data: { status: InvoiceStatus.OVERDUE },
      });
      expect(result).toMatchObject({ updated: 3, checkedAt: expect.any(Date) });
    });
  });
});
