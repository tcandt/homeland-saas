import { Module } from '@nestjs/common';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';
import { BuildingsRepository } from './buildings.repository';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [BuildingsController],
  providers: [BuildingsService, BuildingsRepository, PrismaService],
})
export class BuildingsModule {}
