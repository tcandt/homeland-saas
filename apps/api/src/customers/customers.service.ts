import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Customer } from '@prisma/client';
import { CustomersRepository } from './customers.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PaginatedResult } from '@homeland/shared';

@Injectable()
export class CustomersService extends BaseCrudService<Customer> {
  constructor(
    repository: CustomersRepository,
    auditService: AuditService,
  ) {
    super(repository, auditService, 'Customer');
  }

  async listCustomers(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    sort?: string,
    order?: string
  ): Promise<PaginatedResult<Customer>> {
    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const orderBy = { [sort || 'createdAt']: order || 'desc' };

    return this.repository.paginate(where, page, limit, orderBy, {
      _count: { select: { contracts: true } }
    });
  }
}
