import { Module } from '@nestjs/common';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { DepositsRepository } from './deposits.repository';
import { DepositCoreService } from './deposit-core.service';
import { DepositOutboxPublisher } from './deposit-outbox.publisher';
import { DepositHoldScheduler } from './deposit-hold.scheduler';

import { AuditService } from '../shared/audit/audit.service';

@Module({
  controllers: [DepositsController],
  providers: [DepositsService, DepositCoreService, DepositOutboxPublisher, DepositHoldScheduler, DepositsRepository, AuditService],
  exports: [DepositsService, DepositCoreService, DepositOutboxPublisher],
})
export class DepositsModule {}
