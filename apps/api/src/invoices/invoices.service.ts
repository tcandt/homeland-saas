import { Injectable, BadRequestException } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Invoice, InvoiceStatus, Prisma } from '@prisma/client';
import { InvoicesRepository } from './invoices.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PaginatedResult } from '@homeland/shared';
import { DomainEventPublisher } from '../shared/events/domain-event.publisher';
import { PrismaService } from '../prisma.service';
import { buildRoomContext } from '../shared/context/room-context';

@Injectable()
export class InvoicesService extends BaseCrudService<Invoice> {
  constructor(
    repository: InvoicesRepository,
    auditService: AuditService,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly prisma: PrismaService,
  ) {
    super(repository, auditService, 'Invoice');
  }

  async listInvoices(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    roomId?: string,
    customerId?: string,
    contractId?: string,
    period?: string,
    overdue?: boolean,
    sort?: string,
    order?: string
  ): Promise<PaginatedResult<Invoice>> {
    const where: any = {
      AND: [
        {
          OR: [
            { total: { gt: 0 } },
            { status: InvoiceStatus.DRAFT },
          ],
        },
      ],
    };
    if (search) {
      where.AND.push({
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { customer: { fullName: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (contractId) where.contractId = contractId;
    if (period) where.period = period;
    
    if (overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED, InvoiceStatus.WRITTEN_OFF] };
    }

    const orderBy = { [sort || 'createdAt']: order || 'desc' };

    return this.repository.paginate(where, page, limit, orderBy, {
      customer: { select: { id: true, fullName: true, phone: true, gender: true } },
      contract: { select: { id: true, code: true, room: { select: { id: true, code: true, building: { select: { id: true, name: true } } } } } }
    });
  }

  async getDetail(id: string, include?: any) {
    return this.prisma.tx.invoice.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        contract: { include: { room: { include: { building: true, floor: true } } } },
        items: true,
        allocations: {
          include: { payment: true }
        }
      }
    });
  }

  async create(data: Prisma.InvoiceCreateInput, userId?: string, moduleName?: string) {
    // Override to ensure it is always DRAFT initially
    data.status = InvoiceStatus.DRAFT;
    return super.create(data, userId, moduleName);
  }

  async update(id: string, data: any, userId?: string, moduleName?: string) {
    const invoice = await this.getDetail(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Can only update DRAFT invoices. Use explicit commands (issue, pay, cancel, writeoff) for state transitions.');
    }
    return super.update(id, data, userId, moduleName);
  }

