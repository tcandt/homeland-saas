import { Module } from '@nestjs/common';
import { SalesCreateController } from './sales-create.controller';
import { SalesCreateService } from './sales-create.service';
import { SalesController } from './sales.controller';
import { SalesStageService } from './sales-stage.service';
import { SalesService } from './sales.service';

@Module({
  controllers: [SalesController, SalesCreateController],
  providers: [SalesService, SalesCreateService, SalesStageService],
  exports: [SalesService],
})
export class SalesModule {}
