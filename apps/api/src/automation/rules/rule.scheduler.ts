import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ContractStatus, InvoiceStatus, SettingScope } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { RuleEngine } from './rule.engine';
import { buildRoomContext } from '../../shared/context/room-context';
import { shouldRunGeneralSchedulers } from '../../shared/config/runtime-mode';
import {
  DEFAULT_REMINDER_DAYS,
  normalizeReminderDays,
  NotificationReminderDays,
} from './reminder-policy';

type LoadedReminderDays = {
  global: NotificationReminderDays;
  byTenant: Map<string, NotificationReminderDays>;
};

const PAYMENT_PROMISE_STATUS = {
  PENDING: 'PENDING',
  OVERDUE: 'OVERDUE',
  FULFILLED: 'FULFILLED',
} as const;

// Dates entered for invoices, contracts and payment promises are business
// dates. Keep scheduler windows stable when the worker host runs outside VN.
const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

@Injectable()
export class RuleScheduler {
  private readonly logger = new Logger(RuleScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: RuleEngine,
  ) {}

  @Cron('0 9 * * *', { timeZone: BUSINESS_TIME_ZONE })
  async runInvoiceDueSoon3DaysRule() {
    if (!shouldRunGeneralSchedulers()) return { checked: 0, checkedAt: new Date(), skipped: true };
    const reminderDays = await this.loadReminderDays();
    const now = new Date();
    const startOfToday = this.businessDayStart(now);
    const endOfThirdDay = this.businessDayEnd(startOfToday, reminderDays.global.invoiceDueSoonDays);
    const dayKey = this.businessDayKey(now);

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
          thresholdDays: tenantReminderDays.invoiceDueSoonDays,
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

  @Cron('0 9 * * *', { timeZone: BUSINESS_TIME_ZONE })
  async runInvoiceOverdue7DaysRule() {
    if (!shouldRunGeneralSchedulers()) return { checked: 0, checkedAt: new Date(), skipped: true };
    const reminderDays = await this.loadReminderDays();
    const now = new Date();
    const startOfToday = this.businessDayStart(now);
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() - reminderDays.global.invoiceOverdueDays);
    const dayKey = this.businessDayKey(now);

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
          thresholdDays: tenantReminderDays.invoiceOverdueDays,
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

  @Cron('5 9 * * *', { timeZone: BUSINESS_TIME_ZONE })
  async runContractExpiring30DaysRule() {
    if (!shouldRunGeneralSchedulers()) return { checked: 0, checkedAt: new Date(), skipped: true };
    const reminderDays = await this.loadReminderDays();
    const now = new Date();
    const startOfToday = this.businessDayStart(now);
    const endOfWindow = this.businessDayEnd(startOfToday, reminderDays.global.contractExpiringDays);
    const dayKey = this.businessDayKey(now);

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
          thresholdDays: tenantReminderDays.contractExpiringDays,
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

  /** A promise is a reminder only. It never settles the invoice automatically. */
  @Cron('10 9 * * *', { timeZone: BUSINESS_TIME_ZONE })
  async runPaymentPromiseDueRule() {
    if (!shouldRunGeneralSchedulers()) return { checked: 0, checkedAt: new Date(), skipped: true };
    const now = new Date();
    const startOfToday = this.businessDayStart(now);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);
    const paymentPromiseModel = (this.prisma as any).paymentPromise;
    if (!paymentPromiseModel?.findMany) {
      this.logger.error('PaymentPromise model unavailable; migrate and regenerate Prisma client before enabling P36 scheduler.');
      return { checked: 0, checkedAt: now, skipped: true, reason: 'PAYMENT_PROMISE_MODEL_UNAVAILABLE' };
    }
    const promises = await paymentPromiseModel.findMany({
      where: {
        status: PAYMENT_PROMISE_STATUS.PENDING,
        // A promise is date-based in the UI. Include the whole local due day;
        // comparing only to 00:00 caused a customer promise for today to be
        // skipped until the following scheduler run.
        dueDate: { lt: startOfTomorrow },
        invoice: {
          deletedAt: null,
          status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
        },
      },
      include: {
        invoice: {
          include: {
            customer: { select: { fullName: true, phone: true, zaloChatId: true, zaloUserId: true } },
            contract: { select: { room: { select: { id: true, code: true, rentalType: true, building: { select: { id: true, name: true } } } } } },
          },
        },
      },
    });
    let due = 0;
    for (const promise of promises) {
      const claimed = await paymentPromiseModel.updateMany({
        where: { id: promise.id, tenantId: promise.tenantId, status: PAYMENT_PROMISE_STATUS.PENDING },
        data: { status: PAYMENT_PROMISE_STATUS.OVERDUE },
      });
      if (claimed.count !== 1) continue;
      const invoice = promise.invoice;
      const remainingAmount = Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0) - Number(invoice.creditAmount || 0));
      if (remainingAmount <= 0) {
        await paymentPromiseModel.update({
          where: { id: promise.id },
          data: { status: PAYMENT_PROMISE_STATUS.FULFILLED, resolvedAt: now },
        });
        continue;
      }
      try {
        await this.ruleEngine.executeRule('invoice.payment_promise_due', {
          tenantId: promise.tenantId,
          correlationId: `invoice.payment_promise_due:${promise.id}`,
          paymentPromiseId: promise.id,
          promiseDueDate: promise.dueDate,
          promiseStatus: PAYMENT_PROMISE_STATUS.OVERDUE,
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
          remainingAmount,
        });
        due += 1;
      } catch (error: any) {
        this.logger.error(`Failed to execute payment promise reminder for ${promise.id}: ${error?.message}`);
      }
    }
    return { checked: promises.length, due, checkedAt: now };
  }

  private async loadReminderDays(): Promise<LoadedReminderDays> {
    const records = await this.prisma.appSetting.findMany({
      where: {
        key: { in: ['notifications', 'contract-rules'] },
        scope: SettingScope.TENANT,
      },
      select: { tenantId: true, value: true },
    }).catch(() => []);
    const byTenant = new Map<string, NotificationReminderDays>();
    let global = { ...DEFAULT_REMINDER_DAYS };
    for (const record of records as any[]) {
      const raw = record?.value || {};
      const recordOverrides = {
        ...(raw.reminderDays || {}),
        ...(record?.key === 'contract-rules' && raw.renewalReminderDays !== undefined
          ? { contractExpiringDays: raw.renewalReminderDays }
          : {}),
      };
      const recordSettings = normalizeReminderDays(recordOverrides);
      const settings = record?.tenantId
        ? normalizeReminderDays({
            ...(byTenant.get(record.tenantId) || DEFAULT_REMINDER_DAYS),
            ...recordOverrides,
          })
        : recordSettings;
      if (record?.tenantId) byTenant.set(record.tenantId, settings);
      global = {
        invoiceDueSoonDays: Math.max(global.invoiceDueSoonDays, recordSettings.invoiceDueSoonDays),
        invoiceOverdueDays: Math.max(global.invoiceOverdueDays, recordSettings.invoiceOverdueDays),
        contractExpiringDays: Math.max(global.contractExpiringDays, recordSettings.contractExpiringDays),
      };
    }
    return { global, byTenant };
  }

  private daysUntil(value: Date, startOfToday: Date) {
    return Math.round((this.businessDayStart(value).getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
  }

  private daysOverdue(value: Date, startOfToday: Date) {
    return Math.round((startOfToday.getTime() - this.businessDayStart(value).getTime()) / (24 * 60 * 60 * 1000));
  }

  private businessDayStart(value: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: BUSINESS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
    // Vietnam has a fixed UTC+7 offset and no daylight-saving transition.
    return new Date(Date.UTC(part('year'), part('month') - 1, part('day')) - 7 * 60 * 60 * 1000);
  }

  private businessDayEnd(startOfDay: Date, daysFromToday: number) {
    const end = new Date(startOfDay);
    end.setUTCDate(end.getUTCDate() + daysFromToday + 1);
    end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
    return end;
  }

  private businessDayKey(value: Date) {
    const start = this.businessDayStart(value);
    return new Date(start.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
}
