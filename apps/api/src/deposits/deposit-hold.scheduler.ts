import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { shouldRunGeneralSchedulers } from '../shared/config/runtime-mode';
import { DepositCoreService } from './deposit-core.service';

const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

@Injectable()
export class DepositHoldScheduler {
  private readonly logger = new Logger(DepositHoldScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly depositCore: DepositCoreService,
  ) {}

  @Cron('*/5 * * * *', { timeZone: BUSINESS_TIME_ZONE })
  async expireDueHolds() {
    if (!shouldRunGeneralSchedulers()) return { checked: 0, expired: 0, skipped: true };
    const tenants = await this.prisma.tenantOrg.findMany({ where: { isActive: true }, select: { id: true } });
    let expired = 0;
    for (const tenant of tenants) {
      try {
        const result = await this.depositCore.expireHolds(tenant.id, new Date(), 'SYSTEM_HOLD_EXPIRY');
        expired += Number(result.expiredCount || 0);
      } catch (error: any) {
        this.logger.error(`Failed to expire room holds for tenant ${tenant.id}: ${error?.message || error}`);
      }
    }
    return { checked: tenants.length, expired, checkedAt: new Date() };
  }
}
