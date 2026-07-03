import { Module } from '@nestjs/common';
import { FloorsController } from './floors.controller';
import { FloorsService } from './floors.service';
import { FloorsRepository } from './floors.repository';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [FloorsController],
  providers: [FloorsService, FloorsRepository, PrismaService],
})
export class FloorsModule {}
