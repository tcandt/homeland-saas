import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SystemUpdateService } from './system-update.service';
import { shouldRunGeneralSchedulers } from '../shared/config/runtime-mode';

@Injectable()
export class SystemUpdateScheduler {
  private readonly logger = new Logger(SystemUpdateScheduler.name);

  constructor(private readonly systemUpdateService: SystemUpdateService) {}

  // Kiểm tra phiên bản mới từ GitHub định kỳ mỗi 60 giây / lần
  @Cron(CronExpression.EVERY_MINUTE)
  async handlePeriodicUpdateCheck() {
    if (!shouldRunGeneralSchedulers()) return;
    try {
      const updateInfo = this.systemUpdateService.checkForUpdates();
      if (updateInfo.updateAvailable) {
        this.logger.warn(
          `[SystemUpdateScheduler] Phát hiện phiên bản mới khả dụng: ${updateInfo.latestVersion} (hiện tại: ${updateInfo.currentVersion})`,
        );
      }
    } catch (err: any) {
      this.logger.debug(`[SystemUpdateScheduler] Lỗi kiểm tra cập nhật định kỳ: ${err?.message}`);
    }
  }
}
