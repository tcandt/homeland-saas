import { Module } from '@nestjs/common';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { DepositsRepository } from './deposits.repository';

import { PrismaService } from '../prisma.service';
import { AuditService } from '../shared/audit/audit.service';

@Module({
  controllers: [DepositsController],
  providers: [DepositsService, DepositsRepository, PrismaService, AuditService],
  exports: [DepositsService],
})
export class DepositsModule {}
