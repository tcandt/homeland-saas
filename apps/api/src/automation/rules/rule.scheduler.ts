import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ContractStatus, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { RuleEngine } from './rule.engine';
import { buildRoomContext } from '../../shared/context/room-context';
import { shouldRunGeneralSchedulers } from '../../shared/config/runtime-mode';

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
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfThirdDay = new Date(startOfToday);
    endOfThirdDay.setDate(endOfThirdDay.getDate() + 3);
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
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() - 7);
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
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWindow = new Date(startOfToday);
    endOfWindow.setDate(endOfWindow.getDate() + 30);
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
}
