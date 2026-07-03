import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async log(params: {
    action: string;
    entity: string;
    entityId?: string;
    before?: any;
    after?: any;
    module?: string;
    tenantId?: string;
    userId?: string;
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
          ip: this.cls.get('ip'),
          userAgent: this.cls.get('userAgent'),
          duration,
        },
      });
    } catch (error) {
      // Don't crash the main process if audit logging fails
      console.error('Audit Log Error:', error);
    }
  }
}
