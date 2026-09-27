import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, LeadStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';

export type UpdateSalesLeadStageInput = {
  status?: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PERMITTED_STAGE_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  [LeadStatus.NEW]: [LeadStatus.CONTACTED, LeadStatus.LOST],
  [LeadStatus.CONTACTED]: [LeadStatus.QUALIFIED, LeadStatus.LOST],
  [LeadStatus.QUALIFIED]: [LeadStatus.PROPOSAL, LeadStatus.LOST],
  [LeadStatus.PROPOSAL]: [LeadStatus.WON, LeadStatus.LOST],
  [LeadStatus.WON]: [],
  [LeadStatus.LOST]: [],
};

@Injectable()
export class SalesStageService {
  constructor(private readonly prisma: PrismaService) {}

  async updateStage(
    tenantId: string,
    userId: string,
    leadId: string,
    input: UpdateSalesLeadStageInput,
    idempotencyKey?: string,
  ) {
    const targetStatus = this.normalizeStatus(input.status);
    const key = this.requireIdempotencyKey(idempotencyKey);
    const auditId = this.deterministicAuditId(tenantId, key);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await this.resolveReplay(tx, auditId, tenantId, leadId, key, targetStatus);
        if (replay) return replay;

        const lead = await tx.salesLead.findFirst({
          where: { id: leadId, tenantId, deletedAt: null },
        });
        if (!lead) throw new NotFoundException('Không tìm thấy lead trong đơn vị hiện tại');

        if (lead.status === targetStatus) {
          throw new BadRequestException(`Lead đang ở trạng thái ${targetStatus}`);
        }
        if (!PERMITTED_STAGE_TRANSITIONS[lead.status].includes(targetStatus)) {
          throw new BadRequestException(`Không thể chuyển lead từ ${lead.status} sang ${targetStatus}`);
        }

        const updated = await tx.salesLead.updateMany({
          where: { id: leadId, tenantId, deletedAt: null, status: lead.status },
          data: { status: targetStatus },
        });

        if (updated.count !== 1) {
          const concurrentReplay = await this.resolveReplay(tx, auditId, tenantId, leadId, key, targetStatus);
          if (concurrentReplay) return concurrentReplay;
          throw new ConflictException('Trạng thái lead đã thay đổi. Vui lòng tải lại và thử lại.');
        }

        const changedLead = await tx.salesLead.findFirst({
          where: { id: leadId, tenantId, deletedAt: null },
        });
        if (!changedLead) throw new NotFoundException('Không tìm thấy lead trong đơn vị hiện tại');

        await tx.auditLog.create({
          data: {
            id: auditId,
            tenantId,
            userId,
            module: 'Sales',
            entity: 'SalesLead',
            entityId: leadId,
            action: AuditAction.UPDATE,
            before: { status: lead.status },
            after: { idempotencyKey: key, status: targetStatus },
          },
        });

        return changedLead;
      });
    } catch (error) {
      if (!this.isUniqueConstraint(error)) throw error;

      const replay = await this.resolveReplay(this.prisma, auditId, tenantId, leadId, key, targetStatus);
      if (replay) return replay;
      throw error;
    }
  }

  private async resolveReplay(
    client: Pick<PrismaService, 'auditLog' | 'salesLead'>,
    auditId: string,
    tenantId: string,
    leadId: string,
    key: string,
    targetStatus: LeadStatus,
  ) {
    const audit = await client.auditLog.findUnique({ where: { id: auditId } });
    if (!audit) return null;

    const after = audit.after as Record<string, unknown> | null;
    const matches = audit.tenantId === tenantId
      && audit.module === 'Sales'
      && audit.entity === 'SalesLead'
      && audit.entityId === leadId
      && audit.action === AuditAction.UPDATE
      && after?.idempotencyKey === key
      && after.status === targetStatus;
    if (!matches) {
      throw new ConflictException('Idempotency-Key đã được dùng cho một cập nhật lead khác');
    }

    const lead = await client.salesLead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Không tìm thấy lead trong đơn vị hiện tại');
    return lead;
  }

  private normalizeStatus(value: unknown): LeadStatus {
    const status = String(value ?? '').trim().toUpperCase();
    if (!Object.values(LeadStatus).includes(status as LeadStatus)) {
      throw new BadRequestException('Trạng thái lead không hợp lệ');
    }
    return status as LeadStatus;
  }

  private requireIdempotencyKey(value?: string): string {
    const key = String(value || '').trim().toLowerCase();
    if (!UUID_PATTERN.test(key)) {
      throw new BadRequestException('Idempotency-Key phải là UUID hợp lệ');
    }
    return key;
  }

  private deterministicAuditId(tenantId: string, key: string) {
    const hash = createHash('sha256').update(`sales-stage:${tenantId}:${key}`).digest('hex').split('');
    hash[12] = '5';
    hash[16] = (8 + (parseInt(hash[16], 16) & 0x03)).toString(16);
    const value = hash.join('');
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
  }

  private isUniqueConstraint(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
