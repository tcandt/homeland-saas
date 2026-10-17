import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class JournalEntryService {
  constructor(private readonly prisma: PrismaService) {}

  async createJournalEntry(tenantId: string, data: {
    code: string;
    sourceType: any;
    sourceId: string;
    description?: string;
    entryDate?: Date;
    status?: any; // e.g., 'POSTED' | 'DRAFT'
    idempotent?: boolean;
    lines: { accountId: string; costCenterId?: string; type: any; amount: number; description?: string }[];
  }) {
    const status = data.status || 'POSTED';
    
    // 1. Validate balance for POSTED entries
    let totalDebit = 0;
    let totalCredit = 0;
    
    for (const line of data.lines) {
      if (line.type === 'DEBIT') totalDebit += line.amount;
      else if (line.type === 'CREDIT') totalCredit += line.amount;
    }

    if (status === 'POSTED' && totalDebit !== totalCredit) {
      throw new BadRequestException('FINANCE_JOURNAL_NOT_BALANCED');
    }

    // The nested write is atomic. Only explicitly opted-in callers may replay
    // a unique-code collision, and then only when the immutable financial
    // identity is exactly the same.
    const entryDate = data.entryDate || new Date();
    try {
      return await this.prisma.journalEntry.create({
        data: {
          tenantId,
          code: data.code,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          description: data.description,
          entryDate,
          status: status,
          postedAt: status === 'POSTED' ? new Date() : null,
          lines: {
            create: data.lines.map(line => ({
              tenantId,
              accountId: line.accountId,
              costCenterId: line.costCenterId,
              type: line.type,
              amount: line.amount,
              description: line.description,
            })),
          },
        },
        include: { lines: true },
      });
    } catch (error: any) {
      const journalCodeCollision = this.isJournalCodeUniqueViolation(error?.meta?.target);
      if (!data.idempotent || error?.code !== 'P2002' || !journalCodeCollision) throw error;
      const existing = await this.prisma.journalEntry.findFirst({
        where: { tenantId, code: data.code },
        include: { lines: true },
      });
      if (!existing || !this.isCanonicalReplay(existing, tenantId, data, status, entryDate)) {
        throw new BadRequestException('FINANCE_JOURNAL_IDEMPOTENCY_CONFLICT');
      }
      return existing;
    }
  }

  private isJournalCodeUniqueViolation(target: unknown) {
    if (Array.isArray(target)) {
      const fields = target.map((field) => String(field).toLowerCase()).sort();
      return fields.length === 2 && fields[0] === 'code' && fields[1] === 'tenantid';
    }
    const constraint = String(target || '').toLowerCase();
    return constraint === 'journalentry_tenantid_code_key' || constraint === 'journalentry_tenantid_code';
  }

  private isCanonicalReplay(existing: any, tenantId: string, data: any, status: string, entryDate: Date) {
    if (
      existing.tenantId !== tenantId ||
      existing.sourceType !== data.sourceType ||
      existing.sourceId !== data.sourceId ||
      existing.status !== status ||
      new Date(existing.entryDate).getTime() !== new Date(entryDate).getTime()
    ) return false;
    const canonicalLines = (lines: any[]) => lines
      .map((line) => ({
        accountId: String(line.accountId),
        costCenterId: line.costCenterId || null,
        type: String(line.type),
        amount: Number(line.amount),
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    return JSON.stringify(canonicalLines(existing.lines || [])) === JSON.stringify(canonicalLines(data.lines || []));
  }

  isExactReplay(existing: any, tenantId: string, data: any) {
    return this.isCanonicalReplay(
      existing,
      tenantId,
      data,
      data.status || 'POSTED',
      data.entryDate || new Date(),
    );
  }

  async reverseJournalEntry(tenantId: string, journalEntryId: string, userId?: string, reason?: string) {
    const original = await this.prisma.journalEntry.findFirst({
      where: { tenantId, id: journalEntryId },
      include: { lines: true },
    });

    if (!original) throw new BadRequestException('JOURNAL_ENTRY_NOT_FOUND');
    if (original.status !== 'POSTED' && original.status !== 'REVERSED') {
      throw new BadRequestException('ONLY_POSTED_JOURNAL_CAN_BE_REVERSED');
    }

    const existingReversal = await this.prisma.journalEntry.findFirst({
      where: {
        tenantId,
        sourceType: 'REVERSAL' as any,
        sourceId: original.id,
      },
      include: { lines: true },
    });

    if (existingReversal) return existingReversal;
    if (original.status === 'REVERSED') {
      throw new BadRequestException('JOURNAL_ENTRY_ALREADY_REVERSED');
    }

    const reversalCode = `REV-${original.code}`;
    return this.prisma.$transaction(async (tx) => {
      const reversal = await tx.journalEntry.create({
        data: {
          tenantId,
          code: reversalCode,
          sourceType: 'REVERSAL' as any,
          sourceId: original.id,
          description: reason || `Đảo bút toán ${original.code}`,
          entryDate: new Date(),
          status: 'POSTED',
          createdBy: userId || null,
          postedAt: new Date(),
          lines: {
            create: original.lines.map((line) => ({
              tenantId,
              accountId: line.accountId,
              costCenterId: line.costCenterId,
              type: line.type === 'DEBIT' ? 'CREDIT' : 'DEBIT',
              amount: line.amount,
              description: `Đảo: ${line.description || original.description || original.code}`,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.journalEntry.update({
        where: { id: original.id },
        data: {
          status: 'REVERSED',
          reversedAt: new Date(),
        },
      });

      return reversal;
    });
  }
}
