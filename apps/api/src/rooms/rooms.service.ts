import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Prisma, Room, RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { RoomsRepository } from './rooms.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PaginatedResult } from '@homeland/shared';
import { ACTIVE_LIKE_CONTRACT_STATUSES, ROOM_VISIBLE_CONTRACT_STATUSES } from '../contracts/contracts.adapter';

@Injectable()
export class RoomsService extends BaseCrudService<Room> {
  constructor(
    repository: RoomsRepository,
    auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {
    super(repository, auditService, 'Room');
  }

  async update(id: string, data: any, userId?: string, moduleName?: string, tenantId?: string): Promise<Room> {
    if (data.status !== RoomStatus.AVAILABLE) {
      return super.update(id, data, userId, moduleName);
    }
    if (!tenantId) throw new ForbiddenException('ROOM_TURNOVER_TENANT_REQUIRED');

    // Share the room lock with booking/activation; status and audit commit together.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`SELECT "id" FROM "Room" WHERE "id" = ${id} AND "tenantId" = ${tenantId} AND "deletedAt" IS NULL FOR UPDATE`,
          );
          if (!rows.length) throw new NotFoundException('ROOM_TURNOVER_ROOM_NOT_FOUND');
          const before = await tx.room.findFirst({ where: { id, tenantId, deletedAt: null } });
          if (!before) throw new NotFoundException('ROOM_TURNOVER_ROOM_NOT_FOUND');
          if (!([RoomStatus.CLEANING, RoomStatus.MAINTENANCE, RoomStatus.AVAILABLE] as RoomStatus[]).includes(before.status)) {
            throw new ConflictException('ROOM_TURNOVER_INVALID_STATUS');
          }
          const [occupancies, contracts, holds, bindings] = await Promise.all([
            tx.occupancy.count({ where: { tenantId, roomId: id, leftAt: null } }),
            tx.contract.count({ where: { tenantId, roomId: id, deletedAt: null, status: { in: ROOM_VISIBLE_CONTRACT_STATUSES } } }),
            tx.roomHold.count({ where: { tenantId, roomId: id, status: 'ACTIVE', expiresAt: { gt: new Date() } } }),
            tx.customer.count({ where: { tenantId, roomId: id, deletedAt: null } }),
          ]);
          if (occupancies || contracts || holds || bindings) {
            throw new ConflictException('ROOM_TURNOVER_ROOM_IN_USE');
          }
          const after = await tx.room.update({ where: { id, tenantId }, data });
          await tx.auditLog.create({
            data: {
              tenantId, userId, action: 'UPDATE', entity: 'Room', entityId: id,
              module: moduleName || 'Rooms',
              before: JSON.parse(JSON.stringify(before)),
              after: JSON.parse(JSON.stringify(after)),
            },
          });
          return after;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error: any) {
        const retryable = error?.code === 'P2034' ||
          (error?.code === 'P2010' && ['40001', '40P01'].includes(String(error?.meta?.code || '')));
        if (!retryable) throw error;
        if (attempt === 2) throw new ConflictException('ROOM_TURNOVER_CONCURRENT_CONFLICT');
      }
    }
    throw new ConflictException('ROOM_TURNOVER_CONCURRENT_CONFLICT');
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
        where: { status: { in: ROOM_VISIBLE_CONTRACT_STATUSES }, deletedAt: null },
        include: {
          customer: { select: { id: true, fullName: true, phone: true, email: true, identityNo: true, gender: true, birthDate: true, nationality: true, address: true, emergencyPhone: true, idImages: true, relationship: true } },
          parties: {
            where: { role: 'CO_REPRESENTATIVE', leftAt: null },
            include: { customer: { select: { id: true, fullName: true, phone: true, email: true, identityNo: true, gender: true, birthDate: true, nationality: true, address: true, emergencyPhone: true, idImages: true, relationship: true } } },
          },
        },
        orderBy: { createdAt: 'asc' }
      },
      roommates: {
        where: { deletedAt: null },
        select: { id: true, fullName: true, phone: true, email: true, identityNo: true, gender: true, birthDate: true, nationality: true, address: true, emergencyPhone: true, idImages: true, relationship: true }
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
