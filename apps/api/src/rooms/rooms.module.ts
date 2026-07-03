import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomsRepository } from './rooms.repository';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService, RoomsRepository, PrismaService],
})
export class RoomsModule {}
