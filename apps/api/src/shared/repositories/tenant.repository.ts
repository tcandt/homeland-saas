import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma, TenantOrg } from '@prisma/client';

@Injectable()
export class TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCode(code: string): Promise<TenantOrg | null> {
    return this.prisma.tenantOrg.findUnique({
      where: { code },
    });
  }

  async create(data: Prisma.TenantOrgCreateInput): Promise<TenantOrg> {
    return this.prisma.tenantOrg.create({
      data,
    });
  }

  async findById(id: string): Promise<TenantOrg | null> {
    return this.prisma.tenantOrg.findUnique({
      where: { id },
    });
  }
}
