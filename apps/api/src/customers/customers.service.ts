import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { ContractStatus, Customer } from '@prisma/client';
import { CustomersRepository } from './customers.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PrismaService } from '../prisma.service';
import { PaginatedResult } from '@homeland/shared';
import { ACTIVE_LIKE_CONTRACT_STATUSES } from '../contracts/contracts.adapter';
import { shouldRunGeneralSchedulers } from '../shared/config/runtime-mode';

function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/[\s.()-]/g, '').trim();
}

function normalizeIdentityNo(identityNo?: string | null): string {
  if (!identityNo) return '';
  return identityNo.replace(/[\s.-]/g, '').trim();
}

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
   * Kiểm tra trùng lặp Số điện thoại và Số CCCD/CMND khi lưu thông tin khách thuê
   */
  async validateCustomerUniqueness(phone?: string | null, identityNo?: string | null, excludeId?: string): Promise<void> {
    const cleanPhone = normalizePhone(phone);
    const cleanIdentityNo = normalizeIdentityNo(identityNo);

    if (cleanPhone) {
      const existingByPhone = await this.prisma.customer.findFirst({
        where: {
          deletedAt: null,
          phone: { equals: cleanPhone, mode: 'insensitive' },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });

      if (existingByPhone) {
        throw new BadRequestException(
          `Số điện thoại "${phone}" đã được đăng ký cho khách thuê "${existingByPhone.fullName}"${
            existingByPhone.identityNo ? ` (CCCD: ${existingByPhone.identityNo})` : ''
          }. Vui lòng kiểm tra lại!`
        );
      }
    }

    if (cleanIdentityNo) {
      const existingByIdentity = await this.prisma.customer.findFirst({
        where: {
          deletedAt: null,
          identityNo: { equals: cleanIdentityNo, mode: 'insensitive' },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });

      if (existingByIdentity) {
        throw new BadRequestException(
          `Số CCCD/CMND "${identityNo}" đã được đăng ký cho khách thuê "${existingByIdentity.fullName}"${
            existingByIdentity.phone ? ` (SĐT: ${existingByIdentity.phone})` : ''
          }. Vui lòng kiểm tra lại!`
        );
      }
    }
  }

  override async create(data: any, userId?: string, moduleName?: string): Promise<Customer> {
    await this.validateCustomerUniqueness(data.phone, data.identityNo);
    return super.create(data, userId, moduleName);
  }

  override async update(id: string, data: any, userId?: string, moduleName?: string): Promise<Customer> {
    if (data.phone !== undefined || data.identityNo !== undefined) {
      await this.validateCustomerUniqueness(data.phone, data.identityNo, id);
    }
    return super.update(id, data, userId, moduleName);
  }

  override async softDelete(id: string, userId?: string, moduleName?: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        contracts: {
          where: {
            deletedAt: null,
            status: { notIn: [ContractStatus.TERMINATED, ContractStatus.CANCELLED, ContractStatus.EXPIRED] },
          },
          include: {
            room: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách thuê với ID ${id}`);
    }

    if (customer.contracts && customer.contracts.length > 0) {
      const contractDetails = customer.contracts
        .map((c) => `${c.code || c.id} (Phòng: ${c.room?.name || c.room?.code || 'N/A'}, Trạng thái: ${c.status})`)
        .join('; ');
      throw new BadRequestException(
        `Không thể xóa khách thuê "${customer.fullName}" vì vẫn còn hợp đồng chưa kết thúc [${contractDetails}]. Bạn phải chấm dứt hoặc thanh lý hợp đồng trước khi xóa khách thuê!`
      );
    }

    return super.softDelete(id, userId, moduleName);
  }

  /**
   * Tự động gộp / loại bỏ các khách hàng trùng lặp thông tin (SĐT hoặc CCCD)
   */
  async deduplicateCustomers(userId?: string): Promise<{
    mergedCount: number;
    removedDuplicateIds: string[];
    affectedPhones: string[];
  }> {
    try {
      const activeCustomers = await this.prisma.customer.findMany({
        where: { deletedAt: null },
        include: {
          contracts: { where: { deletedAt: null } },
          invoices: { where: { deletedAt: null } },
          deposits: { where: { deletedAt: null } },
        },
        orderBy: { createdAt: 'asc' },
      });

      const phoneMap = new Map<string, typeof activeCustomers>();
      const identityMap = new Map<string, typeof activeCustomers>();

      for (const c of activeCustomers) {
        const p = normalizePhone(c.phone);
        if (p) {
          if (!phoneMap.has(p)) phoneMap.set(p, []);
          phoneMap.get(p)!.push(c);
        }
        const idNo = normalizeIdentityNo(c.identityNo);
        if (idNo) {
          if (!identityMap.has(idNo)) identityMap.set(idNo, []);
          identityMap.get(idNo)!.push(c);
        }
      }

      const removedIds = new Set<string>();
      const affectedPhones: string[] = [];
      let mergedCount = 0;

      // Xử lý trùng theo SĐT
      for (const [phone, group] of phoneMap.entries()) {
        const available = group.filter((c) => !removedIds.has(c.id));
        if (available.length <= 1) continue;

        // Chấm điểm chọn khách hàng chính (ưu tiên hợp đồng hiệu lực > tổng số HĐ > hóa đơn > thông tin đầy đủ)
        const scored = available.map((c) => {
          let score = 0;
          const hasActive = c.contracts.some((k: any) =>
            ACTIVE_LIKE_CONTRACT_STATUSES.includes(k.status as any),
          );
          if (hasActive) score += 1000;
          score += c.contracts.length * 100;
          score += c.invoices.length * 10;
          score += c.deposits.length * 10;
          if (c.identityNo) score += 50;
          if (c.email) score += 20;
          if (c.address) score += 10;
          if (c.fullName && c.fullName.trim().length > 3) score += 10;
          return { customer: c, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const primary = scored[0].customer;
        const duplicates = scored.slice(1).map((s) => s.customer);

        for (const dup of duplicates) {
          await this.prisma.contract.updateMany({
            where: { customerId: dup.id },
            data: { customerId: primary.id },
          });
          await this.prisma.invoice.updateMany({
            where: { customerId: dup.id },
            data: { customerId: primary.id },
          });
          await this.prisma.deposit.updateMany({
            where: { customerId: dup.id },
            data: { customerId: primary.id },
          });

          const updates: any = {};
          if (!primary.identityNo && dup.identityNo) updates.identityNo = dup.identityNo;
          if (!primary.email && dup.email) updates.email = dup.email;
          if (!primary.address && dup.address) updates.address = dup.address;
          if (!primary.roomId && dup.roomId) updates.roomId = dup.roomId;
          if (!primary.gender && dup.gender) updates.gender = dup.gender;
          if (!primary.birthDate && dup.birthDate) updates.birthDate = dup.birthDate;
          if (!primary.zaloChatId && dup.zaloChatId) updates.zaloChatId = dup.zaloChatId;
          if (!primary.zaloUserId && dup.zaloUserId) updates.zaloUserId = dup.zaloUserId;
          if (!primary.emergencyPhone && dup.emergencyPhone) updates.emergencyPhone = dup.emergencyPhone;

          if (Object.keys(updates).length > 0) {
            await this.prisma.customer.update({
              where: { id: primary.id },
              data: updates,
            });
          }

          await this.prisma.customer.update({
            where: { id: dup.id },
            data: {
              deletedAt: new Date(),
              deletedBy: userId || 'SYSTEM_DEDUPLICATION',
              deleteReason: `Đã tự động gộp vào khách hàng chính: ${primary.fullName} (${primary.id}) do trùng SĐT ${phone}`,
            },
          });

          removedIds.add(dup.id);
          mergedCount++;
        }

        affectedPhones.push(phone);
      }

      // Xử lý trùng theo CCCD
      for (const [idNo, group] of identityMap.entries()) {
        const available = group.filter((c) => !removedIds.has(c.id));
        if (available.length <= 1) continue;

        const scored = available.map((c) => {
          let score = 0;
          const hasActive = c.contracts.some((k: any) =>
            ACTIVE_LIKE_CONTRACT_STATUSES.includes(k.status as any),
          );
          if (hasActive) score += 1000;
          score += c.contracts.length * 100;
          score += c.invoices.length * 10;
          score += c.deposits.length * 10;
          if (c.phone) score += 50;
          if (c.email) score += 20;
          return { customer: c, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const primary = scored[0].customer;
        const duplicates = scored.slice(1).map((s) => s.customer);

        for (const dup of duplicates) {
          await this.prisma.contract.updateMany({
            where: { customerId: dup.id },
            data: { customerId: primary.id },
          });
          await this.prisma.invoice.updateMany({
            where: { customerId: dup.id },
            data: { customerId: primary.id },
          });
          await this.prisma.deposit.updateMany({
            where: { customerId: dup.id },
            data: { customerId: primary.id },
          });

          await this.prisma.customer.update({
            where: { id: dup.id },
            data: {
              deletedAt: new Date(),
              deletedBy: userId || 'SYSTEM_DEDUPLICATION',
              deleteReason: `Đã tự động gộp vào khách hàng chính: ${primary.fullName} (${primary.id}) do trùng CCCD ${idNo}`,
            },
          });

          removedIds.add(dup.id);
          mergedCount++;
        }
      }

      if (mergedCount > 0) {
        this.logger.log(`[Deduplication] Đã gộp và loại bỏ ${mergedCount} khách hàng trùng lặp.`);
      }

      return {
        mergedCount,
        removedDuplicateIds: Array.from(removedIds),
        affectedPhones,
      };
    } catch (error: any) {
      this.logger.error(`[Deduplication] Lỗi khi gộp dữ liệu khách trùng lặp: ${error?.message}`);
      return {
        mergedCount: 0,
        removedDuplicateIds: [],
        affectedPhones: [],
      };
    }
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
