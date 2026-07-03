import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsCacheService } from './analytics-cache.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsCacheService, PrismaService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
