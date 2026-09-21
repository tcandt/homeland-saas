import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ContractStatus, InvoiceStatus, SettingScope } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { RuleEngine } from './rule.engine';
import { buildRoomContext } from '../../shared/context/room-context';
import { shouldRunGeneralSchedulers } from '../../shared/config/runtime-mode';

type NotificationReminderDays = {
  invoiceDueSoonDays: number;
  invoiceOverdueDays: number;
  contractExpiringDays: number;
};

type LoadedReminderDays = {
  global: NotificationReminderDays;
  byTenant: Map<string, NotificationReminderDays>;
};

const DEFAULT_REMINDER_DAYS: NotificationReminderDays = {
  invoiceDueSoonDays: 3,
  invoiceOverdueDays: 7,
  contractExpiringDays: 30,
};

@Injectable()
export class RuleScheduler {
  private readonly logger = new Logger(RuleScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: RuleEngine,
  ) {}

  @Cron('0 9 * * *')
  async runInvoiceDueSoon3DaysRule() {
    if (!shouldRunGeneralSchedulers()) return { checked: 0, checkedAt: new Date(), skipped: true };
    const reminderDays = await this.loadReminderDays();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfThirdDay = new Date(startOfToday);
    endOfThirdDay.setDate(endOfThirdDay.getDate() + reminderDays.global.invoiceDueSoonDays);
    endOfThirdDay.setHours(23, 59, 59, 999);
    const dayKey = now.toISOString().slice(0, 10);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: {
          in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID],
        },
        dueDate: {
          gte: startOfToday,
          lte: endOfThirdDay,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            zaloChatId: true,
            zaloUserId: true,
          },
        },
        contract: {
          select: {
            id: true,
            memberCount: true,
            room: {
              select: {
                id: true,
                code: true,
                rentalType: true,
                building: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const invoice of invoices) {
      try {
        const tenantReminderDays = reminderDays.byTenant.get(invoice.tenantId) || DEFAULT_REMINDER_DAYS;
        if (this.daysUntil(invoice.dueDate, startOfToday) > tenantReminderDays.invoiceDueSoonDays) continue;
        await this.ruleEngine.executeRule('invoice.due_soon.3_days', {
          tenantId: invoice.tenantId,
          correlationId: `invoice.due_soon.3_days:${invoice.id}:${dayKey}`,
          invoiceId: invoice.id,
          invoiceCode: invoice.code,
          dueDate: invoice.dueDate,
          status: invoice.status,
          customerId: invoice.customerId,
          customerName: invoice.customer?.fullName,
          customerPhone: invoice.customer?.phone,
          customerZaloChatId: invoice.customer?.zaloChatId,
          customerZaloUserId: invoice.customer?.zaloUserId,
          ...buildRoomContext(invoice.contract?.room, invoice.contract),
          total: Number(invoice.total || 0),
          paidAmount: Number(invoice.paidAmount || 0),
          remainingAmount: Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0) - Number(invoice.creditAmount || 0)),
        });
      } catch (error: any) {
        this.logger.error(`Failed to execute due soon rule for invoice ${invoice.id}: ${error?.message}`);
      }
    }

    return {
      checked: invoices.length,
      checkedAt: now,
    };
  }

  @Cron('0 9 * * *')
  async runInvoiceOverdue7DaysRule() {
    if (!shouldRunGeneralSchedulers()) return { checked: 0, checkedAt: new Date(), skipped: true };
    const reminderDays = await this.loadReminderDays();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() - reminderDays.global.invoiceOverdueDays);
    const dayKey = now.toISOString().slice(0, 10);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: {
          in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE],
        },
        dueDate: {
          lte: threshold,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            zaloChatId: true,
            zaloUserId: true,
          },
        },
        contract: {
          select: {
            id: true,
            memberCount: true,
            room: {
              select: {
                id: true,
                code: true,
                rentalType: true,
                building: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const invoice of invoices) {
      try {
        const tenantReminderDays = reminderDays.byTenant.get(invoice.tenantId) || DEFAULT_REMINDER_DAYS;
        if (this.daysOverdue(invoice.dueDate, startOfToday) < tenantReminderDays.invoiceOverdueDays) continue;
        await this.ruleEngine.executeRule('invoice.overdue.7_days', {
          tenantId: invoice.tenantId,
          correlationId: `invoice.overdue.7_days:${invoice.id}:${dayKey}`,
          invoiceId: invoice.id,
          invoiceCode: invoice.code,
          dueDate: invoice.dueDate,
          status: invoice.status,
          customerId: invoice.customerId,
          customerName: invoice.customer?.fullName,
          customerPhone: invoice.customer?.phone,
          customerZaloChatId: invoice.customer?.zaloChatId,
          customerZaloUserId: invoice.customer?.zaloUserId,
          ...buildRoomContext(invoice.contract?.room, invoice.contract),
          total: Number(invoice.total || 0),
          paidAmount: Number(invoice.paidAmount || 0),
          remainingAmount: Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0) - Number(invoice.creditAmount || 0)),
        });
      } catch (error: any) {
        this.logger.error(`Failed to execute overdue rule for invoice ${invoice.id}: ${error?.message}`);
      }
    }

    return {
      checked: invoices.length,
      checkedAt: now,
    };
  }

  @Cron('5 9 * * *')
  async runContractExpiring30DaysRule() {
    if (!shouldRunGeneralSchedulers()) return { checked: 0, checkedAt: new Date(), skipped: true };
    const reminderDays = await this.loadReminderDays();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWindow = new Date(startOfToday);
    endOfWindow.setDate(endOfWindow.getDate() + reminderDays.global.contractExpiringDays);
    endOfWindow.setHours(23, 59, 59, 999);
    const dayKey = now.toISOString().slice(0, 10);

    const contracts = await this.prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: {
          in: [ContractStatus.ACTIVE, ContractStatus.EXPIRING],
        },
        endDate: {
          gte: startOfToday,
          lte: endOfWindow,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            zaloChatId: true,
            zaloUserId: true,
          },
        },
        room: {
          select: {
            id: true,
            code: true,
            rentalType: true,
            building: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    for (const contract of contracts) {
      try {
        const tenantReminderDays = reminderDays.byTenant.get(contract.tenantId) || DEFAULT_REMINDER_DAYS;
        if (this.daysUntil(contract.endDate, startOfToday) > tenantReminderDays.contractExpiringDays) continue;
        await this.ruleEngine.executeRule('contract.expiring.30_days', {
          tenantId: contract.tenantId,
          correlationId: `contract.expiring.30_days:${contract.id}:${dayKey}`,
          contractId: contract.id,
          contractCode: contract.code,
          endDate: contract.endDate,
          status: contract.status,
          customerId: contract.customerId,
          customerName: contract.customer?.fullName,
          customerPhone: contract.customer?.phone,
          customerZaloChatId: contract.customer?.zaloChatId,
          customerZaloUserId: contract.customer?.zaloUserId,
          roomId: contract.roomId,
          roomCode: contract.room?.code,
          ...buildRoomContext(contract.room, contract),
          buildingId: contract.room?.building?.id,
          buildingName: contract.room?.building?.name,
        });
      } catch (error: any) {
        this.logger.error(`Failed to execute contract expiring rule for contract ${contract.id}: ${error?.message}`);
      }
    }

    return {
      checked: contracts.length,
      checkedAt: now,
    };
  }

  private async loadReminderDays(): Promise<LoadedReminderDays> {
    const records = await this.prisma.appSetting.findMany({
      where: {
        key: 'notifications',
        scope: SettingScope.TENANT,
      },
      select: { tenantId: true, value: true },
    }).catch(() => []);
    const byTenant = new Map<string, NotificationReminderDays>();
    let global = { ...DEFAULT_REMINDER_DAYS };
    for (const record of records as any[]) {
      const settings = this.normalizeReminderDays(record?.value?.reminderDays || {});
      if (record?.tenantId) byTenant.set(record.tenantId, settings);
      global = {
        invoiceDueSoonDays: Math.max(global.invoiceDueSoonDays, settings.invoiceDueSoonDays),
        invoiceOverdueDays: Math.max(global.invoiceOverdueDays, settings.invoiceOverdueDays),
        contractExpiringDays: Math.max(global.contractExpiringDays, settings.contractExpiringDays),
      };
    }
    return { global, byTenant };
  }

  private normalizeReminderDays(value: any): NotificationReminderDays {
    return {
      invoiceDueSoonDays: this.normalizeReminderDay(value.invoiceDueSoonDays, DEFAULT_REMINDER_DAYS.invoiceDueSoonDays, 0, 60),
      invoiceOverdueDays: this.normalizeReminderDay(value.invoiceOverdueDays, DEFAULT_REMINDER_DAYS.invoiceOverdueDays, 0, 365),
      contractExpiringDays: this.normalizeReminderDay(value.contractExpiringDays, DEFAULT_REMINDER_DAYS.contractExpiringDays, 0, 365),
    };
  }

  private normalizeReminderDay(value: unknown, fallback: number, min: number, max: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(numeric)));
  }

  private daysUntil(value: Date, startOfToday: Date) {
    return Math.ceil((new Date(value).getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
  }

  private daysOverdue(value: Date, startOfToday: Date) {
    return Math.floor((startOfToday.getTime() - new Date(value).getTime()) / (24 * 60 * 60 * 1000));
  }
}
