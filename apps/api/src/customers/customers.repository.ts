import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../shared/repositories/base.repository';
import { PrismaService } from '../prisma.service';
import { Customer } from '@prisma/client';

@Injectable()
export class CustomersRepository extends BaseRepository<Customer, 'customer'> {
  constructor(prisma: PrismaService) {
    super(prisma, 'customer');
  }
}
