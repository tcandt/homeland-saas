import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import {
  MonthlySettlementService,
  formatVietnamPeriod,
  getPreviousVietnamPeriod,
  isLastDayOfVietnamMonth,
  getVietnamDate,
} from './monthly-settlement.service';

@Injectable()
export class MonthlySettlementScheduler {
  private readonly logger = new Logger(MonthlySettlementScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlementService: MonthlySettlementService,
  ) {}

  /**
   * Tự động chốt số liệu vào ngày cuối cùng của tháng lúc 23:50 (Múi giờ GMT+7 Việt Nam)
   */
  @Cron('50 23 28-31 * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleAutoMonthEndClosing() {
    this.logger.log('Checking month-end closing scheduled trigger (GMT+7)...');
    if (!isLastDayOfVietnamMonth()) {
      this.logger.log('Today is not the last day of the month in Vietnam timezone. Skipping.');
      return;
    }

    const currentPeriod = formatVietnamPeriod();
    this.logger.log(`Executing auto month-end settlement for period ${currentPeriod}...`);

    const tenants = await this.prisma.tenantOrg.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    for (const tenant of tenants) {
      try {
        const settings = await this.settlementService.getSettings(tenant.id);
        if (settings.autoCloseEnabled !== false) {
          const adminUser = await this.prisma.user.findFirst({
            where: { tenantId: tenant.id },
            select: { id: true },
          });
          const userId = adminUser?.id || 'system-scheduler';

          const res = await this.settlementService.closeMonth(tenant.id, userId, {
            period: currentPeriod,
            autoSend: false, // Để dành gửi lúc 08:00 sáng ngày 01
          });
          this.logger.log(
            `Auto closed month for tenant ${tenant.name} (${tenant.id}): ${res.settledCount} rooms settled.`,
          );
        }
      } catch (err: any) {
        this.logger.error(`Failed auto month-end closing for tenant ${tenant.id}: ${err?.message}`);
      }
    }
  }

  /**
   * Tự động gửi thông báo thanh toán qua Zalo vào đúng 08:00 SÁNG NGÀY 01 HÀNG THÁNG (Múi giờ GMT+7 Việt Nam)
   */
  @Cron('0 8 1 * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleAutoSendMonthlyPaymentNotifications() {
    this.logger.log('Triggering scheduled monthly payment notification dispatch at 08:00 AM on the 1st (GMT+7)...');

    const nowPeriod = formatVietnamPeriod();
    const settledPeriod = getPreviousVietnamPeriod(nowPeriod); // Kỳ vừa kết thúc chốt hôm qua

    const tenants = await this.prisma.tenantOrg.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    for (const tenant of tenants) {
      try {
        const settings = await this.settlementService.getSettings(tenant.id);
        if (settings.autoSendNotification !== false) {
          const adminUser = await this.prisma.user.findFirst({
            where: { tenantId: tenant.id },
            select: { id: true },
          });
          const userId = adminUser?.id || 'system-scheduler';

          const res = await this.settlementService.sendNotifications(tenant.id, userId, {
            period: settledPeriod,
          });
          this.logger.log(
            `Auto sent payment notifications for tenant ${tenant.name} (${tenant.id}) - Period ${settledPeriod}: ${res.sentCount} sent, ${res.failedCount} failed.`,
          );
        }
      } catch (err: any) {
        this.logger.error(
          `Failed auto sending payment notifications for tenant ${tenant.id}: ${err?.message}`,
        );
      }
    }
  }

  /**
   * Heartbeat / Safe Check mỗi 30 phút để log trạng thái hoạt động theo GMT+7
   */
  @Cron('*/30 * * * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleHeartbeatCheck() {
    const vnNow = getVietnamDate();
    this.logger.debug(
      `MonthlySettlementScheduler Heartbeat: Current VN Time is ${vnNow.toISOString()} (Hour: ${vnNow.getHours()}, Day: ${vnNow.getDate()})`,
    );
  }
}
