import { Module } from '@nestjs/common';
import { MonthlySettlementController } from './monthly-settlement.controller';
import { MonthlySettlementService } from './monthly-settlement.service';
import { MonthlySettlementScheduler } from './monthly-settlement.scheduler';
import { PaymentsModule } from '../payments/payments.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { CommunicationModule } from '../communication/communication.module';
import { HunonicModule } from '../hunonic/hunonic.module';
import { AuditModule } from '../shared/audit/audit.module';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [
    PrismaModule,
    PaymentsModule,
    InvoicesModule,
    CommunicationModule,
    HunonicModule,
    AuditModule,
  ],
  controllers: [MonthlySettlementController],
  providers: [MonthlySettlementService, MonthlySettlementScheduler],
  exports: [MonthlySettlementService],
})
export class MonthlySettlementModule {}
