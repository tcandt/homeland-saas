import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ExportModule } from './export/export.module';

@Module({
  imports: [ExportModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
