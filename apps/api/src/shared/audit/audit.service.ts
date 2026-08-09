import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ClsService } from 'nestjs-cls';
import { AuditAction, Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async log(params: {
    action: AuditAction;
    entity: string;
    entityId?: string;
    before?: any;
    after?: any;
    module?: string;
    tenantId?: string;
    userId?: string;
    ip?: string;
    userAgent?: string;
  }) {
    try {
      const requestId = this.cls.getId();
      const duration = 0; // Can be calculated if using interceptor
      // fallback to current user/tenant if not provided
      const userId = params.userId || this.cls.get('userId');
      const tenantId = params.tenantId || this.cls.get('tenantId');

      await this.prisma.auditLog.create({
        data: {
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          before: params.before,
          after: params.after,
          module: params.module,
          requestId,
          tenantId,
          userId,
          ip: params.ip || this.cls.get('ip'),
          userAgent: params.userAgent || this.cls.get('userAgent'),
          duration,
        },
      });
    } catch (error) {
      // Don't crash the main process if audit logging fails
      console.error('Audit Log Error:', error);
    }
  }

  async listRecent(params: {
    tenantId: string;
    limit?: number;
    module?: string;
    action?: AuditAction;
    userEmail?: string;
  }) {
    const take = Math.min(Math.max(Number(params.limit || 50), 1), 100);
    const where: Prisma.AuditLogWhereInput = { tenantId: params.tenantId };

    if (params.module) {
      const modules = params.module.split(',').map((item) => item.trim()).filter(Boolean);
      if (modules.length > 0) where.module = { in: modules };
    }
    if (params.action) where.action = params.action;

    if (params.userEmail) {
      const users = await this.prisma.user.findMany({
        where: {
          tenantId: params.tenantId,
          email: { contains: params.userEmail, mode: 'insensitive' },
        },
        select: { id: true },
      });
      where.userId = { in: users.map((user) => user.id) };
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });

    const userIds = Array.from(new Set(logs.map((log) => log.userId).filter(Boolean))) as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds }, tenantId: params.tenantId },
          select: { id: true, email: true, fullName: true },
        })
      : [];
    const userById = new Map(users.map((user) => [user.id, user]));

    return logs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt,
      module: log.module,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      userId: log.userId,
      user: log.userId ? userById.get(log.userId) || null : null,
      ip: log.ip,
      userAgent: log.userAgent,
      before: log.before,
      after: log.after,
    }));
  }
}
