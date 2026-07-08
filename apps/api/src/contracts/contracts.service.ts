import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Contract, ContractStatus, RoomStatus } from '@prisma/client';
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

  async listContracts(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    roomId?: string,
    customerId?: string,
    sort?: string,
    order?: string
  ): Promise<PaginatedResult<Contract>> {
    const where: any = {};
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
}
