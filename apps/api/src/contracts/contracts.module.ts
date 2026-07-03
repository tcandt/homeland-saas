import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractsRepository } from './contracts.repository';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ContractsController],
  providers: [ContractsService, ContractsRepository, PrismaService],
})
export class ContractsModule {}
