import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Contract, ContractStatus, RoomStatus, InvoiceStatus, DepositStatus } from '@prisma/client';
import { ContractsRepository } from './contracts.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PaginatedResult } from '@homeland/shared';
import { mapStatusFilter } from './contracts.adapter';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ContractsService extends BaseCrudService<Contract> {
  constructor(
    repository: ContractsRepository,
    auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {
    super(repository, auditService, 'Contract');
  }

  async getDetail(id: string, include?: any): Promise<any> {
    const record = await super.getDetail(id, include);
    if (record.coRepresentativeIds && record.coRepresentativeIds.length > 0) {
      const coReps = await this.prisma.tx.customer.findMany({
        where: { id: { in: record.coRepresentativeIds } },
        select: { id: true, fullName: true, phone: true, identityNo: true, idImages: true },
      });
      return { ...record, coRepresentatives: coReps };
    }
    return record;
  }

  async listContracts(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    roomId?: string,
    customerId?: string,
    sort?: string,
    order?: string,
    tenantId?: string
  ): Promise<PaginatedResult<Contract>> {
    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { customer: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status) where.status = mapStatusFilter(status);
    if (roomId) where.roomId = roomId;
    if (customerId) where.customerId = customerId;

    const orderBy = { [sort || 'createdAt']: order || 'desc' };

    return this.repository.paginate(where, page, limit, orderBy, {
      customer: { select: { id: true, fullName: true, phone: true } },
      room: { 
        select: { id: true, code: true, building: { select: { id: true, name: true } } } 
      }
    });
  }

  async submitContract(id: string, userId: string): Promise<Contract> {
    const contract = await this.getDetail(id);
    
    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException(`Cannot submit contract in ${contract.status} status. Only DRAFT is allowed.`);
    }

    const updated = await this.prisma.tx.contract.update({
      where: { id },
      data: { status: ContractStatus.PENDING_APPROVAL },
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: this.entityName,
      entityId: id,
      module: 'Contracts',
      before: contract,
      after: updated,
      userId,
    });

    return updated;
  }

  async approveContract(id: string, userId: string): Promise<Contract> {
    const contract = await this.getDetail(id);
    
    if (contract.status !== ContractStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`Cannot approve contract in ${contract.status} status. Only PENDING_APPROVAL is allowed.`);
    }

    const room = await this.prisma.tx.room.findUnique({ where: { id: contract.roomId } });
    if (!room || room.status !== RoomStatus.AVAILABLE) {
      throw new ConflictException(`Room ${room?.code || contract.roomId} is not AVAILABLE.`);
    }

    const result = await this.prisma.tx.$transaction(async (tx) => {
      // 1. Update contract to APPROVED
      const updatedContract = await tx.contract.update({
        where: { id },
        data: { status: ContractStatus.APPROVED },
      });

      // 2. Reserve Room
      const updatedRoom = await tx.room.update({
        where: { id: contract.roomId },
        data: { status: RoomStatus.RESERVED },
      });

      // 3. Create Deposit Draft
      const deposit = await tx.deposit.create({
        data: {
          tenantId: contract.tenantId,
          code: `DEP-${Date.now()}`,
          roomId: contract.roomId,
          customerId: contract.customerId,
          contractId: contract.id,
          amount: contract.depositMoney,
          status: 'DRAFT', // using draft status
        }
      });

      return { updatedContract, updatedRoom, deposit };
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: this.entityName,
      entityId: id,
      module: 'Contracts',
      before: contract,
      after: result.updatedContract,
      userId,
    });

    return result.updatedContract;
  }

  async activateContract(id: string, userId: string): Promise<Contract> {
    const contract = await this.getDetail(id);

    if (contract.status !== ContractStatus.APPROVED) {
      throw new BadRequestException(`Cannot activate contract in ${contract.status} status. Only APPROVED is allowed.`);
    }

    const room = await this.prisma.tx.room.findUnique({ where: { id: contract.roomId } });
    if (!room || room.status !== RoomStatus.RESERVED) {
      throw new ConflictException(`Room ${room?.code || contract.roomId} is not RESERVED.`);
    }

    const deposit = await this.prisma.tx.deposit.findFirst({
      where: { contractId: contract.id },
    });

    if (!deposit) {
      throw new BadRequestException('Cannot activate contract: Deposit is missing.');
    }

    if (deposit.status !== DepositStatus.PAID && deposit.status !== DepositStatus.CONVERTED_TO_CONTRACT) {
      throw new BadRequestException(`Cannot activate contract: Deposit is in ${deposit.status} status. Must be PAID.`);
    }

    const result = await this.prisma.tx.$transaction(async (tx) => {
      // 1. Update contract to ACTIVE
      const updatedContract = await tx.contract.update({
        where: { id },
        data: { status: ContractStatus.ACTIVE },
      });

      // 2. Occupy Room
      const updatedRoom = await tx.room.update({
        where: { id: contract.roomId },
        data: { status: RoomStatus.OCCUPIED },
      });

      // 3. Convert Deposit
      const updatedDeposit = await tx.deposit.update({
        where: { id: deposit.id },
        data: { status: DepositStatus.CONVERTED_TO_CONTRACT },
      });

      // 4. Create initial Invoice
      const invoice = await tx.invoice.create({
        data: {
          tenantId: contract.tenantId,
          code: `INV-${Date.now()}`,
          contractId: contract.id,
          customerId: contract.customerId,
          status: InvoiceStatus.ISSUED,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          subtotal: contract.monthlyRent,
          discount: 0,
          total: contract.monthlyRent,
          paidAmount: 0,
          creditAmount: 0,
          items: {
            create: [
              {
                tenantId: contract.tenantId,
                type: 'RENT',
                description: 'First month rent',
                quantity: 1,
                unitPrice: contract.monthlyRent,
                amount: contract.monthlyRent,
              }
            ]
          }
        },
      });

      return { updatedContract, updatedRoom, updatedDeposit, invoice };
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: this.entityName,
      entityId: id,
      module: 'Contracts',
      before: contract,
      after: result.updatedContract,
      userId,
    });

    return result.updatedContract;
  }

  async terminateContract(id: string, userId: string): Promise<Contract> {
    return this.finalizeContract(id, userId, ContractStatus.TERMINATED);
  }

  async expireContract(id: string, userId: string): Promise<Contract> {
    return this.finalizeContract(id, userId, ContractStatus.EXPIRED);
  }

  private async finalizeContract(id: string, userId: string, targetStatus: ContractStatus): Promise<Contract> {
    const contract = await this.getDetail(id);

    if (contract.status !== ContractStatus.ACTIVE && contract.status !== ContractStatus.EXPIRING) {
      throw new BadRequestException(`Cannot finalize contract in ${contract.status} status. Only ACTIVE or EXPIRING is allowed.`);
    }

    const result = await this.prisma.tx.$transaction(async (tx) => {
      // 1. Update contract status
      const updatedContract = await tx.contract.update({
        where: { id },
        data: { status: targetStatus },
      });

      // 2. Room becomes CLEANING
      const updatedRoom = await tx.room.update({
        where: { id: contract.roomId },
        data: { status: RoomStatus.CLEANING },
      });

      // 3. Create final invoice as DRAFT
      const invoice = await tx.invoice.create({
        data: {
          tenantId: contract.tenantId,
          code: `FIN-${Date.now()}`,
          contractId: contract.id,
          customerId: contract.customerId,
          status: InvoiceStatus.DRAFT,
          dueDate: new Date(), // Immediate due date for final settlement
          subtotal: 0, // Manual adjustments to follow
          discount: 0,
          total: 0,
          paidAmount: 0,
          creditAmount: 0,
        },
      });

      return { updatedContract, updatedRoom, invoice };
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: this.entityName,
      entityId: id,
      module: 'Contracts',
      before: contract,
      after: result.updatedContract,
      userId,
    });

    return result.updatedContract;
  }
}
