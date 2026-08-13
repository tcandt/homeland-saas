import { Module } from '@nestjs/common';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { DepositsRepository } from './deposits.repository';

import { AuditService } from '../shared/audit/audit.service';

@Module({
  controllers: [DepositsController],
  providers: [DepositsService, DepositsRepository, AuditService],
  exports: [DepositsService],
})
export class DepositsModule {}
