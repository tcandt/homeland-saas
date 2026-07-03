import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceReportingService } from './finance-reporting.service';
import { FinanceLedgerService } from './ledger.service';
import { JournalEntryService } from './journal-entry.service';
import { PrismaService } from '../prisma.service';
import { FinanceListener } from './finance.listener';

@Module({
  controllers: [FinanceController],
  providers: [FinanceReportingService, FinanceLedgerService, JournalEntryService, PrismaService, FinanceListener],
  exports: [FinanceReportingService, FinanceLedgerService, JournalEntryService],
})
export class FinanceModule {}
