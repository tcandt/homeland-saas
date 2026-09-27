import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';

export type CreateSalesLeadInput = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  notes?: unknown;
};

type NormalizedSalesLeadInput = {
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class SalesCreateService {
  constructor(private readonly prisma: PrismaService) {}

  async createLead(
    tenantId: string,
    userId: string,
    input: CreateSalesLeadInput,
    idempotencyKey?: string,
  ) {
    const normalizedInput = this.normalizeInput(input);
    const normalizedKey = this.requireIdempotencyKey(idempotencyKey);
    const leadId = this.deterministicLeadId(tenantId, normalizedKey);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.salesLead.findFirst({
          where: { id: leadId, tenantId },
        });
        if (existing) return this.replayOrReject(existing, normalizedInput);

        const lead = await tx.salesLead.create({
          data: {
            id: leadId,
            tenantId,
            name: normalizedInput.name,
            phone: normalizedInput.phone,
            email: normalizedInput.email,
            notes: normalizedInput.notes,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            userId,
            module: 'Sales',
            entity: 'SalesLead',
            entityId: lead.id,
            action: AuditAction.CREATE,
            after: {
              idempotencyKey: normalizedKey,
              name: lead.name,
              phone: lead.phone,
              email: lead.email,
              notes: lead.notes,
              status: lead.status,
            },
          },
        });

        return lead;
      });
    } catch (error) {
      if (!this.isUniqueConstraint(error)) throw error;

      // A concurrent request can win creation of this deterministic ID. Its
      // payload is still checked before treating the command as a replay.
      const existing = await this.prisma.salesLead.findFirst({
        where: { id: leadId, tenantId },
      });
      if (existing) return this.replayOrReject(existing, normalizedInput);
      throw error;
    }
  }

  private normalizeInput(input: CreateSalesLeadInput): NormalizedSalesLeadInput {
    const name = this.normalizeText(input.name);
    if (name.length < 2 || name.length > 160) {
      throw new BadRequestException('Tên khách hàng phải có từ 2 đến 160 ký tự');
    }

    const phone = String(input.phone ?? '').replace(/\D/g, '');
    if (phone.length < 8 || phone.length > 15) {
      throw new BadRequestException('Số điện thoại không hợp lệ');
    }

    const rawEmail = this.normalizeText(input.email);
    const email = rawEmail ? rawEmail.toLowerCase() : null;
    if (email && (!EMAIL_PATTERN.test(email) || email.length > 254)) {
      throw new BadRequestException('Email không hợp lệ');
    }

    const rawNotes = this.normalizeText(input.notes);
    if (rawNotes.length > 2000) {
      throw new BadRequestException('Ghi chú không được vượt quá 2000 ký tự');
    }

    return { name, phone, email, notes: rawNotes || null };
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
  }

  private requireIdempotencyKey(value?: string): string {
    const key = String(value || '').trim();
    if (!UUID_PATTERN.test(key)) {
      throw new BadRequestException('Idempotency-Key phải là UUID hợp lệ');
    }
    return key.toLowerCase();
  }

  private deterministicLeadId(tenantId: string, idempotencyKey: string): string {
    const hash = createHash('sha256')
      .update(`sales-lead:${tenantId}:${idempotencyKey}`)
      .digest('hex');
    const bytes = hash.slice(0, 32).split('');
    bytes[12] = '5';
    bytes[16] = (8 + (parseInt(bytes[16], 16) & 0x03)).toString(16);
    const value = bytes.join('');
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
  }

  private replayOrReject(existing: any, input: NormalizedSalesLeadInput) {
    if (
      existing.name === input.name &&
      existing.phone === input.phone &&
      (existing.email || null) === input.email &&
      (existing.notes || null) === input.notes
    ) {
      return existing;
    }

    throw new ConflictException('Idempotency-Key đã được dùng cho một dữ liệu lead khác');
  }

  private isUniqueConstraint(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
