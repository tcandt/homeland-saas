import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../shared/repositories/base.repository';
import { PrismaService } from '../prisma.service';
import { Building } from '@prisma/client';

@Injectable()
export class BuildingsRepository extends BaseRepository<Building, 'building'> {
  constructor(prisma: PrismaService) {
    super(prisma, 'building');
  }
}
