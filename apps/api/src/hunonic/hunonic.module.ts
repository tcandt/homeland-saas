import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { HunonicController } from './hunonic.controller';
import { HunonicService } from './hunonic.service';

@Module({
  controllers: [HunonicController],
  providers: [HunonicService, PrismaService],
  exports: [HunonicService],
})
export class HunonicModule {}
