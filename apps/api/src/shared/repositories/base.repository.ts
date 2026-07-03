import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PaginatedResult } from '@homeland/shared';

@Injectable()
export class BaseRepository<T, ModelName extends string> {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly modelName: ModelName,
  ) {}

  protected get model(): any {
    return this.prisma.tx[this.modelName as string];
  }

  async findMany(args?: any): Promise<T[]> {
    return this.model.findMany({
      ...args,
      where: { ...args?.where, deletedAt: null },
    });
  }

  async findById(id: string, include?: any): Promise<T | null> {
    return this.model.findFirst({
      where: { id, deletedAt: null },
      include,
    });
  }

  async create(data: any): Promise<T> {
    return this.model.create({ data });
  }

  async update(id: string, data: any): Promise<T> {
    return this.model.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string, deletedBy?: string): Promise<T> {
    return this.model.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
      },
    });
  }

  async paginate(
    where: any,
    page: number,
    limit: number,
    orderBy?: any,
    include?: any
  ): Promise<PaginatedResult<T>> {
    const activeWhere = { ...where, deletedAt: null };
    
    const [total, data] = await Promise.all([
      this.model.count({ where: activeWhere }),
      this.model.findMany({
        where: activeWhere,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: orderBy || { createdAt: 'desc' },
        include,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }
}
