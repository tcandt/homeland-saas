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

    return this.repository.paginate(where, page, limit, orderBy, {
      floors: {
        where: { deletedAt: null },
        include: {
          rooms: {
            where: { deletedAt: null }
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

  async softDelete(id: string, userId?: string, moduleName?: string): Promise<Building> {
    const building = await this.getDetail(id, {
      _count: {
        select: { 
          floors: { where: { deletedAt: null } }, 
          rooms: { where: { deletedAt: null } } 
        }
      }
    });
    
    const floorCount = (building as any)._count?.floors || 0;
    const roomCount = (building as any)._count?.rooms || 0;

    if (floorCount > 0 || roomCount > 0) {
      const { HttpException, HttpStatus } = await import('@nestjs/common');
      throw new HttpException('Cannot delete building with active floors or rooms', HttpStatus.CONFLICT);
    }
    return super.softDelete(id, userId, moduleName);
  }
}
