import { Injectable, BadRequestException } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Deposit, DepositStatus } from '@prisma/client';
import { DepositsRepository } from './deposits.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PaginatedResult } from '@homeland/shared';
import { DomainEventPublisher } from '../shared/events/domain-event.publisher';

@Injectable()
export class DepositsService extends BaseCrudService<Deposit> {
  constructor(
    repository: DepositsRepository,
    auditService: AuditService,
    private readonly eventPublisher: DomainEventPublisher,
  ) {
    super(repository, auditService, 'Deposit');
  }

  async listDeposits(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    type?: string,
    sort?: string,
    order?: string
  ): Promise<PaginatedResult<Deposit>> {
    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { customer: { fullName: { contains: search, mode: 'insensitive' } } },
        { room: { code: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status) where.status = status;
    if (type) where.type = type;

    const orderBy = { [sort || 'createdAt']: order || 'desc' };

    return this.repository.paginate(where, page, limit, orderBy, {
      customer: { select: { id: true, fullName: true, phone: true } },
      room: { 
        select: { id: true, code: true, name: true, building: { select: { id: true, name: true } } } 
      }
    });
  }

  async getDetail(id: string, include?: any): Promise<any> {
    return this.repository.findById(id, {
      customer: true,
      room: { include: { building: true, floor: true } },
      contract: true,
      ...include,
    });
  }

  async collect(id: string, note: string | null, userId: string) {
    const deposit = await this.getDetail(id);
    if (!deposit) throw new BadRequestException('Deposit not found');
    if (deposit.status !== DepositStatus.DRAFT && deposit.status !== DepositStatus.PENDING) {
      throw new BadRequestException('Can only collect DRAFT or PENDING deposits');
    }

    const updateData = { status: DepositStatus.PAID, note: note || deposit.note };
    const updated = await this.repository.update(id, updateData);
    
    await this.auditService.log({
      tenantId: deposit.tenantId,
      userId,
      module: 'Deposits',
      entity: 'Deposit',
      entityId: id,
      action: 'COLLECT',
      before: deposit,
      after: updated,
    });

    // Emit Domain Event
    this.eventPublisher.publish('deposit.collected', {
      tenantId: deposit.tenantId,
      userId,
      customerId: deposit.customerId,
      customerName: deposit.customer?.fullName,
      customerPhone: deposit.customer?.phone,
      metadata: { code: deposit.code },
      sourceId: deposit.id,
      sourceType: 'DEPOSIT',
      amount: Number(deposit.amount),
      paymentProvider: 'MANUAL',
      occurredAt: new Date(),
    });

    return updated;
  }

  async refund(id: string, reason: string, userId: string) {
    const deposit = await this.getDetail(id);
    if (!deposit) throw new BadRequestException('Deposit not found');
    if (deposit.status !== DepositStatus.PAID) {
      throw new BadRequestException('Can only refund PAID deposits');
    }

    const updateData = { status: DepositStatus.REFUNDED, note: reason };
    const updated = await this.repository.update(id, updateData);
    
    await this.auditService.log({
      tenantId: deposit.tenantId,
      userId,
      module: 'Deposits',
      entity: 'Deposit',
      entityId: id,
      action: 'REFUND',
      before: deposit,
      after: updated,
    });

    this.eventPublisher.publish('deposit.refunded', {
      tenantId: deposit.tenantId,
      userId,
      customerId: deposit.customerId,
      customerName: deposit.customer?.fullName,
      customerPhone: deposit.customer?.phone,
      metadata: {
        code: deposit.code,
        note: reason,
        refundSourceType: 'DEPOSIT',
      },
      sourceId: deposit.id,
      sourceType: 'REFUND',
      amount: Number(deposit.amount),
      paymentProvider: 'MANUAL',
      occurredAt: new Date(),
    });

    return updated;
  }

  async cancel(id: string, reason: string, userId: string, resolutionAction?: 'REFUND' | 'KEEP' | 'DEDUCT') {
    const deposit = await this.getDetail(id);
    if (!deposit) throw new BadRequestException('Deposit not found');
    if (deposit.status !== DepositStatus.DRAFT && deposit.status !== DepositStatus.PENDING && deposit.status !== DepositStatus.PAID) {
      throw new BadRequestException('Deposit status cannot be cancelled');
    }
    if (deposit.status === DepositStatus.PAID && !resolutionAction) {
      throw new BadRequestException('Paid deposits require REFUND, KEEP, or DEDUCT resolution before cancel');
    }

    const updateData = {
      status: DepositStatus.CANCELLED,
      note: deposit.status === DepositStatus.PAID ? `[${resolutionAction}] ${reason}` : reason,
    };
    const updated = await this.repository.update(id, updateData);
    
    await this.auditService.log({
      tenantId: deposit.tenantId,
      userId,
      module: 'Deposits',
      entity: 'Deposit',
      entityId: id,
      action: 'CANCEL',
      before: deposit,
      after: updated,
    });

    if (deposit.status === DepositStatus.PAID && resolutionAction === 'DEDUCT') {
      this.eventPublisher.publish('deposit.deducted', {
        tenantId: deposit.tenantId,
        userId,
        customerId: deposit.customerId,
        customerName: deposit.customer?.fullName,
        customerPhone: deposit.customer?.phone,
        metadata: {
          code: deposit.code,
          note: reason,
          adjustmentType: 'DEPOSIT_DEDUCTION',
          resolutionAction,
        },
        sourceId: deposit.id,
        sourceType: 'ADJUSTMENT',
        amount: Number(deposit.amount),
        paymentProvider: 'MANUAL',
        occurredAt: new Date(),
      });
    }

    return updated;
  }

  async convertToContract(id: string, userId: string) {
    const deposit = await this.repository.findById(id);
    if (!deposit) throw new BadRequestException('Deposit not found');
    if (deposit.status !== DepositStatus.PAID) {
      throw new BadRequestException('Only PAID deposits can be converted to contracts');
    }

    // In a real application, you would generate a contract and invoice here.
    // For this mock implementation, we just mark the deposit as CONVERTED_TO_CONTRACT
    // and theoretically link it to a newly generated contract.
    const now = new Date();
    
    // In actual implementation, we would inject ContractsService and create a contract
    // We will simulate it by updating deposit status
    
    const updateData = { status: DepositStatus.CONVERTED_TO_CONTRACT };
    const updated = await this.repository.update(id, updateData);
    
    await this.auditService.log({
      tenantId: deposit.tenantId,
      userId,
      module: 'Deposits',
      entity: 'Deposit',
      entityId: id,
      action: 'CONVERT_CONTRACT',
      before: deposit,
      after: updated,
    });

    return {
      deposit: updated,
      // contract: newContract
    };
  }
}
