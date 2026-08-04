import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Building } from '@prisma/client';
import { BuildingsRepository } from './buildings.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PaginatedResult } from '@homeland/shared';
import { ACTIVE_LIKE_CONTRACT_STATUSES } from '../contracts/contracts.adapter';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BuildingsService extends BaseCrudService<Building> {
  constructor(
    repository: BuildingsRepository,
    auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {
    super(repository, auditService, 'Building');
  }

  async create(data: any, userId?: string, moduleName?: string): Promise<Building> {
    if (data.displayOrder === undefined) {
      const lastBuilding = await (this.prisma.tx as any).building.findFirst({
        where: { deletedAt: null },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });
      data = {
        ...data,
        displayOrder: (lastBuilding?.displayOrder ?? -1000) + 1000,
      };
    }

    return super.create(data, userId, moduleName);
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

    const orderBy = sort
      ? { [sort]: order || 'desc' }
      : [{ displayOrder: 'asc' }, { createdAt: 'desc' }];

    return this.repository.paginate(where, page, limit, orderBy, {
      floors: {
        where: { deletedAt: null },
        include: {
          rooms: {
            where: { deletedAt: null },
            include: {
              contracts: {
                where: { status: { in: ACTIVE_LIKE_CONTRACT_STATUSES } },
                include: { customer: { select: { id: true, fullName: true, phone: true, email: true, identityNo: true, gender: true, birthDate: true, nationality: true, address: true, emergencyPhone: true } } },
                orderBy: { createdAt: 'asc' }
              },
              roommates: {
                where: { deletedAt: null },
                select: { id: true, fullName: true, phone: true, email: true, identityNo: true, gender: true, birthDate: true, nationality: true, address: true, emergencyPhone: true }
              }
            }
          }
        }
      },
      _count: {
        select: { 
          floors: { where: { deletedAt: null } }, 
          rooms: { where: { deletedAt: null } } 
        }
      }
    });
  }

  async moveOrder(id: string, direction: 'up' | 'down', userId?: string): Promise<PaginatedResult<Building>> {
    const tx: any = this.prisma.tx;
    const buildings = await tx.building.findMany({
      where: { deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, displayOrder: true },
    });

    const currentIndex = buildings.findIndex((building: any) => building.id === id);
    if (currentIndex === -1) {
      const { HttpException, HttpStatus } = await import('@nestjs/common');
      throw new HttpException('Không tìm thấy tòa nhà cần sắp xếp.', HttpStatus.NOT_FOUND);
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= buildings.length) {
      return this.listBuildings(1, 100);
    }

    const normalized = buildings.map((building: any, index: number) => ({
      ...building,
      displayOrder: index * 1000,
    }));
    const current = normalized[currentIndex];
    const target = normalized[targetIndex];

    await Promise.all([
      tx.building.update({ where: { id: current.id }, data: { displayOrder: target.displayOrder } }),
      tx.building.update({ where: { id: target.id }, data: { displayOrder: current.displayOrder } }),
    ]);

    await this.auditService.log({
      action: 'UPDATE',
      entity: 'Building',
      entityId: id,
      userId,
      after: { direction, previousIndex: currentIndex, nextIndex: targetIndex },
    });

    return this.listBuildings(1, 100);
  }

  async softDelete(id: string, userId?: string, moduleName?: string): Promise<Building> {
    const building = await this.getDetail(id, {
      floors: { where: { deletedAt: null } },
      rooms: {
        where: { deletedAt: null },
        include: { contracts: { where: { deletedAt: null, status: { in: ACTIVE_LIKE_CONTRACT_STATUSES } } } }
      }
    });
    
    const rooms = (building as any).rooms || [];
    const floors = (building as any).floors || [];
    const hasActiveContracts = rooms.some((r: any) => r.contracts && r.contracts.length > 0);

    if (hasActiveContracts) {
      const { HttpException, HttpStatus } = await import('@nestjs/common');
      throw new HttpException('Không thể xóa tòa nhà. Một số phòng đang có hợp đồng hoạt động.', HttpStatus.CONFLICT);
    }
    
    if (rooms.length > 0) {
      const roomIds = rooms.map((r: any) => r.id);
      await this.prisma.room.updateMany({
        where: { id: { in: roomIds } },
        data: { deletedAt: new Date(), deletedBy: userId }
      });
    }

    if (floors.length > 0) {
      const floorIds = floors.map((f: any) => f.id);
      await this.prisma.floor.updateMany({
        where: { id: { in: floorIds } },
        data: { deletedAt: new Date(), deletedBy: userId }
      });
    }

    return super.softDelete(id, userId, moduleName);
  }
}
