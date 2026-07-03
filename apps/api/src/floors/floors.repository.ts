import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../shared/repositories/base.repository';
import { PrismaService } from '../prisma.service';
import { Floor } from '@prisma/client';

@Injectable()
export class FloorsRepository extends BaseRepository<Floor, 'floor'> {
  constructor(prisma: PrismaService) {
    super(prisma, 'floor');
  }
}
