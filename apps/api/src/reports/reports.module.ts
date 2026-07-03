import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ExportModule } from './export/export.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [ExportModule],
  controllers: [ReportsController],
  providers: [ReportsService, PrismaService],
})
export class ReportsModule {}
