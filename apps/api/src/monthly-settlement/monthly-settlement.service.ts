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

export function getNextVietnamPeriod(period: string): string {
  const [yStr, mStr] = period.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function isLastDayOfVietnamMonth(date = new Date()): boolean {
  const vn = getVietnamDate(date);
  const tomorrow = new Date(vn);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getMonth() !== vn.getMonth();
}

export function getPeriodBounds(period: string): { start: Date; end: Date; year: number; month: number } {
  const [yStr, mStr] = period.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end, year, month };
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function sanitizeInvoiceCodePart(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9-]/g, '')
    .slice(0, 32);
}

function buildMonthlyInvoiceCode(period: string, roomCode: string, contract: any, isSharedRoom: boolean): string {
  const periodPart = period.replace('-', '');
  if (!isSharedRoom) {
    return `INV-${periodPart}-${roomCode}`;
  }

  const contractPart = sanitizeInvoiceCodePart(contract?.code || contract?.id || 'SHARED');
  return `INV-${periodPart}-${roomCode}-${contractPart}`;
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
   * Logic nghiệp vụ:
   * - Kỳ thanh toán: Tháng M (Billing Month)
   * - Kỳ sử dụng: Tháng M-1 (Usage Month)
   * - Tiền phòng + Tiền nước: Tính cho kỳ tháng M (Prepaid / Current Month)
   * - Tiền điện + Phí dịch vụ: Tính cho kỳ sử dụng tháng M-1 (Postpaid / Previous Usage Month)
   * - Khách mới ký hợp đồng vào ở từ tháng M (startDate/moveInDate >= 01/M) sẽ KHÔNG bị tính tiền điện/dịch vụ tháng M-1.
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
    const usagePeriod = getPreviousVietnamPeriod(period);
    const periodBounds = getPeriodBounds(period);
    const usagePeriodBounds = getPeriodBounds(usagePeriod);

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

    // 3. Lấy danh sách tất cả các phòng cùng các hợp đồng
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
          orderBy: { startDate: 'desc' },
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
        OR: [
          { period },
          { code: { contains: period.replace('-', '') } },
        ],
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

    // Map hóa đơn theo RoomId/ContractId cho kỳ này. WHOLE dùng room, SHARED dùng từng contract.
    const invoiceByRoomId = new Map<string, any>();
    const invoiceByContractId = new Map<string, any>();
    for (const inv of invoices) {
      const invRoomId = inv.contract?.roomId || (inv as any).roomId;
      const invContractId = inv.contractId || inv.contract?.id;
      const invPeriod = (inv as any).period || (inv.createdAt ? formatVietnamPeriod(inv.createdAt) : '');
      if (invRoomId && (invPeriod === period || inv.code?.includes(period.replace('-', '')))) {
        if (!invoiceByRoomId.has(invRoomId)) {
          invoiceByRoomId.set(invRoomId, inv);
        }
        if (invContractId && !invoiceByContractId.has(invContractId)) {
          invoiceByContractId.set(invContractId, inv);
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

    // 6. Tổng hợp dữ liệu từng phòng theo Eligibility Engine
    const items = [];
    for (const room of rooms) {
      const activeContracts = room.contracts.filter((c) => {
        const cStart = new Date(c.startDate);
        const cEnd = new Date(c.endDate);
        return cStart <= periodBounds.end && cEnd >= periodBounds.start;
      });
      const isSharedRoom = room.rentalType === 'SHARED';
      const billingContracts = isSharedRoom
        ? activeContracts
        : (activeContracts[0] ? [activeContracts[0]] : []);
      const sharedTotalMembers = isSharedRoom
        ? billingContracts.reduce((sum, contract) => sum + Math.max(1, Number(contract.memberCount || 1)), 0)
        : 0;

      // Khoản 3: Tiền điện tháng M-1 (Postpaid) - Chỉ tính nếu khách đã ở trong kỳ M-1
      const meter = meterMap.get(`${room.building.code}::${room.code}`) || meterMap.get(room.code) || null;
      const nowVnPeriod = formatVietnamPeriod();

      // Xác định số kWh và số tiền theo đúng kỳ sử dụng M-1:
      // - Nếu kỳ sử dụng M-1 là tháng trước đó (usagePeriod < nowVnPeriod, vd: đang tháng 9/2026 xem kỳ tháng 9 nên M-1 là tháng 8/2026): lấy energyPrevMonthKwh & moneyPrevMonthVnd (Tổng T8)
      // - Nếu kỳ sử dụng M-1 là tháng hiện tại (usagePeriod === nowVnPeriod, vd: đang tháng 9/2026 xem kỳ chốt tháng 10 nên M-1 là tháng 9/2026): lấy energyMonthKwh & moneyMonthVnd (Tiêu thụ T9)
      let rawElectricityKwh = 0;
      let rawElectricityAmount = 0;
      if (meter) {
        if (usagePeriod < nowVnPeriod) {
          rawElectricityKwh = Number(meter.energyPrevMonthKwh ?? meter.energyMonthKwh ?? 0);
          rawElectricityAmount = Number(meter.moneyPrevMonthVnd ?? meter.moneyMonthVnd ?? 0);
        } else {
          rawElectricityKwh = Number(meter.energyMonthKwh ?? 0);
          rawElectricityAmount = Number(meter.moneyMonthVnd ?? 0);
        }

        // Nếu phòng áp dụng phương thức Tự thiết lập (Custom Rate Unit Price):
        if (meter.rateMode === 'custom') {
          const customUnit = Number(meter.customRateVnd || 3967);
          const computedCustomAmount = Math.round(rawElectricityKwh * customUnit);
          if (computedCustomAmount > 0) {
            rawElectricityAmount = computedCustomAmount;
          }
        }
      }

      // Khoản 4: Phí dịch vụ tháng M-1 (Postpaid)
      const rawServiceAmount = 0;

      const isCustomRate = meter?.rateMode === 'custom';
      const customRateVnd = isCustomRate ? Number(meter?.customRateVnd || 3967) : null;
      const rateModeLabel = isCustomRate ? `Tự thiết lập (${(customRateVnd || 3967).toLocaleString('vi-VN')}đ/kWh)` : 'Bậc thang EVN';

      for (const activeContract of billingContracts) {
        const representative = activeContract?.customer || null;
        const existingInvoice = isSharedRoom
          ? invoiceByContractId.get(activeContract.id) || null
          : invoiceByRoomId.get(room.id) || invoiceByContractId.get(activeContract.id) || null;
        const hasContract = !!activeContract;
        const contractMembersCount = Math.max(1, Number(activeContract.memberCount || 1));
        const isEligibleForPreviousUsage = hasContract && new Date(activeContract.startDate) <= usagePeriodBounds.end;
        const isFirstMonthNewTenant = hasContract && !isEligibleForPreviousUsage;
        const utilityShareRatio = isSharedRoom && sharedTotalMembers > 0
          ? contractMembersCount / sharedTotalMembers
          : 1;
        const electricityKwh = isEligibleForPreviousUsage ? roundMoney(rawElectricityKwh * utilityShareRatio) : 0;
        const electricityAmount = isEligibleForPreviousUsage ? roundMoney(rawElectricityAmount * utilityShareRatio) : 0;
        const serviceAmount = isEligibleForPreviousUsage ? roundMoney(rawServiceAmount * utilityShareRatio) : 0;

        const allMembers = [];
        if (representative) {
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
            role: isSharedRoom ? 'KHÁCH GHÉP / ĐẠI DIỆN HĐ' : 'CHỦ HỢP ĐỒNG / ĐẠI DIỆN',
            isRepresentative: true,
            relationship: isSharedRoom ? 'Khách thuê ghép' : 'Đại diện thuê',
            createdAt: activeContract?.startDate || representative.createdAt,
          });
        }

        if (!isSharedRoom && Array.isArray(room.roommates)) {
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

        const membersCount = isSharedRoom
          ? contractMembersCount
          : Math.max(contractMembersCount, allMembers.length);
        const roomPrice = Number(activeContract.monthlyRent || 0);
        const waterAmount = membersCount * 100000;

        let totalAmount = roomPrice + electricityAmount + waterAmount + serviceAmount;
        let finalRoomPrice = roomPrice;
        let finalElectricityAmount = electricityAmount;
        let finalWaterAmount = waterAmount;
        let finalServiceAmount = serviceAmount;

        if (existingInvoice) {
          totalAmount = Number(existingInvoice.total || existingInvoice.subtotal || 0);
          if (existingInvoice.items && existingInvoice.items.length > 0) {
            const roomItem = existingInvoice.items.find((i: any) => i.type === InvoiceItemType.RENT || i.description?.toLowerCase().includes('phòng') || i.description?.toLowerCase().includes('thuê'));
            const elecItem = existingInvoice.items.find((i: any) => i.type === InvoiceItemType.UTILITY_ELECTRICITY || i.description?.toLowerCase().includes('điện'));
            const waterItem = existingInvoice.items.find((i: any) => i.type === InvoiceItemType.UTILITY_WATER || i.description?.toLowerCase().includes('nước'));
            const serviceItem = existingInvoice.items.find((i: any) => i.type === InvoiceItemType.SERVICE);
            if (roomItem) finalRoomPrice = Number(roomItem.amount);
            if (elecItem) finalElectricityAmount = Number(elecItem.amount);
            if (waterItem) finalWaterAmount = Number(waterItem.amount);
            finalServiceAmount = serviceItem ? Number(serviceItem.amount) : totalAmount - (finalRoomPrice + finalElectricityAmount + finalWaterAmount);
            if (finalServiceAmount < 0) finalServiceAmount = 0;
          }
        }

        let notifStatus: 'SENT_ZALO' | 'PENDING' | 'FAILED' | 'SENDING' = 'PENDING';
        let notifSentAt: string | null = null;
        let notifError: string | null = null;
        const invoiceCode = existingInvoice?.code || buildMonthlyInvoiceCode(period, room.code, activeContract, isSharedRoom);

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
              const createdAt = notif.createdAt ? new Date(notif.createdAt).getTime() : 0;
              const isStale = Date.now() - createdAt > 2 * 60 * 1000;
              if (isStale) {
                notifStatus = 'FAILED';
                notifError = (notif.metadata as any)?.lastError || 'Quá thời gian phản hồi từ Zalo (Hết thời gian chờ). Nhấn Zalo để gửi lại.';
              } else {
                notifStatus = 'SENDING';
              }
            }
          }
        }

        const paymentStatus: string = existingInvoice ? existingInvoice.status : 'ISSUED';
        const item = {
          billingGroupKey: isSharedRoom ? `CONTRACT:${activeContract.id}` : `ROOM:${room.id}`,
          billingScope: isSharedRoom ? 'CONTRACT' : 'ROOM',
          utilityShareRatio,
          sharedTotalMembers: isSharedRoom ? sharedTotalMembers : membersCount,
          roomElectricityKwh: rawElectricityKwh,
          roomElectricityAmount: rawElectricityAmount,
          roomServiceAmount: rawServiceAmount,
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
          contractStartDate: activeContract?.startDate ? new Date(activeContract.startDate).toISOString() : null,
          contractSignedAt: activeContract?.signedAt ? new Date(activeContract.signedAt).toISOString() : null,
          hasContract,
          isFirstMonthNewTenant,
          electricityEligible: isEligibleForPreviousUsage,
          serviceEligible: isEligibleForPreviousUsage,
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
          membersCount,
          members: allMembers,
          period,
          usagePeriod,
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
                isOnline: meter.status === 'on' || meter.lastStatus === 'on' || meter.isOnline === true,
                lastSyncedAt: meter.lastSyncedAt,
                rateMode: isCustomRate ? 'custom' : 'residential',
                customRateVnd,
                rateModeLabel,
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

        if (query.search) {
          const needle = query.search.trim().toLowerCase();
          const matchRoom = room.code.toLowerCase().includes(needle);
          const matchBuilding = room.building.name.toLowerCase().includes(needle) || room.building.code.toLowerCase().includes(needle);
          const matchRep = representative?.fullName?.toLowerCase().includes(needle) || representative?.phone?.includes(needle);
          const matchMember = allMembers.some((m) => m.fullName.toLowerCase().includes(needle) || String(m.phone || '').includes(needle));
          if (!matchRoom && !matchBuilding && !matchRep && !matchMember) {
            continue;
          }
        }

        if (query.notificationStatus && query.notificationStatus !== 'ALL' && item.notificationStatus !== query.notificationStatus) {
          continue;
        }

        if (query.paymentStatus && query.paymentStatus !== 'ALL' && item.paymentStatus !== query.paymentStatus) {
          continue;
        }

        items.push(item);
      }
    }

    // 7. Thống kê KPI
    const totalRooms = rooms.length;
    const occupiedRooms = new Set(items.filter((i) => i.hasContract).map((i) => i.roomId)).size;
    const billingGroups = items.length;
    const totalAmount = items.reduce((sum, i) => sum + i.totalAmount, 0);
    const sentZaloCount = items.filter((i) => i.notificationStatus === 'SENT_ZALO').length;
    const pendingCount = items.filter((i) => i.notificationStatus === 'PENDING').length;
    const failedCount = items.filter((i) => i.notificationStatus === 'FAILED').length;
    const paidCount = items.filter((i) => i.paymentStatus === 'PAID').length;
    const totalPaidAmount = items.reduce((sum, i) => sum + i.paidAmount, 0);

    const settings = await this.getSettings(tenantId);

    return {
      period,
      usagePeriod,
      buildings,
      settings,
      stats: {
        totalRooms,
        occupiedRooms,
        billingGroups,
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

  async finalizeUsagePeriod(tenantId: string, input: { period?: string }) {
    const usagePeriod = input.period || formatVietnamPeriod();
    const billingPeriod = getNextVietnamPeriod(usagePeriod);
    const overview = await this.getOverview(tenantId, { period: billingPeriod });
    const lockRows = overview.items
      .filter((item) => item.hasContract && item.electricityEligible && item.meterReading)
      .map((item) => ({
        buildingCode: item.buildingCode,
        roomCode: item.roomCode,
        period: usagePeriod,
        note: `Khóa chỉ số điện sử dụng tháng ${usagePeriod} trước kỳ thu ${billingPeriod}`,
      }));

    if (lockRows.length > 0) {
      await this.hunonicService.lockPeriods(tenantId, { rows: lockRows });
    }

    return {
      success: true,
      usagePeriod,
      billingPeriod,
      lockedCount: lockRows.length,
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
    const usagePeriod = getPreviousVietnamPeriod(period);
    const overview = await this.getOverview(tenantId, { period });
    let targetItems = overview.items;

    if (Array.isArray(input.roomIds) && input.roomIds.length > 0) {
      targetItems = targetItems.filter((i) => input.roomIds?.includes(i.roomId));
    }

    const settledInvoices = [];
    const skippedInvoices = [];
    const lockRows = [];

    for (const item of targetItems) {
      if (!item.hasContract || !item.representative || item.totalAmount <= 0) {
        continue;
      }

      // Tạo hoặc cập nhật hóa đơn chốt tháng
      let invoice = null;
      if (item.invoiceId) {
        invoice = await this.prisma.invoice.findUnique({ where: { id: item.invoiceId } });
      }

      if (invoice) {
        const paidAmount = Number((invoice as any).paidAmount || 0);
        const lockedStatuses = [
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.PAID,
          InvoiceStatus.CANCELLED,
          InvoiceStatus.WRITTEN_OFF,
        ];
        if (paidAmount > 0 || lockedStatuses.includes(invoice.status)) {
          skippedInvoices.push({
            roomId: item.roomId,
            roomCode: item.roomCode,
            invoiceId: invoice.id,
            invoiceCode: invoice.code,
            status: invoice.status,
            reason: 'Hóa đơn đã phát sinh thanh toán hoặc đã khóa trạng thái, không chốt lại để tránh sai sổ cái.',
          });
          continue;
        }
      }

      const invoiceCode = item.invoiceCode || `INV-${period.replace('-', '')}-${item.roomCode}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 5); // Hạn thanh toán: 5 ngày kể từ ngày chốt

      // Tạo các dòng chi tiết theo đúng kỳ dịch vụ (servicePeriod)
      const itemsData: any[] = [
        {
          tenantId,
          type: InvoiceItemType.RENT,
          description: `Tiền thuê phòng ${item.roomCode} - Kỳ tháng ${period}`,
          servicePeriod: period,
          quantity: 1,
          unitPrice: item.roomPrice,
          amount: item.roomPrice,
        },
        {
          tenantId,
          type: InvoiceItemType.UTILITY_WATER,
          description: `Tiền nước sinh hoạt (${item.membersCount} người) - Kỳ tháng ${period}`,
          servicePeriod: period,
          quantity: 1,
          unitPrice: item.waterAmount,
          amount: item.waterAmount,
        },
      ];

      if (item.electricityEligible && item.electricityAmount > 0) {
        itemsData.push({
          tenantId,
          type: InvoiceItemType.UTILITY_ELECTRICITY,
          description: `Tiền điện (${item.electricityKwh} kWh) - Sử dụng tháng ${usagePeriod}`,
          servicePeriod: usagePeriod,
          quantity: 1,
          unitPrice: item.electricityAmount,
          amount: item.electricityAmount,
        });
      }

      if (item.serviceEligible && item.serviceAmount > 0) {
        itemsData.push({
          tenantId,
          type: InvoiceItemType.SERVICE,
          description: `Phí dịch vụ & Quản lý - Sử dụng tháng ${usagePeriod}`,
          servicePeriod: usagePeriod,
          quantity: 1,
          unitPrice: item.serviceAmount,
          amount: item.serviceAmount,
        });
      }

      if (!invoice) {
        invoice = await this.prisma.invoice.create({
          data: {
            tenantId,
            code: invoiceCode,
            period,
            usagePeriod,
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
        // Cập nhật hóa đơn và làm mới items
        await this.prisma.invoiceItem.deleteMany({
          where: { invoiceId: invoice.id },
        });

        invoice = await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.ISSUED,
            period,
            usagePeriod,
            subtotal: item.totalAmount,
            total: item.totalAmount,
            items: {
              create: itemsData,
            },
          },
        });
      }

      settledInvoices.push({
        roomId: item.roomId,
        roomCode: item.roomCode,
        contractId: item.contractId,
        invoiceId: invoice.id,
        invoiceCode: invoice.code,
        totalAmount: item.totalAmount,
      });

      if (item.electricityEligible) {
        const lockRow = {
          buildingCode: item.buildingCode,
          roomCode: item.roomCode,
          period: usagePeriod,
          note: `Khóa chỉ số điện sử dụng tháng ${usagePeriod} cho kỳ thu ${period}`,
        };
        const lockKey = `${lockRow.buildingCode}:${lockRow.roomCode}:${lockRow.period}`;
        if (!lockRows.some((row) => `${row.buildingCode}:${row.roomCode}:${row.period}` === lockKey)) {
          lockRows.push(lockRow);
        }
      }
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
      skippedCount: skippedInvoices.length,
      sentCount,
      invoices: settledInvoices,
      skippedInvoices,
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
