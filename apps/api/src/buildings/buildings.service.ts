import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Building } from '@prisma/client';
import { BuildingsRepository } from './buildings.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PaginatedResult } from '@homeland/shared';

@Injectable()
export class BuildingsService extends BaseCrudService<Building> {
  constructor(
    repository: BuildingsRepository,
    auditService: AuditService,
  ) {
    super(repository, auditService, 'Building');
  }

  async listBuildings(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    sort?: string,
    order?: string
  ): Promise<PaginatedResult<Building>> {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const orderBy = { [sort || 'createdAt']: order || 'desc' };

    // the BaseRepository handles tenant isolation via Prisma extension
    return this.repository.paginate(where, page, limit, orderBy, {
      _count: {
        select: { floors: true, rooms: true }
      }
    });
  }
}
