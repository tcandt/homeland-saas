import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FinanceLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccountBalance(tenantId: string, accountId: string) {
    const debits = await this.prisma.journalLine.aggregate({
      where: { tenantId, accountId, type: 'DEBIT' },
      _sum: { amount: true }
    });
    
    const credits = await this.prisma.journalLine.aggregate({
      where: { tenantId, accountId, type: 'CREDIT' },
      _sum: { amount: true }
    });

    const account = await this.prisma.chartOfAccount.findUnique({ where: { id: accountId } });
    
    let balance = 0;
    if (account?.type === 'ASSET' || account?.type === 'EXPENSE') {
      balance = Number(debits._sum.amount || 0) - Number(credits._sum.amount || 0);
    } else {
      balance = Number(credits._sum.amount || 0) - Number(debits._sum.amount || 0);
    }

    return balance;
  }
}
