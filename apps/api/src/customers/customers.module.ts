import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomersRepository } from './customers.repository';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, CustomersRepository, PrismaService],
})
export class CustomersModule {}
