import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { shouldRunGeneralSchedulers } from '../shared/config/runtime-mode';

@Injectable()
export class ReportSchedulerService {
  private readonly logger = new Logger(ReportSchedulerService.name);

  // Example: Run on the 1st of every month at midnight
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async generateMonthlyPnL() {
    if (!shouldRunGeneralSchedulers()) return;
    this.logger.log('Scheduled monthly P&L report generated');
    // In the future: generate report, save to Document Center, send via NotificationService
  }

  // Example: Run every Monday at 8am
  @Cron('0 8 * * 1')
  async generateWeeklyCashflow() {
    if (!shouldRunGeneralSchedulers()) return;
    this.logger.log('Scheduled weekly Cashflow report generated');
    // In the future: generate report, save to Document Center, send via NotificationService
  }
}
