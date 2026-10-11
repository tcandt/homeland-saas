import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { shouldRunGeneralSchedulers } from '../shared/config/runtime-mode';
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
   * 1. USAGE CUTOFF & METER LOCK: Tự động chốt và khóa chỉ số công tơ điện vào ngày cuối cùng của tháng lúc 23:59:59 (GMT+7)
   */
  @Cron('59 59 23 28-31 * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleAutoMonthEndClosing() {
    if (!shouldRunGeneralSchedulers()) return;
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
          // Chốt tiền và lập hóa đơn kỳ kế tiếp sau khi khóa chỉ số. Việc gửi
          // thông báo được giữ riêng cho job ngày 01 để khách chỉ nhận một lần.
          const adminUser = await this.prisma.user.findFirst({
            where: { tenantId: tenant.id },
            select: { id: true },
          });
          const closeResult = await this.settlementService.closeMonth(
            tenant.id,
            adminUser?.id || 'system-scheduler',
            {
              period: result.billingPeriod,
              autoSend: false,
            },
          );
          this.logger.log(
            `Finalized month-end settlement for tenant ${tenant.name} (${tenant.id}) - Usage Period ${result.usagePeriod}, Billing Period ${result.billingPeriod}: ${result.lockedCount} room periods locked, ${closeResult.settledCount} invoices prepared.`,
          );
        }
      } catch (err: any) {
        this.logger.error(`Failed auto month-end usage cutoff for tenant ${tenant.id}: ${err?.message}`);
      }
    }
  }

  /**
   * 2. PAYMENT DISPATCH: Gửi thông báo thu tiền cho hóa đơn đã chốt lúc 08:00
   * sáng ngày 01 hàng tháng (GMT+7). Nếu job cuối tháng bị gián đoạn, sendNotifications
   * sẽ dùng closeMonth idempotent để hoàn tất phần còn thiếu trước khi gửi.
   */
  @Cron('0 8 1 * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleAutoSendMonthlyPaymentNotifications() {
    if (!shouldRunGeneralSchedulers()) return;
    this.logger.log('Triggering scheduled monthly payment notification dispatch at 08:00 AM on the 1st (GMT+7)...');

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

        if (settings.autoSendNotification !== false) {
          const result = await this.settlementService.sendNotifications(tenant.id, userId, {
            period: billingPeriod,
            dedupe: true,
          });

          this.logger.log(
            `Auto payment notifications dispatched for tenant ${tenant.name} (${tenant.id}) - Billing Period ${billingPeriod}: ${result.totalRequested} requested, ${result.sentCount} sent, ${result.failedCount} failed.`,
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
    if (!shouldRunGeneralSchedulers()) return;
    const vnNow = getVietnamDate();
    this.logger.debug(
      `MonthlySettlementScheduler Heartbeat: Current VN Time is ${vnNow.toISOString()} (Hour: ${vnNow.getHours()}, Day: ${vnNow.getDate()})`,
    );
  }
}
