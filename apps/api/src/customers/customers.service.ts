import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { AuditAction, ContractStatus, Customer, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { CustomersRepository } from './customers.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PrismaService } from '../prisma.service';
import { PaginatedResult } from '@homeland/shared';
import { ACTIVE_LIKE_CONTRACT_STATUSES } from '../contracts/contracts.adapter';
import { normalizeCustomerIdentityNo, normalizeCustomerPhone } from './customer-identifiers';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CustomersService extends BaseCrudService<Customer> {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    repository: CustomersRepository,
    auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {
    super(repository, auditService, 'Customer');
  }

  /**
   * Kiểm tra trùng lặp nhẹ (lightweight) phục vụ validate form realtime hoặc trước khi chuyển bước
   */
  async checkDuplicate(params: {
    phone?: string | null;
    identityNo?: string | null;
    excludeId?: string | null;
  }) {
    const cleanPhone = normalizeCustomerPhone(params.phone);
    const cleanIdentityNo = normalizeCustomerIdentityNo(params.identityNo);

    if (!cleanPhone && !cleanIdentityNo) {
      return { isDuplicate: false, duplicateField: null, duplicateCustomer: null, message: null };
    }

    if (cleanPhone) {
      const existingByPhone = await this.prisma.tx.customer.findFirst({
        where: {
          deletedAt: null,
          phoneNormalized: cleanPhone,
          ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
        },
        include: {
          room: {
            select: {
              id: true,
              code: true,
              name: true,
              building: { select: { id: true, code: true, name: true } },
            },
          },
          contracts: {
            where: {
              deletedAt: null,
              status: { notIn: [ContractStatus.TERMINATED, ContractStatus.CANCELLED, ContractStatus.EXPIRED] },
            },
            select: {
              id: true,
              code: true,
              status: true,
              room: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  building: { select: { id: true, code: true, name: true } },
                },
              },
            },
            take: 1,
          },
        },
      });

      if (existingByPhone) {
        const room = existingByPhone.contracts?.[0]?.room || existingByPhone.room;
        const roomText = room ? `${room.building ? `${room.building.name || room.building.code} - ` : ''}Phòng ${room.code || room.name}` : null;
        return {
          isDuplicate: true,
          duplicateField: 'phone',
          duplicateCustomer: {
            id: existingByPhone.id,
            fullName: existingByPhone.fullName,
            phone: existingByPhone.phone,
            identityNo: existingByPhone.identityNo,
            currentRoom: roomText,
          },
          message: `Số điện thoại "${params.phone}" đã được đăng ký cho khách thuê "${existingByPhone.fullName}"${roomText ? ` (${roomText})` : ''}.`,
        };
      }
    }

    if (cleanIdentityNo) {
      const existingByIdentity = await this.prisma.tx.customer.findFirst({
        where: {
          deletedAt: null,
          identityNoNormalized: cleanIdentityNo,
          ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
        },
        include: {
          room: {
            select: {
              id: true,
              code: true,
              name: true,
              building: { select: { id: true, code: true, name: true } },
            },
          },
          contracts: {
            where: {
              deletedAt: null,
              status: { notIn: [ContractStatus.TERMINATED, ContractStatus.CANCELLED, ContractStatus.EXPIRED] },
            },
            select: {
              id: true,
              code: true,
              status: true,
              room: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  building: { select: { id: true, code: true, name: true } },
                },
              },
            },
            take: 1,
          },
        },
      });

      if (existingByIdentity) {
        const room = existingByIdentity.contracts?.[0]?.room || existingByIdentity.room;
        const roomText = room ? `${room.building ? `${room.building.name || room.building.code} - ` : ''}Phòng ${room.code || room.name}` : null;
        return {
          isDuplicate: true,
          duplicateField: 'identityNo',
          duplicateCustomer: {
            id: existingByIdentity.id,
            fullName: existingByIdentity.fullName,
            phone: existingByIdentity.phone,
            identityNo: existingByIdentity.identityNo,
            currentRoom: roomText,
          },
          message: `Số CCCD/CMND "${params.identityNo}" đã được đăng ký cho khách thuê "${existingByIdentity.fullName}"${roomText ? ` (${roomText})` : ''}.`,
        };
      }
    }

    return { isDuplicate: false, duplicateField: null, duplicateCustomer: null, message: null };
  }

  /**
   * Kiểm tra trùng lặp Số điện thoại và Số CCCD/CMND khi lưu thông tin khách thuê
   */
  async validateCustomerUniqueness(phone?: string | null, identityNo?: string | null, excludeId?: string): Promise<void> {
    const cleanPhone = normalizeCustomerPhone(phone);
    const cleanIdentityNo = normalizeCustomerIdentityNo(identityNo);

    if (cleanPhone) {
      const existingByPhone = await this.prisma.tx.customer.findFirst({
        where: {
          deletedAt: null,
          phoneNormalized: cleanPhone,
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
      const existingByIdentity = await this.prisma.tx.customer.findFirst({
        where: {
          deletedAt: null,
          identityNoNormalized: cleanIdentityNo,
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
    const dataWithNormalizedIdentifiers = this.withNormalizedIdentifiers(data, { requirePhone: true });
    await this.validateCustomerUniqueness(dataWithNormalizedIdentifiers.phone, dataWithNormalizedIdentifiers.identityNo);
    const created = await super.create(dataWithNormalizedIdentifiers, userId, moduleName);
    await this.syncRoomOccupancy(created, null);
    return created;
  }

  async createIdempotent(tenantId: string, userId: string, data: any, idempotencyKey: string): Promise<Customer> {
    const key = this.requireIdempotencyKey(idempotencyKey);
    const dataWithNormalizedIdentifiers = this.withNormalizedIdentifiers(data, { requirePhone: true });
    const requestHash = this.createRequestHash(dataWithNormalizedIdentifiers);
    const customerId = this.deterministicId('customer', tenantId, key);
    const auditId = this.deterministicId('audit', tenantId, key);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await this.resolveCreateReplay(tx, auditId, tenantId, key, requestHash);
        if (replay) return replay;

        const roomId = await this.ensureRoomBelongsToTenant(tx, tenantId, dataWithNormalizedIdentifiers.roomId);
        await this.validateCreateUniqueness(
          tx,
          tenantId,
          dataWithNormalizedIdentifiers.phoneNormalized,
          dataWithNormalizedIdentifiers.identityNoNormalized,
        );

        const customer = await tx.customer.create({
          data: {
            ...dataWithNormalizedIdentifiers,
            id: customerId,
            tenantId,
            roomId,
          },
        });

        if (roomId) {
          await tx.occupancy.create({
            data: {
              tenantId,
              roomId,
              customerId: customer.id,
              role: 'ROOMMATE',
              joinedAt: new Date(),
            },
          });
        }

        await tx.auditLog.create({
          data: {
            id: auditId,
            tenantId,
            userId,
            module: 'Customers',
            entity: 'Customer',
            entityId: customer.id,
            action: AuditAction.CREATE,
            after: {
              idempotencyKey: key,
              requestHash,
              customerId: customer.id,
              fullName: customer.fullName,
              phone: customer.phone,
              roomId: customer.roomId,
            },
          },
        });

        return customer;
      });
    } catch (error) {
      if (!this.isUniqueConstraint(error)) throw error;

      const replay = await this.resolveCreateReplay(this.prisma, auditId, tenantId, key, requestHash);
      if (replay) return replay;
      throw error;
    }
  }

  override async update(id: string, data: any, userId?: string, moduleName?: string): Promise<Customer> {
    const before = data.roomId !== undefined ? await this.getDetail(id) : null;
    const dataWithNormalizedIdentifiers = this.withNormalizedIdentifiers(data);
    if (dataWithNormalizedIdentifiers.phone !== undefined || dataWithNormalizedIdentifiers.identityNo !== undefined) {
      await this.validateCustomerUniqueness(dataWithNormalizedIdentifiers.phone, dataWithNormalizedIdentifiers.identityNo, id);
    }
    const updated = await super.update(id, dataWithNormalizedIdentifiers, userId, moduleName);
    if (before && before.roomId !== updated.roomId) {
      await this.syncRoomOccupancy(updated, before.roomId);
    }
    return updated;
  }

  private async syncRoomOccupancy(customer: Customer, previousRoomId: string | null) {
    const occupancy = (this.prisma.tx as any).occupancy;
    if (!occupancy) return;

    const changedAt = new Date();
    if (previousRoomId && previousRoomId !== customer.roomId) {
      await occupancy.updateMany({
        where: {
          customerId: customer.id,
          roomId: previousRoomId,
          leftAt: null,
        },
        data: {
          leftAt: changedAt,
          leaveReason: customer.roomId ? 'Chuyển sang phòng khác' : 'Gỡ khỏi phòng',
        },
      });
    }

    if (!customer.roomId) return;
    const existing = await occupancy.findFirst({
      where: {
        customerId: customer.id,
        roomId: customer.roomId,
        leftAt: null,
      },
    });
    if (!existing) {
      await occupancy.create({
        data: {
          tenantId: customer.tenantId,
          roomId: customer.roomId,
          customerId: customer.id,
          role: 'ROOMMATE',
          joinedAt: changedAt,
        },
      });
    }
  }

  private async ensureRoomBelongsToTenant(tx: any, tenantId: string, value: unknown): Promise<string | null> {
    const roomId = String(value || '').trim();
    if (!roomId) return null;

    const room = await tx.room.findFirst({
      where: { id: roomId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng trong đơn vị hiện tại');
    return room.id;
  }

  private async validateCreateUniqueness(
    tx: any,
    tenantId: string,
    phoneNormalized: string,
    identityNoNormalized?: string | null,
  ) {
    const cleanPhone = phoneNormalized;
    if (cleanPhone) {
      const existingByPhone = await tx.customer.findFirst({
        where: { tenantId, deletedAt: null, phoneNormalized: cleanPhone },
      });
      if (existingByPhone) {
        throw new BadRequestException(`Số điện thoại đã được đăng ký cho khách thuê "${existingByPhone.fullName}"`);
      }
    }
    const cleanIdentityNo = identityNoNormalized || '';
    if (cleanIdentityNo) {
      const existingByIdentity = await tx.customer.findFirst({
        where: { tenantId, deletedAt: null, identityNoNormalized: cleanIdentityNo },
      });
      if (existingByIdentity) {
        throw new BadRequestException(`Số CCCD/CMND đã được đăng ký cho khách thuê "${existingByIdentity.fullName}"`);
      }
    }
  }

  private withNormalizedIdentifiers(data: any, options: { requirePhone?: boolean } = {}) {
    const normalized = { ...data };

    if (data.phone !== undefined || options.requirePhone) {
      const phoneNormalized = normalizeCustomerPhone(data.phone);
      if (!phoneNormalized) {
        throw new BadRequestException('Số điện thoại phải chứa ít nhất một chữ số');
      }
      normalized.phoneNormalized = phoneNormalized;
    }

    if (data.identityNo !== undefined) {
      normalized.identityNoNormalized = normalizeCustomerIdentityNo(data.identityNo) || null;
    }

    return normalized;
  }

  private async resolveCreateReplay(
    client: { auditLog: { findFirst: (args: any) => Promise<any> }; customer: { findFirst: (args: any) => Promise<any> } },
    auditId: string,
    tenantId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<Customer | null> {
    const audit = await client.auditLog.findFirst({ where: { id: auditId, tenantId } });
    if (!audit) return null;

    const after = audit.after as Record<string, unknown> | null;
    const matches = audit.tenantId === tenantId
      && audit.module === 'Customers'
      && audit.entity === 'Customer'
      && audit.action === AuditAction.CREATE
      && after?.idempotencyKey === idempotencyKey
      && after.requestHash === requestHash;
    if (!matches) {
      throw new ConflictException('Idempotency-Key đã được dùng cho dữ liệu khách thuê khác');
    }

    const customerId = String(after?.customerId || audit.entityId || '').trim();
    const customer = customerId
      ? await client.customer.findFirst({ where: { id: customerId, tenantId, deletedAt: null } })
      : null;
    if (!customer) throw new NotFoundException('Không tìm thấy khách thuê của yêu cầu đã xử lý');
    return customer as Customer;
  }

  private createRequestHash(data: any) {
    const birthDate = data.birthDate ? new Date(data.birthDate) : null;
    const canonical = {
      fullName: String(data.fullName || '').trim(),
      phone: normalizeCustomerPhone(data.phone),
      email: String(data.email || '').trim().toLowerCase() || null,
      identityNo: normalizeCustomerIdentityNo(data.identityNo),
      gender: String(data.gender || '').trim() || null,
      birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate.toISOString() : null,
      nationality: String(data.nationality || '').trim() || null,
      address: String(data.address || '').trim() || null,
      zaloChatId: String(data.zaloChatId || '').trim() || null,
      zaloUserId: String(data.zaloUserId || '').trim() || null,
      emergencyPhone: normalizeCustomerPhone(data.emergencyPhone) || null,
      roomId: String(data.roomId || '').trim() || null,
      relationship: String(data.relationship || '').trim() || null,
    };
    return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  }

  private requireIdempotencyKey(value: string) {
    const key = String(value || '').trim().toLowerCase();
    if (!UUID_PATTERN.test(key)) {
      throw new BadRequestException('Idempotency-Key phải là UUID hợp lệ');
    }
    return key;
  }

  private deterministicId(kind: 'customer' | 'audit', tenantId: string, idempotencyKey: string) {
    const hash = createHash('sha256').update(`customer-create:${kind}:${tenantId}:${idempotencyKey}`).digest('hex');
    // Customer and AuditLog use CUID defaults. A deterministic CUID-shaped ID
    // preserves that project convention while making duplicate commands collide.
    return `c${hash.slice(0, 24)}`;
  }

  private isUniqueConstraint(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code === 'P2002'
      : Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'P2002');
  }

  override async softDelete(id: string, userId?: string, moduleName?: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        room: {
          select: {
            id: true,
            code: true,
            name: true,
            building: { select: { id: true, code: true, name: true } },
          },
        },
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

    if (customer.roomId) {
      const room = customer.room;
      const roomText = room
        ? `${room.building ? `${room.building.name || room.building.code} - ` : ''}Phòng ${room.code || room.name}`
        : `phòng ${customer.roomId}`;
      throw new BadRequestException(
        `Không thể xóa khách thuê "${customer.fullName}" vì khách vẫn đang được gắn với ${roomText}. Hãy chấm dứt hoặc để hợp đồng hết hạn để hệ thống tự gỡ khách khỏi phòng trước khi xóa.`,
      );
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
        const p = normalizeCustomerPhone(c.phone);
        if (p) {
          if (!phoneMap.has(p)) phoneMap.set(p, []);
          phoneMap.get(p)!.push(c);
        }
        const idNo = normalizeCustomerIdentityNo(c.identityNo);
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

  async listCustomers(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    sort?: string,
    order?: string
  ): Promise<PaginatedResult<Customer>> {
    const filters: any[] = [];
    if (search) {
      filters.push({
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { identityNo: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { zaloChatId: { contains: search, mode: 'insensitive' } },
          { zaloUserId: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (status) {
      // A customer can be staying as a roommate without owning a contract.
      if (status === 'ACTIVE' || status === 'Đang thuê') {
        filters.push({
          OR: [
            { contracts: { some: { status: { in: ACTIVE_LIKE_CONTRACT_STATUSES } } } },
            { occupancies: { some: { leftAt: null } } },
          ],
        });
      } else if (status === 'INACTIVE' || status === 'Đã trả phòng') {
        filters.push({
          contracts: { none: { status: { in: ACTIVE_LIKE_CONTRACT_STATUSES } } },
        });
        filters.push({ occupancies: { none: { leftAt: null } } });
      } else if (status === 'DEBT' || status === 'Đang nợ') {
        filters.push({ invoices: { some: { status: 'OVERDUE' } } });
      }
    }

    const where: any = filters.length > 0 ? { AND: filters } : {};
    const orderBy = { [sort || 'createdAt']: order || 'desc' };

    return this.repository.paginate(where, page, limit, orderBy, {
      room: {
        select: {
          id: true,
          code: true,
          name: true,
          building: { select: { id: true, code: true, name: true } },
        },
      },
      occupancies: {
        where: { leftAt: null },
        orderBy: { joinedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          contractId: true,
          role: true,
          joinedAt: true,
          room: {
            select: {
              id: true,
              code: true,
              name: true,
              building: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
      // Keep the tenant grid relationship bounded to this customer page. The
      // grid only needs the current effective contract and its room identity.
      contracts: {
        where: {
          deletedAt: null,
          status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
        },
        orderBy: { endDate: 'asc' },
        take: 1,
        select: {
          id: true,
          code: true,
          status: true,
          startDate: true,
          endDate: true,
          room: {
            select: {
              id: true,
              code: true,
              name: true,
              building: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
      _count: { select: { contracts: true } },
    });
  }
}
