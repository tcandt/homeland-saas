import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Customer } from '@prisma/client';
import { CustomersRepository } from './customers.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PrismaService } from '../prisma.service';
import { PaginatedResult } from '@homeland/shared';
import { ACTIVE_LIKE_CONTRACT_STATUSES } from '../contracts/contracts.adapter';
import { shouldRunGeneralSchedulers } from '../shared/config/runtime-mode';

@Injectable()
export class CustomersService extends BaseCrudService<Customer> {
  private readonly logger = new Logger(CustomersService.name);
  private lastAutoCleanupAt: number = 0;

  constructor(
    repository: CustomersRepository,
    auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {
    super(repository, auditService, 'Customer');
  }

  /**
   * Cron job tự động dọn dẹp mỗi ngày lúc 2:00 AM
   * Tự động xóa (soft-delete) các khách hàng đã hết hạn hợp đồng / không thuê / không gia hạn quá 30 ngày
   */
  @Cron('0 2 * * *')
  async handleDailyAutoCleanupCron() {
    if (!shouldRunGeneralSchedulers()) return { skipped: true };
    return this.cleanupExpiredAndInactiveCustomers(30);
  }

  /**
   * Xóa tự động các khách hàng không còn hoạt động quá số ngày quy định (mặc định 30 ngày)
   */
  async cleanupExpiredAndInactiveCustomers(daysThreshold: number = 30): Promise<{
    deletedCount: number;
    deletedCustomerIds: string[];
    executedAt: Date;
  }> {
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - daysThreshold * 24 * 60 * 60 * 1000);

    try {
      // Lấy danh sách khách hàng chưa bị xóa và không đang ở ghép trong phòng nào
      const candidates = await this.prisma.customer.findMany({
        where: {
          deletedAt: null,
          roomId: null,
        },
        select: {
          id: true,
          fullName: true,
          createdAt: true,
          contracts: {
            where: {
              deletedAt: null,
            },
            select: {
              id: true,
              status: true,
              endDate: true,
            },
          },
          invoices: {
            where: {
              deletedAt: null,
              status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] as any },
            },
            select: {
              id: true,
            },
          },
        },
      });

      const toDeleteIds: string[] = [];

      for (const customer of candidates) {
        // Nếu khách hàng còn công nợ/hóa đơn chưa thanh toán, giữ lại để theo dõi công nợ
        if (customer.invoices && customer.invoices.length > 0) {
          continue;
        }

        // Nếu khách hàng có hợp đồng đang có hiệu lực / chờ duyệt / nháp -> không xóa
        const hasActiveContract = customer.contracts.some((c) =>
          ACTIVE_LIKE_CONTRACT_STATUSES.includes(c.status as any),
        );
        if (hasActiveContract) {
          continue;
        }

        if (customer.contracts.length === 0) {
          // Trường hợp 1: Khách vãng lai / không thuê / chưa từng có hợp đồng, tạo trước thresholdDate (quá 30 ngày)
          if (customer.createdAt && new Date(customer.createdAt) <= thresholdDate) {
            toDeleteIds.push(customer.id);
          }
        } else {
          // Trường hợp 2: Khách đã hết hợp đồng / không gia hạn / đã thanh lý
          // Tất cả hợp đồng đã hết hạn hoặc kết thúc và ngày kết thúc gần nhất quá 30 ngày
          const latestEndDate = customer.contracts.reduce((latest, c) => {
            const end = new Date(c.endDate).getTime();
            return end > latest ? end : latest;
          }, 0);

          if (latestEndDate > 0 && new Date(latestEndDate) <= thresholdDate) {
            toDeleteIds.push(customer.id);
          }
        }
      }

      if (toDeleteIds.length > 0) {
        await this.prisma.customer.updateMany({
          where: {
            id: { in: toDeleteIds },
          },
          data: {
            deletedAt: now,
            deletedBy: 'SYSTEM_AUTO_CLEANUP',
            deleteReason: `Tự động xóa sau ${daysThreshold} ngày hết hợp đồng / không thuê / không gia hạn`,
          },
        });

        this.logger.log(
          `[AutoCleanup] Đã tự động xóa ${toDeleteIds.length} khách hàng không thuê / hết hợp đồng quá ${daysThreshold} ngày.`,
        );
      }

      this.lastAutoCleanupAt = Date.now();

      return {
        deletedCount: toDeleteIds.length,
        deletedCustomerIds: toDeleteIds,
        executedAt: now,
      };
    } catch (error: any) {
      this.logger.error(`[AutoCleanup] Lỗi dọn dẹp tự động khách hàng: ${error?.message}`);
      return {
        deletedCount: 0,
        deletedCustomerIds: [],
        executedAt: now,
      };
    }
  }

  async listCustomers(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    sort?: string,
    order?: string
  ): Promise<PaginatedResult<Customer>> {
    // Tự động kiểm tra dọn dẹp mỗi 1 giờ khi có truy vấn
    if (Date.now() - this.lastAutoCleanupAt > 3600 * 1000) {
      this.cleanupExpiredAndInactiveCustomers(30).catch(() => {});
    }

    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { zaloChatId: { contains: search, mode: 'insensitive' } },
        { zaloUserId: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      // Map status enum to Contract relation queries
      if (status === 'ACTIVE' || status === 'Đang thuê') {
        where.contracts = { some: { status: { in: ACTIVE_LIKE_CONTRACT_STATUSES } } };
      } else if (status === 'INACTIVE' || status === 'Đã trả phòng') {
        where.contracts = { none: { status: { in: ACTIVE_LIKE_CONTRACT_STATUSES } } };
      } else if (status === 'DEBT' || status === 'Đang nợ') {
        where.invoices = { some: { status: 'OVERDUE' } };
      }
    }

    const orderBy = { [sort || 'createdAt']: order || 'desc' };

    return this.repository.paginate(where, page, limit, orderBy, {
      _count: { select: { contracts: true } }
    });
  }
}
