import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesRepository, PrismaService],
})
export class InvoicesModule {}
