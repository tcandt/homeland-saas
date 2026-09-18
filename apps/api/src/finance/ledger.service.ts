import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { authoritativeJournalLineWhere } from './journal-effect.policy';

@Injectable()
export class FinanceLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccountBalance(tenantId: string, accountId: string) {
    const debits = await this.prisma.journalLine.aggregate({
      where: authoritativeJournalLineWhere(tenantId, { accountId, type: 'DEBIT' }),
      _sum: { amount: true }
    });
    
    const credits = await this.prisma.journalLine.aggregate({
      where: authoritativeJournalLineWhere(tenantId, { accountId, type: 'CREDIT' }),
      _sum: { amount: true }
    });

    const account = await this.prisma.chartOfAccount.findFirst({ where: { tenantId, id: accountId } });
    
    let balance = 0;
    if (account?.type === 'ASSET' || account?.type === 'EXPENSE') {
      balance = Number(debits._sum.amount || 0) - Number(credits._sum.amount || 0);
    } else {
      balance = Number(credits._sum.amount || 0) - Number(debits._sum.amount || 0);
    }

    return balance;
  }
}
