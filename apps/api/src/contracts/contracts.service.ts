import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Contract } from '@prisma/client';
import { ContractsRepository } from './contracts.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PaginatedResult } from '@homeland/shared';

@Injectable()
export class ContractsService extends BaseCrudService<Contract> {
  constructor(
    repository: ContractsRepository,
    auditService: AuditService,
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
    if (status) where.status = status;
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
}
