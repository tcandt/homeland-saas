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

    // 2. Create the entry
    return this.prisma.journalEntry.create({
      data: {
        tenantId,
        code: data.code,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        description: data.description,
        entryDate: data.entryDate || new Date(),
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
          }))
        }
      },
      include: {
        lines: true
      }
    });
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
