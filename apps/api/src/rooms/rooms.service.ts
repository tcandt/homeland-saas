import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Room } from '@prisma/client';
import { RoomsRepository } from './rooms.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PaginatedResult } from '@homeland/shared';

@Injectable()
export class RoomsService extends BaseCrudService<Room> {
  constructor(
    repository: RoomsRepository,
    auditService: AuditService,
  ) {
    super(repository, auditService, 'Room');
  }

  async listRooms(
    page: number,
    limit: number,
    search?: string,
    buildingId?: string,
    floorId?: string,
    status?: string,
    type?: string,
    sort?: string,
    order?: string
  ): Promise<PaginatedResult<Room>> {
    const where: any = {};
    if (search) {
      where.code = { contains: search, mode: 'insensitive' };
    }
    if (buildingId) where.buildingId = buildingId;
    if (floorId) where.floorId = floorId;
    if (status) where.status = status;
    if (type) where.type = type;

    const orderBy = { [sort || 'code']: order || 'asc' };

    return this.repository.paginate(where, page, limit, orderBy, {
      building: { select: { id: true, name: true, code: true } },
      floor: { select: { id: true, name: true, level: true } },
      contracts: {
        where: { status: 'ACTIVE' },
        include: { customer: { select: { id: true, fullName: true, phone: true } } },
        take: 1
      }
    });
  }
}
