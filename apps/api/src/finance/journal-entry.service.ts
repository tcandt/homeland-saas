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
}
