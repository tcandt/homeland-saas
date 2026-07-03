import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../shared/repositories/base.repository';
import { Deposit } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DepositsRepository extends BaseRepository<Deposit, 'deposit'> {
  constructor(prisma: PrismaService) {
    super(prisma, 'deposit');
  }
}
