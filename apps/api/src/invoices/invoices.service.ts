import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Invoice } from '@prisma/client';
import { InvoicesRepository } from './invoices.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PaginatedResult } from '@homeland/shared';
import { DomainEventPublisher } from '../shared/events/domain-event.publisher';

@Injectable()
export class InvoicesService extends BaseCrudService<Invoice> {
  constructor(
    repository: InvoicesRepository,
    auditService: AuditService,
    private readonly eventPublisher: DomainEventPublisher,
  ) {
    super(repository, auditService, 'Invoice');
  }

  async update(id: string, data: any, userId?: string, moduleName?: string) {
    const oldInvoice = await this.repository.findById(id);
    const updatedInvoice = await super.update(id, data, userId, moduleName);

    if (oldInvoice?.status !== 'PAID' && updatedInvoice.status === 'PAID') {
      this.eventPublisher.publish('invoice.paid', {
        tenantId: updatedInvoice.tenantId,
        userId: userId || 'system',
        metadata: { code: updatedInvoice.code },
        sourceId: updatedInvoice.id,
        sourceType: 'INVOICE',
        amount: Number(updatedInvoice.total),
        occurredAt: new Date(),
      });
    }

    return updatedInvoice;
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
    const where: any = {};
    if (search) {
      where.OR = [
        { customer: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (contractId) where.contractId = contractId;
    
    if (overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ['PAID', 'CANCELLED'] };
    }

    const orderBy = { [sort || 'createdAt']: order || 'desc' };

    return this.repository.paginate(where, page, limit, orderBy, {
      customer: { select: { id: true, fullName: true, phone: true } },
      contract: { select: { id: true, code: true, room: { select: { id: true, code: true, building: { select: { id: true, name: true } } } } } }
    });
  }
}
