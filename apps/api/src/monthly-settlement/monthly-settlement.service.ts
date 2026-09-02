import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { InvoicesService } from '../invoices/invoices.service';
import { CommunicationService } from '../communication/communication.service';
import { HunonicService } from '../hunonic/hunonic.service';
import { AuditService } from '../shared/audit/audit.service';
import { NotificationChannel } from '../automation/automation.constants';
import { InvoiceItemType, InvoiceStatus, SettingScope } from '@prisma/client';
import { ACTIVE_LIKE_CONTRACT_STATUSES } from '../contracts/contracts.adapter';

export interface MonthlySettlementSettings {
  autoCloseEnabled: boolean;
  closingDay: 'LAST_DAY' | number; // 'LAST_DAY' hoặc ngày 25, 28, 30...
  autoSendNotification: boolean;
  notificationHour: number; // Mặc định 8 (08:00 AM)
  notificationMinute: number; // Mặc định 0
  notificationDay: number; // Mặc định 1 (ngày 01 đầu tháng mới)
  notificationChannel: 'ZALO' | 'SMS' | 'ALL';
  updatedAt?: string;
}

export const DEFAULT_SETTLEMENT_SETTINGS: MonthlySettlementSettings = {
  autoCloseEnabled: true,
  closingDay: 'LAST_DAY',
  autoSendNotification: true,
  notificationHour: 8,
  notificationMinute: 0,
  notificationDay: 1,
  notificationChannel: 'ZALO',
};

// Helper tính toán theo múi giờ Việt Nam (GMT+7)
export function getVietnamDate(date = new Date()): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 7 * 3600000);
}

