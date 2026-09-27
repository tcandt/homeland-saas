import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractsRepository } from './contracts.repository';
import { HunonicModule } from '../hunonic/hunonic.module';
import { DepositsModule } from '../deposits/deposits.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [HunonicModule, DepositsModule, PaymentsModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractsRepository],
})
export class ContractsModule {}
