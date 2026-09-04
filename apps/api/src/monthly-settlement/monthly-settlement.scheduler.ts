import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import {
  MonthlySettlementService,
  formatVietnamPeriod,
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
   * 1. USAGE CUTOFF & METER LOCK: Tự động chốt và khóa chỉ số công tơ điện vào ngày cuối cùng của tháng lúc 23:50 (GMT+7)
   */
  @Cron('50 23 28-31 * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleAutoMonthEndClosing() {
    this.logger.log('Checking month-end usage cutoff trigger (GMT+7)...');
    if (!isLastDayOfVietnamMonth()) {
      this.logger.log('Today is not the last day of the month in Vietnam timezone. Skipping.');
      return;
    }

    const usagePeriod = formatVietnamPeriod();
    this.logger.log(`Executing auto month-end meter cutoff & snapshot for usage period ${usagePeriod}...`);

    const tenants = await this.prisma.tenantOrg.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    for (const tenant of tenants) {
      try {
        const settings = await this.settlementService.getSettings(tenant.id);
        if (settings.autoCloseEnabled !== false) {
          const result = await this.settlementService.finalizeUsagePeriod(tenant.id, {
            period: usagePeriod,
          });
          this.logger.log(
            `Finalized meter usage cutoff for tenant ${tenant.name} (${tenant.id}) - Usage Period ${result.usagePeriod}: ${result.lockedCount} room periods locked.`,
          );
        }
      } catch (err: any) {
        this.logger.error(`Failed auto month-end usage cutoff for tenant ${tenant.id}: ${err?.message}`);
      }
    }
  }

  /**
   * 2. BILLING SETTLEMENT & PAYMENT DISPATCH: Tự động sinh hóa đơn kỳ mới & gửi Zalo lúc 08:00 SÁNG NGÀY 01 HÀNG THÁNG (GMT+7)
   */
  @Cron('0 8 1 * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleAutoSendMonthlyPaymentNotifications() {
    this.logger.log('Triggering scheduled monthly settlement & payment notification dispatch at 08:00 AM on the 1st (GMT+7)...');

    const billingPeriod = formatVietnamPeriod(); // Tháng M mới bắt đầu (vd: 10/2026)

    const tenants = await this.prisma.tenantOrg.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    for (const tenant of tenants) {
      try {
        const settings = await this.settlementService.getSettings(tenant.id);
        const adminUser = await this.prisma.user.findFirst({
          where: { tenantId: tenant.id },
          select: { id: true },
        });
        const userId = adminUser?.id || 'system-scheduler';

        if (settings.autoCloseEnabled !== false) {
          // Tạo hóa đơn tháng M (tiền phòng + nước tháng M, tiền điện + dịch vụ tháng M-1)
          const resClose = await this.settlementService.closeMonth(tenant.id, userId, {
            period: billingPeriod,
            autoSend: settings.autoSendNotification !== false,
          });

          this.logger.log(
            `Auto settlement executed for tenant ${tenant.name} (${tenant.id}) - Billing Period ${billingPeriod}: ${resClose.settledCount} rooms settled, ${resClose.sentCount} notifications sent.`,
          );
        }
      } catch (err: any) {
        this.logger.error(
          `Failed auto monthly billing execution for tenant ${tenant.id}: ${err?.message}`,
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
