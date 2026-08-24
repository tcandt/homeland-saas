import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsService } from './metrics.service';
import { shouldRunGeneralSchedulers } from '../shared/config/runtime-mode';

@Injectable()
export class MetricsSchedulerService {
  constructor(private readonly metricsService: MetricsService) {}

  // Refresh business metrics every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleMetricsRefresh() {
    if (!shouldRunGeneralSchedulers()) return;
    await this.metricsService.refreshBusinessMetrics();
  }
}
