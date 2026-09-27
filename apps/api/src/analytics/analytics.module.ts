import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsCacheService } from './analytics-cache.service';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsCacheService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
