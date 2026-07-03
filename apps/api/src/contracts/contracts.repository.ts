import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../shared/repositories/base.repository';
import { PrismaService } from '../prisma.service';
import { Contract } from '@prisma/client';

@Injectable()
export class ContractsRepository extends BaseRepository<Contract, 'contract'> {
  constructor(prisma: PrismaService) {
    super(prisma, 'contract');
  }
}
