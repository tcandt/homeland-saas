import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../shared/repositories/base.repository';
import { PrismaService } from '../prisma.service';
import { Room } from '@prisma/client';

@Injectable()
export class RoomsRepository extends BaseRepository<Room, 'room'> {
  constructor(prisma: PrismaService) {
    super(prisma, 'room');
  }
}
