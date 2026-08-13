import { Module } from '@nestjs/common';
import { HunonicController } from './hunonic.controller';
import { HunonicService } from './hunonic.service';

@Module({
  controllers: [HunonicController],
  providers: [HunonicService],
  exports: [HunonicService],
})
export class HunonicModule {}
