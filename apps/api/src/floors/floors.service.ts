import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Floor } from '@prisma/client';
import { FloorsRepository } from './floors.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PaginatedResult } from '@homeland/shared';

import { PrismaService } from '../prisma.service';
import { ACTIVE_LIKE_CONTRACT_STATUSES } from '../contracts/contracts.adapter';

@Injectable()
export class FloorsService extends BaseCrudService<Floor> {
  constructor(
    repository: FloorsRepository,
    auditService: AuditService,
    private readonly prisma: PrismaService,
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
      rooms: {
        where: { deletedAt: null },
        include: { contracts: { where: { status: { in: ACTIVE_LIKE_CONTRACT_STATUSES } } } }
      }
    });
    
    const rooms = (floor as any).rooms || [];
    const hasActiveContracts = rooms.some((r: any) => r.contracts && r.contracts.length > 0);
    
    if (hasActiveContracts) {
      const { HttpException, HttpStatus } = await import('@nestjs/common');
      throw new HttpException('Không thể xóa tầng. Một số phòng trong tầng đang có hợp đồng hoạt động.', HttpStatus.CONFLICT);
    }
    
    if (rooms.length > 0) {
      const roomIds = rooms.map((r: any) => r.id);
      await this.prisma.room.updateMany({
        where: { id: { in: roomIds } },
        data: { deletedAt: new Date(), deletedBy: userId }
      });
    }

    return super.softDelete(id, userId, moduleName);
  }
}