  async issue(id: string, userId: string) {
    const invoice = await this.getDetail(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(`Cannot issue invoice in ${invoice.status} status.`);
    }

    // Recalculate total safely
    const subtotalFromItems = invoice.items && invoice.items.length > 0
      ? invoice.items.reduce((sum, item) => sum + Number(item.amount), 0)
      : Number(invoice.subtotal) || Number(invoice.total) || 0;

    const discount = Number(invoice.discount) || 0;
    const total = subtotalFromItems > 0 ? subtotalFromItems - discount : Number(invoice.total) || 0;

    if (total <= 0) {
      throw new BadRequestException('Invoice total must be strictly positive to be issued.');
    }

    const updated = await this.prisma.tx.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.ISSUED,
        subtotal: subtotalFromItems > 0 ? subtotalFromItems : total,
        total: total,
      }
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: 'Invoice',
      entityId: id,
      module: 'Invoices',
      before: invoice,
      after: updated,
      userId,
    });

    this.eventPublisher.publish('invoice.issued', {
      tenantId: invoice.tenantId,
      userId,
      customerId: invoice.customerId,
      customerName: invoice.customer?.fullName,
      customerPhone: invoice.customer?.phone,
      customerZaloChatId: invoice.customer?.zaloChatId,
      customerZaloUserId: invoice.customer?.zaloUserId,
      ...buildRoomContext(invoice.contract?.room, invoice.contract),
      metadata: {
        code: invoice.code,
        roomCode: invoice.contract?.room?.code,
        buildingName: invoice.contract?.room?.building?.name,
        roomRentalType: invoice.contract?.room?.rentalType || null,
        roomRentalTypeLabel: buildRoomContext(invoice.contract?.room, invoice.contract).roomRentalTypeLabel,
        roomMemberCount: buildRoomContext(invoice.contract?.room, invoice.contract).roomMemberCount,
        title: `Phát hành hóa đơn ${invoice.code}`,
        message: `Hóa đơn ${invoice.code} đã được phát hành với số tiền ${total.toLocaleString('vi-VN')} VND.`,
      },
      sourceId: invoice.id,
      sourceType: 'INVOICE',
      amount: Number(total),
      occurredAt: new Date(),
    });

    return updated;
  }

  async markOverdueInvoices(tenantId: string) {
    const now = new Date();
    const result = await this.prisma.tx.invoice.updateMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
        total: { gt: 0 },
        dueDate: { lt: now },
      },
      data: {
        status: InvoiceStatus.OVERDUE,
      },
    });

    return {
      updated: result.count,
      checkedAt: now,
    };
  }

  async pay(id: string, amount: number, provider: string, providerRef: string, userId: string) {
    const invoice = await this.getDetail(id);

    if (!([InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] as string[]).includes(invoice.status)) {
      throw new BadRequestException(`Cannot receive payment for invoice in ${invoice.status} status.`);
    }

    const creditAmount = Math.max(0, Number(invoice.creditAmount || 0));
    const remaining = Math.max(0, Number(invoice.total) - Number(invoice.paidAmount) - creditAmount);
    if (amount <= 0 || amount > remaining) {
      throw new BadRequestException(`Payment amount must be strictly positive and cannot exceed the remaining balance of ${remaining}.`);
    }

    const newPaidAmount = Number(invoice.paidAmount) + amount;
    const newStatus = newPaidAmount + creditAmount >= Number(invoice.total) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

    const result = await this.prisma.tx.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId: invoice.tenantId,
          invoiceId: invoice.id,
          amount,
          provider,
          providerRef,
          status: 'CONFIRMED',
          paidAt: new Date(),
        }
      });

      const allocation = await tx.paymentAllocation.create({
        data: {
          tenantId: invoice.tenantId,
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount,
        }
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        }
      });

      return updatedInvoice;
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: 'Invoice',
      entityId: id,
      module: 'Invoices',
      before: invoice,
      after: result,
      userId,
    });

    if (newStatus === InvoiceStatus.PAID) {
      if (invoice.contractId) {
        await this.prisma.tx.deposit.updateMany({
          where: {
            tenantId: invoice.tenantId,
            contractId: invoice.contractId,
            status: 'PENDING' as any,
          },
          data: {
            status: 'PAID' as any,
          },
        }).catch(() => null);
      }
      this.eventPublisher.publish('invoice.paid', {
        tenantId: invoice.tenantId,
        userId,
        customerId: invoice.customerId,
        customerName: invoice.customer?.fullName,
        customerPhone: invoice.customer?.phone,
        customerZaloChatId: invoice.customer?.zaloChatId,
        customerZaloUserId: invoice.customer?.zaloUserId,
        ...buildRoomContext(invoice.contract?.room, invoice.contract),
        metadata: {
          code: invoice.code,
          grossTotal: Number(result.total),
          creditAmount,
          roomRentalType: invoice.contract?.room?.rentalType || null,
          roomRentalTypeLabel: buildRoomContext(invoice.contract?.room, invoice.contract).roomRentalTypeLabel,
          roomMemberCount: buildRoomContext(invoice.contract?.room, invoice.contract).roomMemberCount,
        },
        sourceId: invoice.id,
        sourceType: 'INVOICE',
        amount: Number(result.paidAmount ?? newPaidAmount),
        paymentProvider: provider,
        paymentRef: providerRef,
        occurredAt: new Date(),
      });
    }

    return result;
  }

  async cancel(id: string, userId: string) {
    const invoice = await this.getDetail(id);

    if (!([InvoiceStatus.DRAFT, InvoiceStatus.ISSUED] as string[]).includes(invoice.status)) {
      throw new BadRequestException(`Cannot cancel invoice in ${invoice.status} status.`);
    }

    const updated = await this.prisma.tx.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED }
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: 'Invoice',
      entityId: id,
      module: 'Invoices',
      before: invoice,
      after: updated,
      userId,
    });

    return updated;
  }

  async writeoff(id: string, userId: string) {
    const invoice = await this.getDetail(id);

    if (!([InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] as string[]).includes(invoice.status)) {
      throw new BadRequestException(`Cannot write off invoice in ${invoice.status} status.`);
    }

    const updated = await this.prisma.tx.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.WRITTEN_OFF }
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: 'Invoice',
      entityId: id,
      module: 'Invoices',
      before: invoice,
      after: updated,
      userId,
    });

    return updated;
  }
}
