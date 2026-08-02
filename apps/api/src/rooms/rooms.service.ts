import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Room } from '@prisma/client';
import { RoomsRepository } from './rooms.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PaginatedResult } from '@homeland/shared';
import { ACTIVE_LIKE_CONTRACT_STATUSES } from '../contracts/contracts.adapter';

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
        where: { status: { in: ACTIVE_LIKE_CONTRACT_STATUSES }, deletedAt: null },
        include: { customer: { select: { id: true, fullName: true, phone: true, email: true, identityNo: true, gender: true, birthDate: true, nationality: true, address: true, emergencyPhone: true } } },
        orderBy: { createdAt: 'asc' }
      },
      roommates: {
        where: { deletedAt: null },
        select: { id: true, fullName: true, phone: true, identityNo: true, gender: true, birthDate: true, nationality: true, address: true, emergencyPhone: true }
      }
    });
  }

  async softDelete(id: string, userId?: string, moduleName?: string): Promise<Room> {
    const room = await this.getDetail(id, {
      _count: { select: { contracts: { where: { status: { in: ACTIVE_LIKE_CONTRACT_STATUSES }, deletedAt: null } } } }
    });
    
    const activeContractCount = (room as any)._count?.contracts || 0;
    
    if (activeContractCount > 0) {
      const { HttpException, HttpStatus } = await import('@nestjs/common');
      throw new HttpException('Không thể xóa phòng đang có hợp đồng hoạt động. Vui lòng chấm dứt hợp đồng trước.', HttpStatus.CONFLICT);
    }

    // Append timestamp to code to free up the unique constraint for active rooms
    await this.repository.update(id, {
      code: `${room.code}_del_${Date.now()}`
    } as any);

    return super.softDelete(id, userId, moduleName);
  }
}
