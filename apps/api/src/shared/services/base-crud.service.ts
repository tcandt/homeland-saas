import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseRepository } from '../repositories/base.repository';
import { AuditService } from '../audit/audit.service';
import { PaginatedResult } from '@homeland/shared';

@Injectable()
export class BaseCrudService<T> {
  constructor(
    protected readonly repository: BaseRepository<T, any>,
    protected readonly auditService: AuditService,
    protected readonly entityName: string,
  ) {}

  async list(
    where: any,
    page: number = 1,
    limit: number = 20,
    orderBy?: any,
    include?: any
  ): Promise<PaginatedResult<T>> {
    return this.repository.paginate(where, page, limit, orderBy, include);
  }

  async getDetail(id: string, include?: any): Promise<T> {
    const record = await this.repository.findById(id, include);
    if (!record) {
      throw new NotFoundException(`${this.entityName} with ID ${id} not found`);
    }
    return record;
  }

  async create(data: any, userId?: string, moduleName?: string): Promise<T> {
    const record = await this.repository.create(data);
    
    await this.auditService.log({
      action: 'CREATE',
      entity: this.entityName,
      entityId: (record as any).id,
      module: moduleName || this.entityName,
      after: record,
      userId,
    });

    return record;
  }

  async update(id: string, data: any, userId?: string, moduleName?: string): Promise<T> {
    const before = await this.getDetail(id);
    const record = await this.repository.update(id, data);
    
    await this.auditService.log({
      action: 'UPDATE',
      entity: this.entityName,
      entityId: id,
      module: moduleName || this.entityName,
      before,
      after: record,
      userId,
    });

    return record;
  }

  async softDelete(id: string, userId?: string, moduleName?: string): Promise<T> {
    const before = await this.getDetail(id);
    const record = await this.repository.softDelete(id, userId);
    
    await this.auditService.log({
      action: 'DELETE',
      entity: this.entityName,
      entityId: id,
      module: moduleName || this.entityName,
      before,
      userId,
    });

    return record;
  }
}
