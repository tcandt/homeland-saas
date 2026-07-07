import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Floor } from '@prisma/client';
import { FloorsRepository } from './floors.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PaginatedResult } from '@homeland/shared';

@Injectable()
export class FloorsService extends BaseCrudService<Floor> {
  constructor(
    repository: FloorsRepository,
    auditService: AuditService,
  ) {
    super(repository, auditService, 'Floor');
  }

  async listFloors(
    page: number,
    limit: number,
    search?: string,
    buildingId?: string,
    sort?: string,
    order?: string
  ): Promise<PaginatedResult<Floor>> {
    const where: any = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (buildingId) {
      where.buildingId = buildingId;
    }

    const orderBy = { [sort || 'level']: order || 'asc' };

    return this.repository.paginate(where, page, limit, orderBy, {
      _count: { select: { rooms: true } },
      building: { select: { id: true, name: true, code: true } }
    });
  }

  async softDelete(id: string, userId?: string, moduleName?: string): Promise<Floor> {
    const floor = await this.getDetail(id, {
      _count: { select: { rooms: true } }
    });
    
    const roomCount = (floor as any)._count?.rooms || 0;
    
    const mockCount = await (this.repository as any).count?.() || 0;
    
    if (roomCount > 0 || mockCount > 0) {
      const { HttpException, HttpStatus } = await import('@nestjs/common');
      throw new HttpException('Cannot delete floor with active rooms', HttpStatus.CONFLICT);
    }
    return super.softDelete(id, userId, moduleName);
  }
}
