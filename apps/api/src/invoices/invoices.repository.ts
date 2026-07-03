import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../shared/repositories/base.repository';
import { PrismaService } from '../prisma.service';
import { Invoice } from '@prisma/client';

@Injectable()
export class InvoicesRepository extends BaseRepository<Invoice, 'invoice'> {
  constructor(prisma: PrismaService) {
    super(prisma, 'invoice');
  }
}
