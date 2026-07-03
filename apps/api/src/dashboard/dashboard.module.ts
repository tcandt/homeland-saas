import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { FinanceModule } from '../finance/finance.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [FinanceModule],
  controllers: [DashboardController],
  providers: [DashboardService, PrismaService],
})
export class DashboardModule {}