export function formatVietnamPeriod(date = new Date()): string {
  const vn = getVietnamDate(date);
  const y = vn.getFullYear();
  const m = String(vn.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getPreviousVietnamPeriod(period: string): string {
  const [yStr, mStr] = period.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function isLastDayOfVietnamMonth(date = new Date()): boolean {
  const vn = getVietnamDate(date);
  const tomorrow = new Date(vn);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getMonth() !== vn.getMonth();
}

@Injectable()
export class MonthlySettlementService {
  private readonly logger = new Logger(MonthlySettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly invoicesService: InvoicesService,
    private readonly communicationService: CommunicationService,
    private readonly hunonicService: HunonicService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Lấy cấu hình tự động chốt & gửi thông báo
   */
  async getSettings(tenantId: string): Promise<MonthlySettlementSettings> {
    const record = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: 'monthly-settlement-config',
        },
      },
    });

    if (!record || !record.value) {
      return DEFAULT_SETTLEMENT_SETTINGS;
    }

    return {
      ...DEFAULT_SETTLEMENT_SETTINGS,
      ...(record.value as any),
    };
  }

  /**
   * Lưu cấu hình tự động chốt & gửi thông báo
   */
  async saveSettings(tenantId: string, settings: Partial<MonthlySettlementSettings>): Promise<MonthlySettlementSettings> {
    const current = await this.getSettings(tenantId);
    const updated: MonthlySettlementSettings = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.appSetting.upsert({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: 'monthly-settlement-config',
        },
      },
      update: { value: updated as any },
      create: {
        tenantId,
        scope: SettingScope.TENANT,
        ownerId: tenantId,
        key: 'monthly-settlement-config',
        value: updated as any,
      },
    });

    return updated;
  }

  /**
   * Lấy dữ liệu tổng hợp chốt tháng cho toàn bộ các phòng
   */
  async getOverview(
    tenantId: string,
    query: {
      period?: string;
      buildingId?: string;
      search?: string;
      notificationStatus?: string;
      paymentStatus?: string;
    },
  ) {
    const period = query.period || formatVietnamPeriod();

    // 1. Lấy danh sách các tòa nhà
    const buildings = await this.prisma.building.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, code: true },
      orderBy: { displayOrder: 'asc' },
    });

    // 2. Lấy dữ liệu Hunonic Overview để trích xuất chỉ số điện từng phòng
    let hunonicMeters: any[] = [];
    try {
      const hunonicOverview = await this.hunonicService.getOverview(tenantId);
      hunonicMeters = hunonicOverview?.meters || [];
    } catch (e: any) {
      this.logger.warn(`Could not load Hunonic overview for tenant ${tenantId}: ${e?.message}`);
    }

    // Map chỉ số Hunonic theo BuildingCode + RoomCode
    const meterMap = new Map<string, any>();
    for (const m of hunonicMeters) {
      if (m.buildingCode && m.roomCode) {
        meterMap.set(`${m.buildingCode}::${m.roomCode}`, m);
        meterMap.set(m.roomCode, m);
      }
    }

    // 3. Lấy danh sách tất cả các phòng
    const roomWhere: any = {
      tenantId,
      deletedAt: null,
    };
    if (query.buildingId && query.buildingId !== 'ALL') {
      roomWhere.buildingId = query.buildingId;
    }

    const rooms = await this.prisma.room.findMany({
      where: roomWhere,
      include: {
        building: { select: { id: true, name: true, code: true } },
        floor: { select: { id: true, name: true, level: true } },
        contracts: {
          where: { status: { in: ACTIVE_LIKE_CONTRACT_STATUSES }, deletedAt: null },
          include: {
            customer: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        roommates: {
          where: { deletedAt: null },
          select: {
            id: true,
            fullName: true,
            phone: true,
            identityNo: true,
            gender: true,
            birthDate: true,
            address: true,
            zaloPhone: true,
            zaloChatId: true,
            zaloUserId: true,
            relationship: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ building: { displayOrder: 'asc' } }, { code: 'asc' }],
    });

    // 4. Lấy tất cả hóa đơn của kỳ này
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      include: {
        items: true,
        customer: true,
        contract: {
          include: {
            room: {
              include: { building: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map hóa đơn theo RoomId cho kỳ này
    const invoiceByRoomId = new Map<string, any>();
    for (const inv of invoices) {
      const invRoomId = inv.contract?.roomId || (inv as any).roomId;
      const invPeriod = (inv as any).period || (inv.createdAt ? formatVietnamPeriod(inv.createdAt) : '');
      if (invRoomId && (invPeriod === period || inv.code?.includes(period.replace('-', '')))) {
        if (!invoiceByRoomId.has(invRoomId)) {
          invoiceByRoomId.set(invRoomId, inv);
        }
      }
    }

    // 5. Lấy danh sách thông báo đã gửi cho các hóa đơn kỳ này
    const notifications = await this.prisma.notification.findMany({
      where: {
        tenantId,
        type: 'INVOICE_ZALO_PAYMENT_REQUEST',
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const notifByInvoiceCode = new Map<string, any>();
    for (const n of notifications) {
      const invCode = (n.metadata as any)?.invoiceCode || (n.metadata as any)?.code;
      if (invCode && !notifByInvoiceCode.has(invCode)) {
        notifByInvoiceCode.set(invCode, n);
      }
    }

    // 6. Tổng hợp dữ liệu từng phòng
    const items = [];
    for (const room of rooms) {
      const activeContract = room.contracts?.[0] || null;
      const representative = activeContract?.customer || null;
      const existingInvoice = invoiceByRoomId.get(room.id) || null;

      // Tính toán chi phí chính xác
      const hasContract = !!activeContract;

      // Danh sách tất cả thành viên trong phòng:
      // Đại diện (chủ hợp đồng) + Các roommate
      const allMembers = [];
      if (representative && hasContract) {
        const hasZalo = !!(representative.zaloChatId || representative.zaloUserId);
        allMembers.push({
          id: representative.id,
          fullName: representative.fullName,
          phone: representative.phone,
          identityNo: representative.identityNo || '',
          gender: representative.gender || 'MALE',
          zaloPhone: representative.zaloPhone || null,
          zaloChatId: representative.zaloChatId || null,
          zaloUserId: representative.zaloUserId || null,
          hasZalo,
          role: 'CHỦ HỢP ĐỒNG / ĐẠI DIỆN',
          isRepresentative: true,
          relationship: 'Đại diện thuê',
          createdAt: activeContract?.startDate || representative.createdAt,
        });
      }

      if (hasContract && Array.isArray(room.roommates)) {
        for (const rm of room.roommates) {
          if (!representative || rm.id !== representative.id) {
            const hasZalo = !!(rm.zaloChatId || rm.zaloUserId);
            allMembers.push({
              id: rm.id,
              fullName: rm.fullName,
              phone: rm.phone,
              identityNo: rm.identityNo || '',
              gender: rm.gender || 'MALE',
              zaloPhone: rm.zaloPhone || null,
              zaloChatId: rm.zaloChatId || null,
              zaloUserId: rm.zaloUserId || null,
              hasZalo,
              role: 'THÀNH VIÊN Ở CÙNG',
              isRepresentative: false,
              relationship: rm.relationship || 'Khách ở cùng',
              createdAt: rm.createdAt,
            });
          }
        }
      }

      const membersCount = allMembers.length;

      // 1. Tiền phòng: Theo đúng hợp đồng người đại diện, nếu phòng trống = 0
      const roomPrice = hasContract ? Number(activeContract.monthlyRent || 0) : 0;

      // 2. Tiền điện: Chỉ hiển thị phòng đang có hợp đồng, phòng trống = 0
      const meter = meterMap.get(`${room.building.code}::${room.code}`) || meterMap.get(room.code) || null;
      const electricityKwh = hasContract ? Number(meter?.energyMonthKwh || meter?.totalKwh || meter?.currentKwh || 0) : 0;
      const electricityAmount = hasContract ? Number(meter?.moneyMonthVnd || meter?.estimatedCost || meter?.amount || 0) : 0;

      // 3. Tiền nước: Tính tổng đầu người x 100.000đ/người. Nếu phòng trống = 0đ
      const waterAmount = hasContract ? Math.max(1, membersCount) * 100000 : 0;

      // 4. Phí dịch vụ: 0 nếu không có phát sinh
      const serviceAmount = 0;

      // Nếu có invoice thật đã tạo, lấy số liệu từ invoice
      let totalAmount = roomPrice + electricityAmount + waterAmount + serviceAmount;
      let finalRoomPrice = roomPrice;
      let finalElectricityAmount = electricityAmount;
      let finalWaterAmount = waterAmount;
      let finalServiceAmount = serviceAmount;

      if (existingInvoice && hasContract) {
        totalAmount = Number(existingInvoice.total || existingInvoice.subtotal || 0);
        if (existingInvoice.items && existingInvoice.items.length > 0) {
          const roomItem = existingInvoice.items.find((i: any) => i.description?.toLowerCase().includes('phòng') || i.description?.toLowerCase().includes('thuê'));
          const elecItem = existingInvoice.items.find((i: any) => i.description?.toLowerCase().includes('điện'));
          const waterItem = existingInvoice.items.find((i: any) => i.description?.toLowerCase().includes('nước'));
          
          if (roomItem) finalRoomPrice = Number(roomItem.amount);
          if (elecItem) finalElectricityAmount = Number(elecItem.amount);
          if (waterItem) finalWaterAmount = Number(waterItem.amount);
          finalServiceAmount = totalAmount - (finalRoomPrice + finalElectricityAmount + finalWaterAmount);
          if (finalServiceAmount < 0) finalServiceAmount = 0;
        }
      }

      // Trạng thái thông báo
      let notifStatus: 'SENT_ZALO' | 'PENDING' | 'FAILED' | 'SENDING' = 'PENDING';
      let notifSentAt: string | null = null;
      let notifError: string | null = null;
      const invoiceCode = existingInvoice?.code || (hasContract ? `INV-${period.replace('-', '')}-${room.code}` : '--');

      if (existingInvoice) {
        const notif = notifByInvoiceCode.get(existingInvoice.code);
        if (notif) {
          notifSentAt = notif.createdAt?.toISOString() || null;
          if (['SENT', 'DELIVERED', 'READ'].includes(notif.status)) {
            notifStatus = 'SENT_ZALO';
          } else if (notif.status === 'FAILED') {
            notifStatus = 'FAILED';
            notifError = (notif.metadata as any)?.lastError || 'Lỗi gửi tin nhắn Zalo';
          } else if (['SENDING', 'QUEUED'].includes(notif.status)) {
            notifStatus = 'SENDING';
          }
        }
      }

      // Trạng thái thanh toán
      const paymentStatus: string = !hasContract ? 'NONE' : (existingInvoice ? existingInvoice.status : 'ISSUED');

      const item = {
        roomId: room.id,
        roomCode: room.code,
        roomName: room.name,
        buildingId: room.building.id,
        buildingCode: room.building.code,
        buildingName: room.building.name,
        floorName: room.floor.name,
        floorLevel: room.floor.level,
        roomRentalType: room.rentalType,
        roomCapacity: room.capacity,
        contractId: activeContract?.id || null,
        contractCode: activeContract?.code || null,
        contractStatus: activeContract?.status || null,
        hasContract: !!activeContract,
        representative: representative
          ? {
              id: representative.id,
              fullName: representative.fullName,
              phone: representative.phone,
              email: representative.email,
              identityNo: representative.identityNo,
              zaloPhone: representative.zaloPhone || null,
              zaloChatId: representative.zaloChatId || null,
              zaloUserId: representative.zaloUserId || null,
              hasZalo: !!(representative.zaloChatId || representative.zaloUserId),
            }
          : null,
        membersCount: allMembers.length,
        members: allMembers,
        period,
        invoiceId: existingInvoice?.id || null,
        invoiceCode,
        roomPrice: finalRoomPrice,
        electricityKwh,
        electricityAmount: finalElectricityAmount,
        meterReading: meter
          ? {
              oldReading: Number(meter.oldReadingKwh || 0),
              newReading: Number(meter.newReadingKwh || meter.energyMonthKwh || 0),
              powerW: Number(meter.powerCurrentW || 0),
              isOnline: meter.lastStatus === 'on' || meter.isOnline === true,
              lastSyncedAt: meter.lastSyncedAt,
              rateMode: meter.rateMode || 'residential',
            }
          : null,
        waterAmount: finalWaterAmount,
        serviceAmount: finalServiceAmount,
        totalAmount,
        notificationStatus: notifStatus,
        notificationSentAt: notifSentAt,
        notificationError: notifError,
        paymentStatus,
        paidAmount: existingInvoice ? Number(existingInvoice.paidAmount || 0) : 0,
      };

      // Filter logic
      if (query.search) {
        const needle = query.search.trim().toLowerCase();
        const matchRoom = room.code.toLowerCase().includes(needle);
        const matchBuilding = room.building.name.toLowerCase().includes(needle) || room.building.code.toLowerCase().includes(needle);
        const matchRep = representative?.fullName?.toLowerCase().includes(needle) || representative?.phone?.includes(needle);
        const matchMember = allMembers.some((m) => m.fullName.toLowerCase().includes(needle) || m.phone.includes(needle));
        if (!matchRoom && !matchBuilding && !matchRep && !matchMember) {
          continue;
        }
      }

      if (query.notificationStatus && query.notificationStatus !== 'ALL') {
        if (item.notificationStatus !== query.notificationStatus) {
          continue;
        }
      }

      if (query.paymentStatus && query.paymentStatus !== 'ALL') {
        if (item.paymentStatus !== query.paymentStatus) {
          continue;
        }
      }

      items.push(item);
    }

    // 7. Thống kê KPI
    const totalRooms = items.length;
    const occupiedRooms = items.filter((i) => i.hasContract).length;
    const totalAmount = items.reduce((sum, i) => sum + i.totalAmount, 0);
    const sentZaloCount = items.filter((i) => i.notificationStatus === 'SENT_ZALO').length;
    const pendingCount = items.filter((i) => i.notificationStatus === 'PENDING').length;
    const failedCount = items.filter((i) => i.notificationStatus === 'FAILED').length;
    const paidCount = items.filter((i) => i.paymentStatus === 'PAID').length;
    const totalPaidAmount = items.reduce((sum, i) => sum + i.paidAmount, 0);

    const settings = await this.getSettings(tenantId);

    return {
      period,
      buildings,
      settings,
      stats: {
        totalRooms,
        occupiedRooms,
        totalAmount,
        sentZaloCount,
        pendingCount,
        failedCount,
        paidCount,
        totalPaidAmount,
        collectionRate: totalAmount > 0 ? (totalPaidAmount / totalAmount) * 100 : 0,
      },
      items,
    };
  }

  /**
   * Chốt tháng: tạo/cập nhật hóa đơn và khóa chỉ số công tơ điện
   */
  async closeMonth(
    tenantId: string,
    userId: string,
    input: {
      period?: string;
      roomIds?: string[];
      autoSend?: boolean;
    },
  ) {
    const period = input.period || formatVietnamPeriod();
    const overview = await this.getOverview(tenantId, { period });
    let targetItems = overview.items;

    if (Array.isArray(input.roomIds) && input.roomIds.length > 0) {
      targetItems = targetItems.filter((i) => input.roomIds?.includes(i.roomId));
    }

    const settledInvoices = [];
    const lockRows = [];

    for (const item of targetItems) {
      if (!item.hasContract || !item.representative) {
        continue;
      }

      // Tạo hoặc cập nhật hóa đơn chốt tháng
      let invoice = null;
      if (item.invoiceId) {
        invoice = await this.prisma.invoice.findUnique({ where: { id: item.invoiceId } });
      }

      const invoiceCode = item.invoiceCode || `INV-${period.replace('-', '')}-${item.roomCode}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 5); // Hạn thanh toán: 5 ngày kể từ ngày chốt

      const itemsData = [
        {
          tenantId,
          type: InvoiceItemType.RENT,
          description: `Tiền thuê phòng ${item.roomCode} - ${period}`,
          quantity: 1,
          unitPrice: item.roomPrice,
          amount: item.roomPrice,
        },
        {
          tenantId,
          type: InvoiceItemType.UTILITY_ELECTRICITY,
          description: `Tiền điện (${item.electricityKwh} kWh) - ${period}`,
          quantity: 1,
          unitPrice: item.electricityAmount,
          amount: item.electricityAmount,
        },
        {
          tenantId,
          type: InvoiceItemType.UTILITY_WATER,
          description: `Tiền nước sinh hoạt - ${period}`,
          quantity: 1,
          unitPrice: item.waterAmount,
          amount: item.waterAmount,
        },
        {
          tenantId,
          type: InvoiceItemType.SERVICE,
          description: `Phí dịch vụ & Quản lý - ${period}`,
          quantity: 1,
          unitPrice: item.serviceAmount,
          amount: item.serviceAmount,
        },
      ];

      if (!invoice) {
        invoice = await this.prisma.invoice.create({
          data: {
            tenantId,
            code: invoiceCode,
            contractId: item.contractId,
            customerId: item.representative.id,
            status: InvoiceStatus.ISSUED,
            dueDate,
            subtotal: item.totalAmount,
            total: item.totalAmount,
            discount: 0,
            paidAmount: 0,
            items: {
              create: itemsData,
            },
          },
        });
      } else {
        // Cập nhật trạng thái ISSUED nếu đang DRAFT
        invoice = await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.ISSUED,
            subtotal: item.totalAmount,
            total: item.totalAmount,
          },
        });
      }

      settledInvoices.push({
        roomId: item.roomId,
        roomCode: item.roomCode,
        invoiceId: invoice.id,
        invoiceCode: invoice.code,
        totalAmount: item.totalAmount,
      });

      lockRows.push({
        buildingCode: item.buildingCode,
        roomCode: item.roomCode,
        period,
        note: `Chốt tháng tự động kỳ ${period}`,
      });
    }

    // Khóa kỳ công tơ điện trong Hunonic
    if (lockRows.length > 0) {
      try {
        await this.hunonicService.lockPeriods(tenantId, { rows: lockRows });
      } catch (e: any) {
        this.logger.warn(`Could not lock Hunonic meter periods: ${e?.message}`);
      }
    }

    // Nếu chọn tự động gửi thông báo ngay
    let sentCount = 0;
    if (input.autoSend) {
      const sendResult = await this.sendNotifications(tenantId, userId, {
        period,
        invoiceIds: settledInvoices.map((s) => s.invoiceId),
      });
      sentCount = sendResult.sentCount;
    }

    await this.auditService.log({
      action: 'UPDATE',
      module: 'MonthlySettlement',
      entity: 'Settlement',
      entityId: period,
      tenantId,
      userId,
      after: { settledCount: settledInvoices.length, sentCount, period },
    });

    return {
      success: true,
      period,
      settledCount: settledInvoices.length,
      sentCount,
      invoices: settledInvoices,
    };
  }

  /**
   * Gửi thông báo thanh toán Zalo (hỗ trợ gửi danh sách hoặc toàn bộ)
   */
  async sendNotifications(
    tenantId: string,
    userId: string,
    input: {
      period?: string;
      roomIds?: string[];
      invoiceIds?: string[];
    },
  ) {
    const period = input.period || formatVietnamPeriod();
    const overview = await this.getOverview(tenantId, { period });
    let targetItems = overview.items.filter((i) => i.hasContract && i.representative);

    if (Array.isArray(input.roomIds) && input.roomIds.length > 0) {
      targetItems = targetItems.filter((i) => input.roomIds?.includes(i.roomId));
    }
    if (Array.isArray(input.invoiceIds) && input.invoiceIds.length > 0) {
      targetItems = targetItems.filter((i) => i.invoiceId && input.invoiceIds?.includes(i.invoiceId));
    }

    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    for (const item of targetItems) {
      let invoiceId = item.invoiceId;

      // Nếu chưa có invoice, tạo invoice trước
      if (!invoiceId) {
        const closeRes = await this.closeMonth(tenantId, userId, {
          period,
          roomIds: [item.roomId],
          autoSend: false,
        });
        invoiceId = closeRes.invoices[0]?.invoiceId;
      }

      if (!invoiceId) {
        results.push({
          roomId: item.roomId,
          roomCode: item.roomCode,
          status: 'FAILED',
          message: 'Không tìm thấy hoặc không thể tạo hóa đơn.',
        });
        failedCount += 1;
        continue;
      }

      const hasZalo = Boolean(
        item.representative?.hasZalo ||
        item.representative?.zaloChatId ||
        item.representative?.zaloUserId
      );

      if (!hasZalo) {
        results.push({
          roomId: item.roomId,
          roomCode: item.roomCode,
          invoiceId,
          status: 'FAILED',
          message: 'Khách hàng chưa đăng ký / liên kết Zalo Bot (cần chat_id hoặc user_id).',
        });
        failedCount += 1;
        continue;
      }

      try {
        await this.paymentsService.sendInvoiceRequestToZalo(invoiceId, userId);
        results.push({
          roomId: item.roomId,
          roomCode: item.roomCode,
          invoiceId,
          status: 'SUCCESS',
          message: 'Đã gửi thông báo thanh toán qua Zalo thành công.',
        });
        sentCount += 1;
      } catch (err: any) {
        this.logger.error(`Error sending Zalo payment notification for room ${item.roomCode}: ${err?.message}`);
        results.push({
          roomId: item.roomId,
          roomCode: item.roomCode,
          invoiceId,
          status: 'FAILED',
          message: err?.message || 'Không thể gửi tin nhắn qua Zalo.',
        });
        failedCount += 1;
      }
    }

    return {
      period,
      totalRequested: targetItems.length,
      sentCount,
      failedCount,
      results,
    };
  }

  /**
   * Gửi lại thông báo cho 1 phòng cụ thể
   */
  async resendSingle(tenantId: string, userId: string, roomId: string, period?: string) {
    const targetPeriod = period || formatVietnamPeriod();
    const result = await this.sendNotifications(tenantId, userId, {
      period: targetPeriod,
      roomIds: [roomId],
    });

    const itemResult = result.results[0];
    if (itemResult?.status === 'SUCCESS') {
      return { success: true, message: itemResult.message };
    } else {
      throw new BadRequestException(itemResult?.message || 'Gửi thông báo Zalo thất bại.');
    }
  }
}
