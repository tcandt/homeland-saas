import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { DepositsModule } from '../deposits/deposits.module';
import { CommunicationModule } from '../communication/communication.module';
import { FinanceModule } from '../finance/finance.module';
import { AuditModule } from '../shared/audit/audit.module';

@Module({
  imports: [InvoicesModule, DepositsModule, CommunicationModule, FinanceModule, AuditModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PrismaService],
})
export class PaymentsModule {}
