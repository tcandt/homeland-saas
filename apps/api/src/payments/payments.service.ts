import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditAction, JournalSourceType, PaymentProvider, PaymentRequestStatus, PaymentSourceType, Prisma, SettingScope } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { DepositsService } from '../deposits/deposits.service';
import { CommunicationService } from '../communication/communication.service';
import { NotificationChannel } from '../automation/automation.constants';
import { JournalEntryService } from '../finance/journal-entry.service';
import { AuditService } from '../shared/audit/audit.service';
import { buildRoomContext } from '../shared/context/room-context';
import { createHmac, timingSafeEqual } from 'crypto';
import { ZaloProvider } from '../communication/providers/communication.providers';

type SePayWebhookPayload = {
  id?: number | string;
  transaction_id?: string;
  gateway?: string;
  transactionDate?: string;
  transaction_date?: string;
  accountNumber?: string;
  account_number?: string;
  bank_account_xid?: string;
  subAccount?: string;
  va?: string | null;
  payment_code?: string | null;
  code?: string | null;
  content?: string;
  transferType?: string;
  transfer_type?: string;
  transferAmount?: number;
  amount?: number;
  description?: string;
  referenceCode?: string;
  reference_code?: string;
};

type PaymentRequestResponse = {
  id: string;
  sourceType: PaymentSourceType;
  sourceId: string;
  paymentCode: string;
  amount: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string | null;
  qrUrl: string;
  status: PaymentRequestStatus;
  provider: PaymentProvider;
  createdAt: Date;
  updatedAt: Date;
};

type SePayAuthMode = 'apiKey' | 'hmac' | 'dual' | 'none';
type SePayRoutingAssignment = {
  id?: string;
  roomId: string;
  bankAccountId: string;
  validFrom?: string | null;
  validTo?: string | null;
  note?: string | null;
};
type SePayRoutingSettings = {
  assignments?: SePayRoutingAssignment[];
};
type SePayAdminConfig = {
  routes: Array<{
    id: string;
    roomId: string;
    roomCode: string;
    roomName: string;
    buildingCode: string;
    buildingName: string;
    bankAccountId: string;
    bankAccountLabel: string;
    validFrom: string;
    validTo: string | null;
    note: string | null;
    isActive: boolean;
  }>;
  rooms: Array<{
    id: string;
    code: string;
    name: string;
    rentalType: string;
    buildingId: string;
    buildingCode: string;
    buildingName: string;
    ownerId: string | null;
    mappedBankAccountId: string | null;
    mappedBankAccountLabel: string | null;
    mappingSource: 'ROOM' | 'OWNER_DEFAULT' | 'OWNER_FALLBACK' | 'GLOBAL_FALLBACK' | null;
    validFrom: string | null;
    validTo: string | null;
  }>;
  bankAccounts: Array<{
    id: string;
    ownerId: string | null;
    ownerName: string | null;
    bankName: string;
    accountNumber: string;
    accountName: string;
    isActive: boolean;
    label: string;
  }>;
  status: Awaited<ReturnType<PaymentsService['getSePayStatus']>>;
};

type ResolvedSePayBankAccount = {
  bankAccount: {
    id: string;
    ownerId: string | null;
    bankName: string;
    accountNumber: string;
    accountName: string;
    isActive: boolean;
    createdAt?: Date;
  };
  source: 'ROOM' | 'OWNER_DEFAULT' | 'OWNER_FALLBACK' | 'GLOBAL_FALLBACK' | 'EXPLICIT';
  roomRoute?: SePayRoutingAssignment | null;
  room?: {
    id: string;
    code: string;
    name: string;
    rentalType: string;
    buildingId: string;
    buildingName: string;
    buildingCode: string;
    ownerId: string | null;
  } | null;
};

function randomCode(prefix: string, scope: string) {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${scope.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${suffix}`;
}

@Injectable()
export class PaymentsService {
  private static readonly processingSePayTransactionIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    private readonly depositsService: DepositsService,
    private readonly communicationService: CommunicationService,
    private readonly zaloProvider: ZaloProvider,
    private readonly journalEntryService: JournalEntryService,
    private readonly auditService: AuditService,
  ) {}

  private async notifySePayMismatch(
    tenantId: string,
    context: {
      title: string;
      message: string;
      paymentCode?: string | null;
      transactionId?: string | null;
      expectedAmount?: number | null;
      actualAmount?: number | null;
      expectedBankAccount?: string | null;
      actualBankAccount?: string | null;
    },
  ) {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true },
    });

    const adminUsers = users.filter((user: any) => {
      const email = String(user.email || '').toLowerCase();
      return email === 'admin@homeland.vn';
    });
    const recipients = adminUsers.length > 0 ? adminUsers : [{ id: null }];

    await Promise.all(
      recipients.map((user: any) =>
        this.communicationService.dispatch({
          tenantId,
          userId: user.id || null,
          channel: NotificationChannel.IN_APP,
          templateCode: 'SYSTEM_ALERT',
          moduleType: 'PAYMENTS',
          context,
        }),
      ),
    );
  }

  private async logPaymentAudit(
    tenantId: string,
    entity: string,
    entityId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    userId?: string,
  ) {
    await this.auditService.log({
      action: AuditAction.UPDATE,
      module: 'Payments',
      entity,
      entityId,
      tenantId,
      userId,
      before,
      after,
    });
  }

  private resolveZaloRecipient(customer: any) {
    const recipient = String(customer?.zaloChatId || customer?.zaloUserId || customer?.phone || '').trim();
    if (!recipient) {
      throw new BadRequestException('Khách thuê chưa có số điện thoại hoặc Zalo chat ID để gửi qua Zalo Bot.');
    }
    return recipient;
  }

  private async createOverpaymentJournalEntry(
    tenantId: string,
    creditNoteId: string,
    paymentCode: string,
    amount: number,
    resolution: 'CREDIT_BALANCE' | 'CARRY_FORWARD',
  ) {
    const existing = await this.prisma.journalEntry.findFirst({
      where: {
        tenantId,
        sourceType: JournalSourceType.ADJUSTMENT,
        sourceId: creditNoteId,
      },
      select: { id: true },
    });
    if (existing) return existing;

    const bankAccount = await this.prisma.chartOfAccount.findFirst({
      where: { tenantId, code: '1100' },
    });
    const customerCreditLiability = await this.prisma.chartOfAccount.findFirst({
      where: { tenantId, code: '1300' },
    });

    if (!bankAccount || !customerCreditLiability) {
      throw new BadRequestException('Khong tim thay tai khoan ke toan de ghi nhan tien thua.');
    }

    return this.journalEntryService.createJournalEntry(tenantId, {
      code: `JE-OVERPAY-${Date.now()}`,
      sourceType: JournalSourceType.ADJUSTMENT,
      sourceId: creditNoteId,
      description:
        resolution === 'CARRY_FORWARD'
          ? `Ghi nhan tien thua SePay ${paymentCode} de can tru ky sau`
          : `Ghi nhan tien thua SePay ${paymentCode} vao du co khach hang`,
      entryDate: new Date(),
      status: 'POSTED',
      lines: [
        {
          accountId: bankAccount.id,
          type: 'DEBIT',
          amount,
          description: 'Tien thua da vao ngan hang',
        },
        {
          accountId: customerCreditLiability.id,
          type: 'CREDIT',
          amount,
          description:
            resolution === 'CARRY_FORWARD'
              ? 'No phai tra khach de can tru ky sau'
              : 'No phai tra khach dang nam giu',
        },
      ],
    });
  }

  private async resolveSePayConfig(tenantId: string) {
    const record = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: 'sepay',
        },
      },
    });

    return (record?.value as any) || {};
  }

  private normalizeSePayAuthMode(value: unknown): SePayAuthMode {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'hmac') return 'hmac';
    if (normalized === 'dual') return 'dual';
    if (normalized === 'none') return 'none';
    return 'apiKey';
  }

  private constantTimeEquals(left: string, right: string) {
    if (!left || !right || left.length !== right.length) return false;
    return timingSafeEqual(Buffer.from(left), Buffer.from(right));
  }

  private verifySePayTimestamp(timestamp: string) {
    const parsed = Number(timestamp);
    if (!Number.isFinite(parsed)) return false;
    const milliseconds = parsed > 1e12 ? parsed : parsed * 1000;
    return Math.abs(Date.now() - milliseconds) <= 10 * 60 * 1000;
  }

  private verifySePayHmac(secret: string, timestamp: string, rawBody: string, signature: string) {
    if (!secret || !timestamp || !rawBody || !signature) return false;
    const cleanSignature = String(signature).replace(/^sha256=/i, '').trim().toLowerCase();
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex')
      .toLowerCase();
    return this.constantTimeEquals(expected, cleanSignature);
  }

  private async resolveOwnerDefaultBankAccountId(tenantId: string, ownerId?: string | null) {
    if (!ownerId) return null;

    const record = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: 'owner-bank-defaults',
        },
      },
    });

    const defaults = (record?.value as any)?.defaults || {};
    const bankAccountId = typeof defaults[ownerId] === 'string' ? defaults[ownerId] : null;
    return bankAccountId || null;
  }

  private async resolveRoutingSettings(tenantId: string): Promise<SePayRoutingSettings> {
    try {
      const routes = await (this.prisma as any).roomPaymentAccountRoute.findMany({
        where: { tenantId },
        orderBy: [{ roomId: 'asc' }, { validFrom: 'desc' }],
        select: {
          id: true,
          roomId: true,
          bankAccountId: true,
          validFrom: true,
          validTo: true,
          note: true,
        },
      });

      return {
        assignments: routes.map((route) => ({
          id: route.id,
          roomId: route.roomId,
          bankAccountId: route.bankAccountId,
          validFrom: route.validFrom.toISOString(),
          validTo: route.validTo ? route.validTo.toISOString() : null,
          note: route.note || null,
        })),
      };
    } catch (error: any) {
      if (String(error?.code || '') !== 'P2021') throw error;
    }

    const record = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: 'sepay-routing',
        },
      },
    });

    return ((record?.value as any) || {}) as SePayRoutingSettings;
  }

  private normalizeRoutingAssignments(assignments: SePayRoutingAssignment[] = []) {
    return assignments
      .map((assignment) => ({
        roomId: String(assignment.roomId || '').trim(),
        bankAccountId: String(assignment.bankAccountId || '').trim(),
        validFrom: this.parseRoutingDate(assignment.validFrom || new Date().toISOString(), 'start'),
        validTo: this.parseRoutingDate(assignment.validTo || null, 'end'),
        note: String(assignment.note || '').trim() || null,
      }))
      .filter((assignment) => assignment.roomId && assignment.bankAccountId && assignment.validFrom)
      .sort((left, right) => {
        if (left.roomId === right.roomId) {
          return (right.validFrom?.getTime() || 0) - (left.validFrom?.getTime() || 0);
        }
        return left.roomId.localeCompare(right.roomId);
      });
  }

  async saveRoomPaymentAccountRoutes(tenantId: string, assignments: SePayRoutingAssignment[], userId?: string) {
    const normalized = this.normalizeRoutingAssignments(assignments);
    const roomIds = Array.from(new Set(normalized.map((assignment) => assignment.roomId)));
    const bankAccountIds = Array.from(new Set(normalized.map((assignment) => assignment.bankAccountId)));
    const serializedAssignments = normalized.map((assignment) => ({
      roomId: assignment.roomId,
      bankAccountId: assignment.bankAccountId,
      validFrom: assignment.validFrom?.toISOString() || null,
      validTo: assignment.validTo?.toISOString() || null,
      note: assignment.note,
    }));

    const [rooms, bankAccounts] = await Promise.all([
      roomIds.length
        ? this.prisma.room.findMany({
            where: { tenantId, id: { in: roomIds }, deletedAt: null as any },
            select: { id: true },
          })
        : Promise.resolve([]),
      bankAccountIds.length
        ? this.prisma.bankAccount.findMany({
            where: { tenantId, id: { in: bankAccountIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    const validRoomIds = new Set(rooms.map((room) => room.id));
    const validBankIds = new Set(bankAccounts.map((bank) => bank.id));
    const invalidRoom = normalized.find((assignment) => !validRoomIds.has(assignment.roomId));
    if (invalidRoom) throw new BadRequestException('Có room routing không hợp lệ.');
    const invalidBank = normalized.find((assignment) => !validBankIds.has(assignment.bankAccountId));
    if (invalidBank) throw new BadRequestException('Có tài khoản nhận tiền không hợp lệ.');

    try {
      await this.prisma.$transaction(async (tx) => {
        await (tx as any).roomPaymentAccountRoute.deleteMany({ where: { tenantId } });
        if (normalized.length > 0) {
          await (tx as any).roomPaymentAccountRoute.createMany({
            data: normalized.map((assignment) => ({
              tenantId,
              roomId: assignment.roomId,
              bankAccountId: assignment.bankAccountId,
              validFrom: assignment.validFrom!,
              validTo: assignment.validTo || null,
              note: assignment.note,
            })),
          });
        }
      });
    } catch (error: any) {
      if (String(error?.code || '') === 'P2021') {
        await this.prisma.appSetting.upsert({
          where: {
            tenantId_scope_ownerId_key: {
              tenantId,
              scope: SettingScope.TENANT,
              ownerId: tenantId,
              key: 'sepay-routing',
            },
          },
          create: {
            tenantId,
            scope: SettingScope.TENANT,
            ownerId: tenantId,
            key: 'sepay-routing',
            value: { assignments: serializedAssignments } as any,
            updatedBy: userId || null,
          },
          update: {
            value: { assignments: serializedAssignments } as any,
            updatedBy: userId || null,
          },
        });
      } else {
        throw error;
      }
    }

    await this.auditService.log({
      action: AuditAction.UPDATE,
      module: 'Payments',
      entity: 'RoomPaymentAccountRoute',
      entityId: tenantId,
      tenantId,
      userId,
      after: {
        count: normalized.length,
        roomIds,
        bankAccountIds,
      },
    });

    return this.getSePayAdminConfig(tenantId);
  }

  private parseRoutingDate(value?: string | null, boundary: 'start' | 'end' = 'start') {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const normalized = trimmed.length <= 10
      ? `${trimmed}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`
      : trimmed;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private isRoutingAssignmentActive(assignment: SePayRoutingAssignment, at = new Date()) {
    const from = this.parseRoutingDate(assignment.validFrom, 'start');
    const to = this.parseRoutingDate(assignment.validTo, 'end');
    if (from && at < from) return false;
    if (to && at > to) return false;
    return true;
  }

  private pickBestRoomAssignment(assignments: SePayRoutingAssignment[], at = new Date()) {
    const active = assignments.filter((assignment) => this.isRoutingAssignmentActive(assignment, at));
    if (active.length === 0) return null;

    return [...active].sort((left, right) => {
      const leftFrom = this.parseRoutingDate(left.validFrom, 'start')?.getTime() || 0;
      const rightFrom = this.parseRoutingDate(right.validFrom, 'start')?.getTime() || 0;
      return rightFrom - leftFrom;
    })[0] || null;
  }

  private maskAccountNumber(value?: string | null) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    if (normalized.length <= 4) return normalized;
    return `${'*'.repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
  }

  private formatBankAccountLabel(bankAccount: { bankName: string; accountNumber: string; accountName?: string | null }) {
    return `${bankAccount.bankName} • ${this.maskAccountNumber(bankAccount.accountNumber)}${bankAccount.accountName ? ` • ${bankAccount.accountName}` : ''}`;
  }

  private async getRoomAccountRouting(
    tenantId: string,
    roomId: string,
    at = new Date(),
  ): Promise<SePayRoutingAssignment | null> {
    const routing = await this.resolveRoutingSettings(tenantId);
    const assignments = Array.isArray(routing.assignments) ? routing.assignments : [];
    return this.pickBestRoomAssignment(
      assignments.filter((assignment) => String(assignment.roomId || '').trim() === roomId),
      at,
    );
  }

  private async resolveRoomContext(tenantId: string, roomId: string) {
    return this.prisma.room.findFirst({
      where: { id: roomId, tenantId, deletedAt: null as any },
      select: {
        id: true,
        code: true,
        name: true,
        rentalType: true,
        buildingId: true,
        building: {
          select: {
            id: true,
            code: true,
            name: true,
            ownerId: true,
          },
        },
      },
    });
  }

  private async resolveBankAccount(
    tenantId: string,
    options: { ownerId?: string | null; roomId?: string | null; bankAccountId?: string | null } = {},
  ): Promise<ResolvedSePayBankAccount> {
    const sepayConfig = await this.resolveSePayConfig(tenantId);
    if (sepayConfig.enabled === false) {
      throw new BadRequestException('SePay đang tắt trong Settings');
    }

    if (options.bankAccountId) {
      const explicit = await this.prisma.bankAccount.findFirst({
        where: {
          tenantId,
          id: options.bankAccountId,
          isActive: true,
        },
      });
      if (!explicit) throw new BadRequestException('Không tìm thấy tài khoản nhận tiền đang hoạt động.');
      return {
        bankAccount: explicit,
        source: 'EXPLICIT',
        roomRoute: null,
        room: null,
      };
    }

    let room: Awaited<ReturnType<PaymentsService['resolveRoomContext']>> | null = null;
    let roomRoute: SePayRoutingAssignment | null = null;
    let ownerId = options.ownerId || null;
    if (options.roomId) {
      room = await this.resolveRoomContext(tenantId, options.roomId);
      if (!room) throw new BadRequestException('Không tìm thấy phòng để resolve QR SePay.');
      ownerId = room.building?.ownerId || ownerId || null;
      roomRoute = await this.getRoomAccountRouting(tenantId, options.roomId);
      if (roomRoute?.bankAccountId) {
        const routeBankAccount = await this.prisma.bankAccount.findFirst({
          where: {
            tenantId,
            id: roomRoute.bankAccountId,
            isActive: true,
          },
        });
        if (routeBankAccount) {
          return {
            bankAccount: routeBankAccount,
            source: 'ROOM',
            roomRoute,
            room: {
              id: room.id,
              code: room.code,
              name: room.name,
              rentalType: String(room.rentalType),
              buildingId: room.buildingId,
              buildingName: room.building?.name || '',
              buildingCode: room.building?.code || '',
              ownerId: room.building?.ownerId || null,
            },
          };
        }
      }
    }

    const defaultBankAccountId = await this.resolveOwnerDefaultBankAccountId(tenantId, ownerId);
    const defaultBankAccount = defaultBankAccountId ? await this.prisma.bankAccount.findFirst({
      where: {
        tenantId,
        id: defaultBankAccountId,
        isActive: true,
        ...(ownerId ? { ownerId } : {}),
      },
    }) : null;

    const bankAccount = defaultBankAccount || await this.prisma.bankAccount.findFirst({
      where: { tenantId, isActive: true, ...(ownerId ? { ownerId } : {}) },
      orderBy: { createdAt: 'asc' },
    }) || await this.prisma.bankAccount.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!bankAccount) {
      throw new BadRequestException('Không tìm thấy tài khoản ngân hàng để tạo QR SePay');
    }

    return {
      bankAccount,
      source: ownerId
        ? (defaultBankAccount ? 'OWNER_DEFAULT' : 'OWNER_FALLBACK')
        : 'GLOBAL_FALLBACK',
      roomRoute,
      room: room
        ? {
            id: room.id,
            code: room.code,
            name: room.name,
            rentalType: String(room.rentalType),
            buildingId: room.buildingId,
            buildingName: room.building?.name || '',
            buildingCode: room.building?.code || '',
            ownerId: room.building?.ownerId || null,
          }
        : null,
    };
  }

  private buildQrUrl(params: {
    bankName: string;
    accountNumber: string;
    amount: number;
    memo: string;
    accountName?: string | null;
    store?: string;
  }) {
    const query = new URLSearchParams({
      acc: params.accountNumber,
      bank: params.bankName,
      amount: String(Math.round(params.amount)),
      des: params.memo,
      template: 'compact',
      showinfo: 'true',
    });

    if (params.accountName) query.set('holder', params.accountName);
    if (params.store) query.set('store', params.store);

    return `https://vietqr.app/img?${query.toString()}`;
  }

  private async createPaymentRequest(
    tenantId: string,
    sourceType: PaymentSourceType,
    sourceId: string,
    amount: number,
    memoPrefix: string,
    userId?: string,
    metadata?: Prisma.InputJsonValue,
    allocation?: { ownerId?: string | null; buildingId?: string | null; roomId?: string | null },
  ): Promise<PaymentRequestResponse> {
    const sepayConfig = await this.resolveSePayConfig(tenantId);
    const resolved = await this.resolveBankAccount(tenantId, {
      ownerId: allocation?.ownerId,
      roomId: allocation?.roomId,
    });
    const bankAccount = resolved.bankAccount;
    const paymentCodePrefix = String(sepayConfig.paymentCodePrefix || memoPrefix || 'PAY');
    
    // Check if a pending payment request already exists for this source (e.g. invoice)
    const existingPending = await this.prisma.paymentRequest.findFirst({
      where: {
        tenantId,
        sourceType,
        sourceId,
        status: PaymentRequestStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    const roomContext = allocation?.roomId || allocation?.buildingId
      ? { roomId: allocation?.roomId || null, buildingId: allocation?.buildingId || null }
      : {};

    if (existingPending) {
      const memo = existingPending.paymentCode;
      const qrUrl = this.buildQrUrl({
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
        amount,
        memo,
        accountName: bankAccount.accountName,
        store: 'HomeLand',
      });

      const updated = await this.prisma.paymentRequest.update({
        where: { id: existingPending.id },
        data: {
          amount,
          bankAccountId: bankAccount.id,
          bankName: bankAccount.bankName,
          bankAccountNumber: bankAccount.accountNumber,
          bankAccountName: bankAccount.accountName,
          qrUrl,
          metadata: {
            ...((existingPending.metadata as object) || {}),
            ...(metadata && typeof metadata === 'object' ? metadata : {}),
            ...roomContext,
            sepayRoutingSource: resolved.source,
            sepayRoomRouting: resolved.roomRoute || null,
          },
        },
      });

      return {
        id: updated.id,
        sourceType: updated.sourceType,
        sourceId: updated.sourceId,
        paymentCode: updated.paymentCode,
        amount: Number(updated.amount),
        bankName: updated.bankName,
        bankAccountNumber: updated.bankAccountNumber,
        bankAccountName: updated.bankAccountName,
        qrUrl: updated.qrUrl,
        status: updated.status,
        provider: updated.provider,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    }

    // Generate clean concise payment code (e.g. HD-3101-0826 or HD31010826)
    let paymentCode = randomCode(paymentCodePrefix, tenantId);
    if (sourceType === PaymentSourceType.INVOICE) {
      const roomRaw = String((metadata as any)?.roomCode || (metadata as any)?.roomNumber || '').replace(/[^a-zA-Z0-9]/g, '');
      const cleanRoom = roomRaw.slice(-4) || '3101';
      const now = new Date();
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`;
      paymentCode = `HD-${cleanRoom}-${monthYear}`;
    }

    // Ensure paymentCode is unique for this tenant
    const existingCode = await this.prisma.paymentRequest.findUnique({
      where: { tenantId_paymentCode: { tenantId, paymentCode } },
    });
    if (existingCode) {
      let counter = 1;
      let candidateCode = `${paymentCode}-${counter}`;
      while (await this.prisma.paymentRequest.findUnique({ where: { tenantId_paymentCode: { tenantId, paymentCode: candidateCode } } })) {
        counter++;
        candidateCode = `${paymentCode}-${counter}`;
      }
      paymentCode = candidateCode;
    }

    const memo = paymentCode;
    const qrUrl = this.buildQrUrl({
      bankName: bankAccount.bankName,
      accountNumber: bankAccount.accountNumber,
      amount,
      memo,
      accountName: bankAccount.accountName,
      store: 'HomeLand',
    });

    const request = await this.prisma.paymentRequest.create({
      data: {
        tenantId,
        ownerId: allocation?.ownerId || bankAccount.ownerId || null,
        buildingId: allocation?.buildingId || null,
        roomId: allocation?.roomId || null,
        bankAccountId: bankAccount.id,
        sourceType,
        sourceId,
        provider: PaymentProvider.SEPAY,
        paymentCode,
        amount,
        bankName: bankAccount.bankName,
        bankAccountNumber: bankAccount.accountNumber,
        bankAccountName: bankAccount.accountName,
        qrUrl,
        metadata: {
          ...(metadata && typeof metadata === 'object' ? metadata : {}),
          ...roomContext,
          sepayRoutingSource: resolved.source,
          sepayRoomRouting: resolved.roomRoute || null,
        },
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      module: 'Payments',
      entity: 'PaymentRequest',
      entityId: request.id,
      tenantId,
      userId,
      after: {
        amount,
        paymentCode,
        sourceType,
        sourceId,
        bankAccountId: bankAccount.id,
        bankAccountNumber: bankAccount.accountNumber,
      },
    });

    await this.logPaymentAudit(
      tenantId,
      'PaymentRequestCreated',
      request.id,
      {},
      {
        sourceType,
        sourceId,
        amount,
        paymentCode,
        bankName: bankAccount.bankName,
        bankAccountNumber: bankAccount.accountNumber,
        bankAccountName: bankAccount.accountName,
      },
      userId,
    );

    return {
      id: request.id,
      sourceType: request.sourceType,
      sourceId: request.sourceId,
      paymentCode: request.paymentCode,
      amount: Number(request.amount),
      bankName: request.bankName,
      bankAccountNumber: request.bankAccountNumber,
      bankAccountName: request.bankAccountName,
      qrUrl: request.qrUrl,
      status: request.status,
      provider: request.provider,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  async createInvoiceRequest(invoiceId: string, userId: string) {
    const invoice = await this.invoicesService.getDetail(invoiceId);
    const remaining = Math.max(
      0,
      Number(invoice.total) - Number(invoice.paidAmount || 0) - Number(invoice.creditAmount || 0),
    );

    if (remaining <= 0) {
      throw new BadRequestException('Hóa đơn này không còn số tiền cần thanh toán.');
    }

    // Resolve room and building context
    let room = invoice.contract?.room;
    let building = room?.building;
    if (!room && invoice.customerId) {
      const contract = await this.prisma.contract.findFirst({
        where: { customerId: invoice.customerId, tenantId: invoice.tenantId },
        include: { room: { include: { building: true, floor: true } } },
        orderBy: { createdAt: 'desc' },
      });
      if (contract?.room) {
        room = contract.room;
        building = contract.room.building;
      }
    }

    return this.createPaymentRequest(
      invoice.tenantId,
      PaymentSourceType.INVOICE,
      invoice.id,
      remaining,
      'INV',
      userId,
      {
        invoiceCode: invoice.code,
        customerId: invoice.customerId,
        createdBy: userId,
        roomCode: room?.code || room?.number || '',
        roomNumber: room?.number || room?.code || '',
        buildingName: building?.name || '',
        ...buildRoomContext(room, invoice.contract),
      },
      {
        ownerId: building?.ownerId,
        buildingId: room?.buildingId,
        roomId: room?.id,
      },
    );
  }

  async sendInvoiceRequestToZalo(invoiceId: string, userId: string) {
    const invoice = await this.invoicesService.getDetail(invoiceId);
    const customerPhone = invoice.customer?.phone || '';
    const zaloRecipient = this.resolveZaloRecipient(invoice.customer);
    const request = await this.createInvoiceRequest(invoiceId, userId);

    // Format date in Vietnam timezone dd/MM/yyyy
    let dueDateFormatted = '--/--/----';
    if (invoice.dueDate) {
      const d = new Date(invoice.dueDate);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        dueDateFormatted = `${day}/${month}/${year}`;
      }
    }

    // Format amount with thousand separators
    const amountFormatted = new Intl.NumberFormat('vi-VN').format(Number(request.amount));

    // Format item breakdowns with icons using description or name
    const items = (invoice.items || []).map((item: any) => {
      const amt = Number(item.amount || 0);
      const isFree = amt === 0;
      const formattedAmt = isFree ? 'Miễn phí' : `${new Intl.NumberFormat('vi-VN').format(Math.abs(amt))} đ`;
      const name = item.description || item.name || 'Khoản thu';
      const nameLower = name.toLowerCase();
      const icon = nameLower.includes('điện')
        ? '⚡'
        : nameLower.includes('nước')
        ? '💧'
        : nameLower.includes('wifi') || nameLower.includes('rác') || nameLower.includes('vệ sinh')
        ? '📶'
        : nameLower.includes('giảm') || amt < 0
        ? '🎁'
        : '🏢';
      const prefix = amt < 0 ? '-' : '';
      return `${icon} ${name}: ${prefix}${formattedAmt}`;
    });

    const itemsSummary = items.length > 0 ? items.join('\n') : `🏢 Tiền thuê phòng: ${amountFormatted} đ`;

    // Resolve room and building name
    let room = invoice.contract?.room;
    let building = room?.building;
    if (!room && invoice.customerId) {
      const contract = await this.prisma.contract.findFirst({
        where: { customerId: invoice.customerId, tenantId: invoice.tenantId },
        include: { room: { include: { building: true, floor: true } } },
        orderBy: { createdAt: 'desc' },
      });
      if (contract?.room) {
        room = contract.room;
        building = contract.room.building;
      }
    }

    const roomCode = room?.number || room?.code || 'PN 31-01';
    const buildingName = building?.name || building?.code || '';
    const roomAndBuilding = buildingName ? `${roomCode} - ${buildingName}` : roomCode;
    const periodStr = invoice.period || (invoice.createdAt ? `Tháng ${String(new Date(invoice.createdAt).getMonth() + 1).padStart(2, '0')}/${new Date(invoice.createdAt).getFullYear()}` : 'Tháng hiện tại');

    await this.communicationService.dispatchDirect({
      tenantId: invoice.tenantId,
      channel: NotificationChannel.ZALO,
      templateCode: 'INVOICE_ZALO_PAYMENT_REQUEST',
      recipient: zaloRecipient,
      userId: invoice.customerId,
      context: {
        invoiceCode: invoice.code,
        customerName: invoice.customer?.fullName || 'Khách hàng',
        customerPhone,
        zaloChatId: invoice.customer?.zaloChatId || null,
        zaloUserId: invoice.customer?.zaloUserId || null,
        roomCode,
        buildingName,
        roomAndBuilding,
        period: periodStr,
        amount: amountFormatted,
        rawAmount: Number(request.amount),
        itemsSummary,
        paymentCode: request.paymentCode,
        qrUrl: request.qrUrl,
        bankName: request.bankName,
        bankAccountNumber: request.bankAccountNumber,
        accountHolder: request.bankAccountName || 'HOMELAND MANAGEMENT',
        dueDate: dueDateFormatted,
        sentAt: new Date(),
        ...buildRoomContext(room, invoice.contract),
      },
    });

    await this.logPaymentAudit(
      invoice.tenantId,
      'PaymentRequestDispatch',
      request.id,
      {
        sourceType: request.sourceType,
        sourceId: request.sourceId,
        channel: null,
      },
      {
        sourceType: request.sourceType,
        sourceId: request.sourceId,
        channel: NotificationChannel.ZALO,
        recipient: zaloRecipient,
        paymentCode: request.paymentCode,
      },
      userId,
    );

    return request;
  }

  async createDepositRequest(depositId: string, userId: string) {
    const deposit = await this.depositsService.getDetail(depositId);

    if (deposit.status === 'CANCELLED') {
      throw new BadRequestException('Phiếu cọc đã bị hủy.');
    }

    return this.createPaymentRequest(
      deposit.tenantId,
      PaymentSourceType.DEPOSIT,
      deposit.id,
      Number(deposit.amount),
      'DEP',
      userId,
      {
        depositCode: deposit.code,
        customerId: deposit.customerId,
        createdBy: userId,
        ...buildRoomContext(deposit.room, deposit.contract),
      },
      {
        ownerId: deposit.room?.building?.ownerId,
        buildingId: deposit.room?.buildingId,
        roomId: deposit.roomId,
      },
    );
  }

  async sendDepositRequestToZalo(depositId: string, userId: string) {
    const deposit = await this.depositsService.getDetail(depositId);
    const customerPhone = deposit.customer?.phone || '';
    const zaloRecipient = this.resolveZaloRecipient(deposit.customer);
    const request = await this.createDepositRequest(depositId, userId);

    await this.communicationService.dispatchDirect({
      tenantId: deposit.tenantId,
      channel: NotificationChannel.ZALO,
      templateCode: 'DEPOSIT_ZALO_PAYMENT_REQUEST',
      recipient: zaloRecipient,
      userId: deposit.customerId,
      context: {
        depositCode: deposit.code,
        customerName: deposit.customer?.fullName || 'Khách hàng',
        customerPhone,
        zaloChatId: deposit.customer?.zaloChatId || null,
        zaloUserId: deposit.customer?.zaloUserId || null,
        amount: Number(request.amount),
        paymentCode: request.paymentCode,
        qrUrl: request.qrUrl,
        bankName: request.bankName,
        bankAccountNumber: request.bankAccountNumber,
        sentAt: new Date(),
        ...buildRoomContext(deposit.room, deposit.contract),
      },
    });

    await this.logPaymentAudit(
      deposit.tenantId,
      'PaymentRequestDispatch',
      request.id,
      {
        sourceType: request.sourceType,
        sourceId: request.sourceId,
        channel: null,
      },
      {
        sourceType: request.sourceType,
        sourceId: request.sourceId,
        channel: NotificationChannel.ZALO,
        recipient: zaloRecipient,
        paymentCode: request.paymentCode,
      },
      userId,
    );

    return request;
  }

  async getRequest(id: string, tenantId: string) {
    const request = await this.prisma.paymentRequest.findFirst({
      where: { id, tenantId },
    });

    if (!request) throw new BadRequestException('Không tìm thấy payment request');

    return request;
  }

  async manualAssignSePayTransaction(
    tenantId: string,
    userId: string,
    payload: { logId: string; sourceType: PaymentSourceType; sourceCode: string },
  ) {
    const log = await this.prisma.paymentWebhookLog.findFirst({
      where: {
        id: payload.logId,
      },
    });
    if (!log) {
      throw new BadRequestException('Không tìm thấy giao dịch SePay cần gán.');
    }

    const rawPayload = log.payload as SePayWebhookPayload;
    const paymentCode = this.resolveWebhookPaymentCode(rawPayload);
    if (!paymentCode) {
      throw new BadRequestException('Giao dịch không có payment code để gán thủ công.');
    }

    const transferType = String(rawPayload.transferType || rawPayload.transfer_type || '').toLowerCase();
    if (transferType === 'debit' || transferType === 'out') {
      throw new BadRequestException('Không thể gán giao dịch ra.');
    }

    const transactionId = this.resolveWebhookTransactionId(rawPayload);
    const providerAmount = Number(rawPayload.transferAmount ?? rawPayload.amount ?? 0);
    const accountNumber = String(rawPayload.accountNumber || rawPayload.account_number || rawPayload.bank_account_xid || '').trim();

    if (!providerAmount || providerAmount <= 0) {
      throw new BadRequestException('Số tiền giao dịch không hợp lệ.');
    }

    const existingRequest = await this.prisma.paymentRequest.findFirst({
      where: {
        tenantId,
        paymentCode,
      },
    });

    if (existingRequest?.status === PaymentRequestStatus.CONFIRMED && existingRequest.providerTransactionId !== transactionId) {
      throw new BadRequestException('Payment code này đã được xác nhận bởi giao dịch khác.');
    }

    if (payload.sourceType === PaymentSourceType.INVOICE) {
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          tenantId,
          code: payload.sourceCode,
          deletedAt: null,
        },
        include: {
          contract: {
            include: {
              room: {
                include: {
                  building: true,
                },
              },
            },
          },
        },
      });
      if (!invoice) {
        throw new BadRequestException('Không tìm thấy hóa đơn để gán.');
      }

      const remaining = Number(invoice.total || 0) - Number(invoice.paidAmount || 0) - Number(invoice.creditAmount || 0);
      if (providerAmount > remaining) {
        throw new BadRequestException(`Số tiền giao dịch vượt số dư hóa đơn ${remaining}. Hãy xử lý thừa tiền ở bước riêng.`);
      }

      const bankAccount = accountNumber
        ? await this.prisma.bankAccount.findFirst({ where: { tenantId, accountNumber } })
        : (await this.resolveBankAccount(tenantId, { ownerId: invoice.contract?.room?.building?.ownerId })).bankAccount;

      const request =
        existingRequest ||
        (await this.prisma.paymentRequest.create({
          data: {
            tenantId,
            ownerId: invoice.contract?.room?.building?.ownerId || null,
            buildingId: invoice.contract?.room?.buildingId || null,
            roomId: invoice.contract?.roomId || null,
            bankAccountId: bankAccount?.id || null,
            sourceType: PaymentSourceType.INVOICE,
            sourceId: invoice.id,
            provider: PaymentProvider.SEPAY,
            paymentCode,
            amount: providerAmount,
            bankName: bankAccount?.bankName || String(rawPayload.gateway || 'SEPAY'),
            bankAccountNumber: accountNumber || bankAccount?.accountNumber || '',
            bankAccountName: bankAccount?.accountName || null,
            qrUrl: '',
            metadata: {
              manualAssigned: true,
              sourceCode: payload.sourceCode,
              logId: payload.logId,
              assignedBy: userId,
              ...buildRoomContext(invoice.contract?.room, invoice.contract),
            },
          },
        }));

      if (existingRequest) {
        await this.prisma.paymentRequest.update({
          where: { id: existingRequest.id },
          data: {
            sourceType: PaymentSourceType.INVOICE,
            sourceId: invoice.id,
            amount: providerAmount,
            ownerId: invoice.contract?.room?.building?.ownerId || null,
            buildingId: invoice.contract?.room?.buildingId || null,
            roomId: invoice.contract?.roomId || null,
            bankAccountId: bankAccount?.id || existingRequest.bankAccountId || null,
            bankName: bankAccount?.bankName || existingRequest.bankName,
            bankAccountNumber: accountNumber || existingRequest.bankAccountNumber,
            bankAccountName: bankAccount?.accountName || existingRequest.bankAccountName,
            metadata: {
              manualAssigned: true,
              sourceCode: payload.sourceCode,
              logId: payload.logId,
              assignedBy: userId,
            },
          },
        });
      }

      await this.invoicesService.pay(invoice.id, providerAmount, 'SEPAY', transactionId, userId);

      await this.prisma.paymentRequest.update({
        where: { id: request.id },
        data: {
          status: PaymentRequestStatus.CONFIRMED,
          providerTransactionId: transactionId,
          paidAt: new Date(),
        },
      });
    } else if (payload.sourceType === PaymentSourceType.DEPOSIT) {
      const deposit = await this.prisma.deposit.findFirst({
        where: {
          tenantId,
          code: payload.sourceCode,
          deletedAt: null,
        },
        include: {
          room: {
            include: {
              building: true,
            },
          },
        },
      });
      if (!deposit) {
        throw new BadRequestException('Không tìm thấy phiếu cọc để gán.');
      }

      if (providerAmount !== Number(deposit.amount || 0)) {
        throw new BadRequestException(`Số tiền giao dịch phải đúng bằng tiền cọc ${Number(deposit.amount || 0)}.`);
      }

      const bankAccount = accountNumber
        ? await this.prisma.bankAccount.findFirst({ where: { tenantId, accountNumber } })
        : (await this.resolveBankAccount(tenantId, { ownerId: deposit.room?.building?.ownerId })).bankAccount;

      const request =
        existingRequest ||
        (await this.prisma.paymentRequest.create({
          data: {
            tenantId,
            ownerId: deposit.room?.building?.ownerId || null,
            buildingId: deposit.room?.buildingId || null,
            roomId: deposit.roomId,
            bankAccountId: bankAccount?.id || null,
            sourceType: PaymentSourceType.DEPOSIT,
            sourceId: deposit.id,
            provider: PaymentProvider.SEPAY,
            paymentCode,
            amount: providerAmount,
            bankName: bankAccount?.bankName || String(rawPayload.gateway || 'SEPAY'),
            bankAccountNumber: accountNumber || bankAccount?.accountNumber || '',
            bankAccountName: bankAccount?.accountName || null,
            qrUrl: '',
            metadata: {
              manualAssigned: true,
              sourceCode: payload.sourceCode,
              logId: payload.logId,
              assignedBy: userId,
              ...buildRoomContext(deposit.room),
            },
          },
        }));

      if (existingRequest) {
        await this.prisma.paymentRequest.update({
          where: { id: existingRequest.id },
          data: {
            sourceType: PaymentSourceType.DEPOSIT,
            sourceId: deposit.id,
            amount: providerAmount,
            ownerId: deposit.room?.building?.ownerId || null,
            buildingId: deposit.room?.buildingId || null,
            roomId: deposit.roomId,
            bankAccountId: bankAccount?.id || existingRequest.bankAccountId || null,
            bankName: bankAccount?.bankName || existingRequest.bankName,
            bankAccountNumber: accountNumber || existingRequest.bankAccountNumber,
            bankAccountName: bankAccount?.accountName || existingRequest.bankAccountName,
            metadata: {
              manualAssigned: true,
              sourceCode: payload.sourceCode,
              logId: payload.logId,
              assignedBy: userId,
            },
          },
        });
      }

      await this.depositsService.collect(deposit.id, `Manual SePay assignment ${transactionId}`, userId);

      await this.prisma.paymentRequest.update({
        where: { id: request.id },
        data: {
          status: PaymentRequestStatus.CONFIRMED,
          providerTransactionId: transactionId,
          paidAt: new Date(),
        },
      });
    } else {
      throw new BadRequestException('Loại nguồn thanh toán không hỗ trợ.');
    }

    await this.markSePayWebhookLog(log.id, 'PROCESSED', { tenantId });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      module: 'Payments',
      entity: 'SePayManualAssignment',
      entityId: log.id,
      tenantId,
      userId,
      before: {
        logId: log.id,
        paymentCode,
        sourceType: existingRequest?.sourceType || null,
        sourceId: existingRequest?.sourceId || null,
      },
      after: {
        logId: log.id,
        paymentCode,
        sourceType: payload.sourceType,
        sourceCode: payload.sourceCode,
        amount: providerAmount,
        transactionId,
      },
    });

    return {
      success: true,
      paymentCode,
      sourceType: payload.sourceType,
      sourceCode: payload.sourceCode,
      amount: providerAmount,
    };
  }

  async resolveSePayOverpayment(
    tenantId: string,
    userId: string,
    payload: { logId: string; resolution: 'CREDIT_BALANCE' | 'CARRY_FORWARD' | 'REFUND_PENDING' },
  ) {
    const log = await this.prisma.paymentWebhookLog.findFirst({
      where: { id: payload.logId, tenantId },
    });
    if (!log) {
      throw new BadRequestException('Không tìm thấy log SePay cần xử lý.');
    }

    const rawPayload = log.payload as any;
    const paymentCode = this.resolveWebhookPaymentCode(rawPayload);
    if (!paymentCode) {
      throw new BadRequestException('Log SePay không có payment code hợp lệ.');
    }

    const request = await this.prisma.paymentRequest.findFirst({
      where: {
        tenantId,
        provider: PaymentProvider.SEPAY,
        paymentCode,
      },
      include: {
        owner: true,
      },
    });
    if (!request) {
      throw new BadRequestException('Không tìm thấy payment request tương ứng.');
    }
    if (request.sourceType !== PaymentSourceType.INVOICE && request.sourceType !== PaymentSourceType.DEPOSIT) {
      throw new BadRequestException('Nguồn thanh toán này chưa hỗ trợ xử lý tiền thừa.');
    }

    const providerAmount = Number(rawPayload.transferAmount ?? rawPayload.amount ?? 0);
    const requestedAmount = Number(request.amount || 0);
    const overpaidAmount = providerAmount - requestedAmount;
    if (overpaidAmount <= 0) {
      throw new BadRequestException('Giao dịch này không có tiền thừa để xử lý.');
    }

    const existingResolution = (request.metadata as any)?.overpaymentResolution || rawPayload?.overpaymentResolution;
    if (existingResolution) {
      throw new BadRequestException('Tiền thừa của giao dịch này đã được xử lý.');
    }

    const metadata = {
      ...((request.metadata as any) || {}),
      overpaymentResolution: payload.resolution,
      overpaymentAmount: overpaidAmount,
      overpaymentResolvedBy: userId,
      overpaymentResolvedAt: new Date().toISOString(),
      overpaymentLogId: payload.logId,
    };

    let pendingRefundTask: { id: string; title: string } | null = null;
    if (payload.resolution === 'REFUND_PENDING') {
      const title =
        request.sourceType === PaymentSourceType.INVOICE
          ? `Hoàn lại tiền thừa SePay cho hóa đơn ${request.sourceId}`
          : `Hoàn lại tiền thừa SePay cho phiếu cọc ${request.sourceId}`;

      pendingRefundTask = await this.prisma.task.create({
        data: {
          tenantId,
          title,
          description: `Payment code ${paymentCode} thừa ${overpaidAmount} đ. Cần xử lý hoàn lại tiền cho khách.`,
          status: 'TODO' as any,
          priority: 'HIGH' as any,
        },
      });
      (metadata as any).overpaymentTaskId = pendingRefundTask.id;
      (metadata as any).overpaymentTaskTitle = pendingRefundTask.title;
    } else {
      let customerId = '';
      let sourceInvoiceId: string | null = null;
      if (request.sourceType === PaymentSourceType.INVOICE) {
        const invoice = await this.prisma.invoice.findFirst({
          where: { tenantId, id: request.sourceId, deletedAt: null },
          select: {
            id: true,
            customerId: true,
            code: true,
          },
        });
        if (!invoice) {
          throw new BadRequestException('Không tìm thấy hóa đơn gốc để tạo dư có.');
        }
        customerId = invoice.customerId;
        sourceInvoiceId = invoice.id;
      } else {
        const deposit = await this.prisma.deposit.findFirst({
          where: { tenantId, id: request.sourceId, deletedAt: null },
          select: {
            id: true,
            customerId: true,
            code: true,
          },
        });
        if (!deposit) {
          throw new BadRequestException('Không tìm thấy phiếu cọc gốc để tạo dư có.');
        }
        customerId = deposit.customerId;
      }

      const creditNote = await this.prisma.creditNote.create({
        data: {
          tenantId,
          customerId,
          sourceInvoiceId,
          amount: overpaidAmount,
          remainingAmount: overpaidAmount,
          reason:
            payload.resolution === 'CARRY_FORWARD'
              ? `SePay overpayment ${paymentCode} - carry forward`
              : `SePay overpayment ${paymentCode} - credit balance`,
        },
      });

      await this.createOverpaymentJournalEntry(
        tenantId,
        creditNote.id,
        paymentCode,
        overpaidAmount,
        payload.resolution,
      );
    }

    await this.prisma.paymentRequest.update({
      where: { id: request.id },
      data: {
        metadata: metadata as any,
      },
    });

    await this.prisma.paymentWebhookLog.update({
      where: { id: log.id },
      data: {
        payload: {
          ...rawPayload,
          overpaymentResolution: payload.resolution,
          overpaymentAmount: overpaidAmount,
          overpaymentResolvedBy: userId,
          overpaymentResolvedAt: new Date().toISOString(),
          overpaymentTaskId: pendingRefundTask?.id || null,
          overpaymentTaskTitle: pendingRefundTask?.title || null,
        } as any,
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      module: 'Payments',
      entity: 'SePayOverpaymentResolution',
      entityId: request.id,
      tenantId,
      userId,
      before: {
        requestId: request.id,
        paymentCode,
        resolution: existingResolution || null,
        amount: requestedAmount,
      },
      after: {
        requestId: request.id,
        paymentCode,
        resolution: payload.resolution,
        overpaidAmount,
        ownerId: request.ownerId || null,
      },
    });

    return {
      success: true,
      paymentCode,
      resolution: payload.resolution,
      overpaidAmount,
    };
  }

  async completeSePayOverpaymentRefund(
    tenantId: string,
    userId: string,
    payload: { logId: string; note?: string },
  ) {
    const log = await this.prisma.paymentWebhookLog.findFirst({
      where: { id: payload.logId, tenantId },
    });
    if (!log) {
      throw new BadRequestException('Không tìm thấy log SePay cần hoàn tất.');
    }

    const rawPayload = (log.payload as any) || {};
    const paymentCode = this.resolveWebhookPaymentCode(rawPayload);
    if (!paymentCode) {
      throw new BadRequestException('Log SePay không có payment code hợp lệ.');
    }

    const request = await this.prisma.paymentRequest.findFirst({
      where: {
        tenantId,
        provider: PaymentProvider.SEPAY,
        paymentCode,
      },
    });
    if (!request) {
      throw new BadRequestException('Không tìm thấy payment request tương ứng.');
    }

    const requestMetadata = (request.metadata as any) || {};
    if (requestMetadata.overpaymentResolution !== 'REFUND_PENDING') {
      throw new BadRequestException('Giao dịch này không ở trạng thái chờ hoàn tiền thừa.');
    }
    if (requestMetadata.overpaymentRefundCompletedAt) {
      throw new BadRequestException('Khoản hoàn tiền thừa này đã được xác nhận hoàn tất.');
    }

    const taskTitle =
      requestMetadata.overpaymentTaskTitle ||
      (request.sourceType === PaymentSourceType.INVOICE
        ? `Hoàn lại tiền thừa SePay cho hóa đơn ${request.sourceId}`
        : `Hoàn lại tiền thừa SePay cho phiếu cọc ${request.sourceId}`);

    const task = await this.prisma.task.findFirst({
      where: {
        tenantId,
        ...(requestMetadata.overpaymentTaskId ? { id: requestMetadata.overpaymentTaskId } : { title: taskTitle }),
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!task) {
      throw new BadRequestException('Không tìm thấy tác vụ hoàn tiền thừa cần hoàn tất.');
    }

    const completionNote = String(payload.note || '').trim();
    const completedAtIso = new Date().toISOString();
    const nextMetadata = {
      ...requestMetadata,
      overpaymentRefundCompletedAt: completedAtIso,
      overpaymentRefundCompletedBy: userId,
      overpaymentRefundCompletionNote: completionNote || null,
    };

    const updatedTask = await this.prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'DONE' as any,
        description: completionNote
          ? `${task.description || ''}\nHoàn tất hoàn dư: ${completionNote}`.trim()
          : task.description,
      },
    });

    await this.prisma.paymentRequest.update({
      where: { id: request.id },
      data: {
        metadata: nextMetadata as any,
      },
    });

    await this.prisma.paymentWebhookLog.update({
      where: { id: log.id },
      data: {
        payload: {
          ...rawPayload,
          overpaymentResolution: 'REFUND_PENDING',
          overpaymentRefundCompletedAt: completedAtIso,
          overpaymentRefundCompletedBy: userId,
          overpaymentRefundCompletionNote: completionNote || null,
          overpaymentTaskId: task.id,
          overpaymentTaskTitle: task.title,
        } as any,
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      module: 'Payments',
      entity: 'SePayOverpaymentRefundCompletion',
      entityId: request.id,
      tenantId,
      userId,
      before: {
        requestId: request.id,
        paymentCode,
        resolution: requestMetadata.overpaymentResolution,
        refundCompletedAt: requestMetadata.overpaymentRefundCompletedAt || null,
      },
      after: {
        requestId: request.id,
        paymentCode,
        resolution: requestMetadata.overpaymentResolution,
        refundCompletedAt: completedAtIso,
        taskId: updatedTask.id,
      },
    });

    return {
      success: true,
      paymentCode,
      taskId: updatedTask.id,
      overpaymentAmount: Number(requestMetadata.overpaymentAmount || 0),
      completedAt: completedAtIso,
    };
  }

  private resolveWebhookTransactionId(payload: SePayWebhookPayload) {
    return String(payload.transaction_id || payload.id || '');
  }

  private resolveWebhookPaymentCode(payload: SePayWebhookPayload) {
    const explicitCode = String(payload.code || payload.payment_code || '').trim();
    if (explicitCode) return explicitCode;

    const text = String(payload.content || payload.description || '').toUpperCase();
    const match = text.match(/[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+/);
    return match?.[0] || '';
  }

  private async claimSePayWebhookLog(logId: string) {
    const claimed = await this.prisma.paymentWebhookLog.updateMany({
      where: {
        id: logId,
        processedAt: null,
        status: { in: ['RECEIVED', 'FAILED'] as any },
      } as any,
      data: {
        status: 'PROCESSING' as any,
        processingStartedAt: new Date(),
        lastError: null,
        attemptCount: { increment: 1 },
      } as any,
    });

    return claimed.count === 1;
  }

  private async markSePayWebhookLog(
    logId: string,
    status: 'PROCESSED' | 'IGNORED' | 'NEEDS_REVIEW' | 'FAILED',
    data: { tenantId?: string | null; error?: string | null } = {},
  ) {
    await this.prisma.paymentWebhookLog.update({
      where: { id: logId },
      data: {
        status: status as any,
        tenantId: data.tenantId ?? undefined,
        processedAt: status === 'FAILED' ? undefined : new Date(),
        lastError: data.error ?? null,
      } as any,
    });
  }

  async getSePayStatus(tenantId: string) {
    const settings = await this.resolveSePayConfig(tenantId);
    const latestWebhook = await this.prisma.paymentWebhookLog.findFirst({
      where: { provider: PaymentProvider.SEPAY },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        processedAt: true,
        lastError: true,
        payload: true,
      },
    });
    const routing = await this.resolveRoutingSettings(tenantId);
    return {
      enabled: settings.enabled !== false,
      authMode: this.normalizeSePayAuthMode(settings.authMode),
      webhookUrl: `${String(process.env.APP_URL || '').replace(/\/+$/, '')}/api/v1/payments/sepay/webhook`,
      webhookApiKeyConfigured: Boolean(String(settings.webhookApiKey || '').trim()),
      hmacSecretConfigured: Boolean(String(settings.hmacSecret || '').trim()),
      paymentCodePrefix: String(settings.paymentCodePrefix || '').trim() || 'PAY',
      sendPaymentResultToZalo: settings.sendPaymentResultToZalo !== false,
      routingAssignments: Array.isArray(routing.assignments) ? routing.assignments.length : 0,
      lastWebhookAt: latestWebhook?.createdAt || null,
      lastWebhookStatus: latestWebhook?.status || null,
      lastWebhookProcessedAt: latestWebhook?.processedAt || null,
      lastWebhookError: latestWebhook?.lastError || null,
      lastWebhookAccountNumber: String((latestWebhook?.payload as any)?.accountNumber || (latestWebhook?.payload as any)?.account_number || '').trim() || null,
    };
  }

  async getSePayAdminConfig(tenantId: string): Promise<SePayAdminConfig> {
    const [status, routing, bankAccounts, rooms, owners] = await Promise.all([
      this.getSePayStatus(tenantId),
      this.resolveRoutingSettings(tenantId),
      this.prisma.bankAccount.findMany({
        where: { tenantId },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          ownerId: true,
          bankName: true,
          accountNumber: true,
          accountName: true,
          isActive: true,
        },
      }),
      this.prisma.room.findMany({
        where: { tenantId, deletedAt: null as any },
        orderBy: [{ buildingId: 'asc' }, { code: 'asc' }],
        select: {
          id: true,
          code: true,
          name: true,
          rentalType: true,
          buildingId: true,
          building: {
            select: {
              id: true,
              code: true,
              name: true,
              ownerId: true,
            },
          },
        },
      }),
      this.prisma.owner.findMany({
        where: { tenantId },
        select: { id: true, name: true },
      }),
    ]);
    const assignmentMap = new Map<string, SePayRoutingAssignment>();
    const assignmentList = Array.isArray(routing.assignments) ? routing.assignments : [];
    for (const assignment of assignmentList) {
      if (!assignment?.roomId || !assignment?.bankAccountId) continue;
      const current = assignmentMap.get(assignment.roomId);
      if (!current || this.pickBestRoomAssignment([current, assignment])?.bankAccountId === assignment.bankAccountId) {
        assignmentMap.set(assignment.roomId, assignment);
      }
    }
    const ownerById = new Map(owners.map((owner) => [owner.id, owner.name]));
    const bankAccountById = new Map(bankAccounts.map((bankAccount) => [bankAccount.id, bankAccount]));
    return {
      status,
      routes: assignmentList
        .map((assignment) => {
          const room = rooms.find((candidate) => candidate.id === assignment.roomId);
          const bankAccount = bankAccounts.find((candidate) => candidate.id === assignment.bankAccountId);
          if (!room || !bankAccount) return null;
          return {
            id: assignment.id || `${assignment.roomId}-${assignment.bankAccountId}-${assignment.validFrom || 'na'}`,
            roomId: room.id,
            roomCode: room.code,
            roomName: room.name,
            buildingCode: room.building?.code || '',
            buildingName: room.building?.name || '',
            bankAccountId: bankAccount.id,
            bankAccountLabel: this.formatBankAccountLabel(bankAccount),
            validFrom: assignment.validFrom || new Date(0).toISOString(),
            validTo: assignment.validTo || null,
            note: assignment.note || null,
            isActive: this.isRoutingAssignmentActive(assignment),
          };
        })
        .filter((route): route is NonNullable<typeof route> => Boolean(route)),
      bankAccounts: bankAccounts.map((bankAccount) => ({
        ...bankAccount,
        ownerName: bankAccount.ownerId ? ownerById.get(bankAccount.ownerId) || null : null,
        label: this.formatBankAccountLabel(bankAccount),
      })),
      rooms: await Promise.all(
        rooms.map(async (room) => {
          const resolved = await this.resolveBankAccount(tenantId, {
            ownerId: room.building?.ownerId || null,
            roomId: room.id,
          });
          const assignment = assignmentMap.get(room.id) || null;
          const mappedBankAccount = assignment?.bankAccountId ? bankAccountById.get(assignment.bankAccountId) || null : null;
          return {
            id: room.id,
            code: room.code,
            name: room.name,
            rentalType: String(room.rentalType),
            buildingId: room.buildingId,
            buildingCode: room.building?.code || '',
            buildingName: room.building?.name || '',
            ownerId: room.building?.ownerId || null,
            mappedBankAccountId: mappedBankAccount?.id || null,
            mappedBankAccountLabel: mappedBankAccount ? this.formatBankAccountLabel(mappedBankAccount) : null,
            mappingSource: resolved.source === 'EXPLICIT' ? 'ROOM' : resolved.source,
            validFrom: assignment?.validFrom || null,
            validTo: assignment?.validTo || null,
          };
        }),
      ),
    };
  }

  async previewSePayQr(
    tenantId: string,
    payload: { amount?: number; memo?: string; roomId?: string; bankAccountId?: string } = {},
  ) {
    const sepayConfig = await this.resolveSePayConfig(tenantId);
    const amount = Math.max(1000, Number(payload.amount || 123000));
    const resolved = await this.resolveBankAccount(tenantId, {
      roomId: payload.roomId || null,
      bankAccountId: payload.bankAccountId || null,
    });
    const bankAccount = resolved.bankAccount;
    const prefix = String(sepayConfig.paymentCodePrefix || 'HL').trim() || 'HL';
    const memo = String(payload.memo || '').trim() || `${prefix}TEST${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    return {
      bankName: bankAccount.bankName,
      bankLabel: this.formatBankAccountLabel(bankAccount),
      bankAccountId: bankAccount.id,
      bankAccountNumber: bankAccount.accountNumber,
      bankAccountNumberMasked: this.maskAccountNumber(bankAccount.accountNumber),
      bankAccountName: bankAccount.accountName,
      amount,
      memo,
      resolvedFrom: resolved.source,
      roomId: resolved.room?.id || null,
      roomCode: resolved.room?.code || null,
      roomName: resolved.room?.name || null,
      rentalType: resolved.room?.rentalType || null,
      buildingName: resolved.room?.buildingName || null,
      qrUrl: this.buildQrUrl({
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        amount,
        memo,
        store: 'HomeLand',
      }),
    };
  }

  async sendPreviewSePayQrToAdminGroup(
    tenantId: string,
    payload: { amount?: number; memo?: string; roomId?: string; bankAccountId?: string },
  ) {
    const zaloSettings = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: 'zalo-provider',
        },
      },
    });
    const adminGroupChatId = String((zaloSettings?.value as any)?.adminGroupChatId || '').trim();
    if (!adminGroupChatId) {
      throw new BadRequestException('Zalo Admin Group chưa được kết nối.');
    }

    const preview = await this.previewSePayQr(tenantId, payload);
    const roomLabel = preview.roomCode ? `${preview.roomCode}${preview.buildingName ? ` • ${preview.buildingName}` : ''}` : 'Không gắn phòng';

    const builtCaption = [
      `QR test SePay • ${roomLabel}`,
      `${preview.bankName} - ${preview.bankAccountNumber}`,
      `${preview.bankAccountName || '-'}`,
      `So tien: ${Math.round(preview.amount).toLocaleString('vi-VN')} đ`,
      `ND: ${preview.memo}`,
    ].join('\n');

    const result = await this.zaloProvider.sendPhoto({
      tenantId,
      recipient: adminGroupChatId,
      photo: preview.qrUrl,
      caption: builtCaption,
      context: {},
    });

    return {
      success: true,
      recipient: adminGroupChatId,
      preview,
      result,
    };
  }

  async testSePayReconciliation(tenantId: string, payload: { paymentCode?: string; amount?: number; accountNumber?: string }) {
    const paymentCode = String(payload.paymentCode || '').trim();
    if (!paymentCode) throw new BadRequestException('SEPAY_TEST_PAYMENT_CODE_REQUIRED');

    const request = await this.prisma.paymentRequest.findFirst({
      where: { tenantId, provider: PaymentProvider.SEPAY, paymentCode },
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        status: true,
        amount: true,
        bankAccountNumber: true,
      },
    });
    if (!request) throw new BadRequestException('SEPAY_TEST_PAYMENT_REQUEST_NOT_FOUND');

    const expectedAmount = Number(request.amount || 0);
    const actualAmount = Number(payload.amount ?? expectedAmount);
    const accountNumber = String(payload.accountNumber || request.bankAccountNumber || '').trim();
    return {
      paymentRequestId: request.id,
      sourceType: request.sourceType,
      sourceId: request.sourceId,
      status: request.status,
      expectedAmount,
      actualAmount,
      exactAmount: actualAmount === expectedAmount,
      shortAmount: actualAmount < expectedAmount,
      overpayment: actualAmount > expectedAmount,
      expectedBankAccount: request.bankAccountNumber,
      actualBankAccount: accountNumber,
      bankMatches: !accountNumber || accountNumber === request.bankAccountNumber,
    };
  }

  async handleSePayWebhook(
    payload: SePayWebhookPayload,
    authorizationOrHeaders: string | { authorization?: string; signature?: string; timestamp?: string; rawBody?: string } = {},
  ) {
    const headers = typeof authorizationOrHeaders === 'string'
      ? { authorization: authorizationOrHeaders }
      : authorizationOrHeaders;
    const webhookSettings = await this.prisma.appSetting.findMany({
      where: {
        key: 'sepay',
        scope: SettingScope.TENANT,
      },
      select: {
        tenantId: true,
        value: true,
      },
    });

    const authMatched = webhookSettings.some((setting) => {
      const config = (setting.value as any) || {};
      const authMode = this.normalizeSePayAuthMode(config.authMode);
      if (authMode === 'none') return true;

      const apiKey = String(config.webhookApiKey || '').trim();
      const hmacSecret = String(config.hmacSecret || '').trim();
      const rawAuth = String(headers.authorization || '').trim();
      const apiKeyOk =
        Boolean(apiKey) &&
        (rawAuth === `Apikey ${apiKey}` ||
          rawAuth === `ApiKey ${apiKey}` ||
          rawAuth === `apikey ${apiKey}` ||
          rawAuth === `Bearer ${apiKey}` ||
          rawAuth === apiKey);

      const timestamp = String(headers.timestamp || '').trim();
      const rawBody = String(headers.rawBody || '').trim();
      const signature = String(headers.signature || '').trim();
      const hmacOk =
        Boolean(hmacSecret) &&
        Boolean(timestamp) &&
        Boolean(rawBody) &&
        Boolean(signature) &&
        this.verifySePayTimestamp(timestamp) &&
        this.verifySePayHmac(hmacSecret, timestamp, rawBody, signature);

      if (authMode === 'hmac') return hmacOk;
      if (authMode === 'dual') return apiKeyOk || hmacOk;
      return apiKeyOk;
    });

    if (!authMatched) {
      throw new UnauthorizedException('Unauthorized SePay webhook');
    }

    const transactionId = this.resolveWebhookTransactionId(payload);
    if (!transactionId) {
      return { success: true };
    }

    if (PaymentsService.processingSePayTransactionIds.has(transactionId)) {
      return { success: true };
    }

    PaymentsService.processingSePayTransactionIds.add(transactionId);
    try {
      return await this.processSePayWebhookPayload(payload, transactionId);
    } catch (error: any) {
      await this.prisma.paymentWebhookLog.update({
        where: {
          provider_providerTransactionId: {
            provider: PaymentProvider.SEPAY,
            providerTransactionId: transactionId,
          },
        },
        data: {
          status: 'FAILED' as any,
          lastError: String(error?.message || error || 'Unknown SePay webhook processing error').slice(0, 1000),
        } as any,
      }).catch(() => undefined);
      throw error;
    } finally {
      PaymentsService.processingSePayTransactionIds.delete(transactionId);
    }
  }

  private async processSePayWebhookPayload(payload: SePayWebhookPayload, transactionId: string) {
    const providerAmount = Number(payload.transferAmount ?? payload.amount ?? 0);
    const transferType = String(payload.transferType || payload.transfer_type || '').toLowerCase();
    const paymentCode = this.resolveWebhookPaymentCode(payload);
    const accountNumber = String(payload.accountNumber || payload.account_number || payload.bank_account_xid || '').trim();

    const log = await this.prisma.paymentWebhookLog.upsert({
      where: {
        provider_providerTransactionId: {
          provider: PaymentProvider.SEPAY,
          providerTransactionId: transactionId,
        },
      },
      create: {
        provider: PaymentProvider.SEPAY,
        providerTransactionId: transactionId,
        payload,
        status: 'RECEIVED' as any,
      } as any,
      update: {
        payload,
      } as any,
    });

    if (log.processedAt) {
      return { success: true };
    }

    const claimed = await this.claimSePayWebhookLog(log.id);
    if (!claimed) {
      return { success: true };
    }

    if (!paymentCode || transferType === 'debit' || transferType === 'out') {
      await this.markSePayWebhookLog(log.id, 'IGNORED');
      return { success: true };
    }

    const request = await this.prisma.paymentRequest.findFirst({
      where: {
        provider: PaymentProvider.SEPAY,
        paymentCode,
        ...(accountNumber ? { bankAccountNumber: accountNumber } : {}),
      },
    });
    const requestByCode =
      request ||
      (await this.prisma.paymentRequest.findFirst({
        where: {
          provider: PaymentProvider.SEPAY,
          paymentCode,
        },
      }));

    if (
      !request &&
      requestByCode &&
      requestByCode.status === PaymentRequestStatus.PENDING &&
      accountNumber &&
      requestByCode.bankAccountNumber &&
      requestByCode.bankAccountNumber !== accountNumber
    ) {
      await this.logPaymentAudit(
        requestByCode.tenantId,
        'SePayWebhookMismatch',
        log.id,
        {
          paymentRequestId: requestByCode.id,
          paymentCode,
          bankAccountNumber: requestByCode.bankAccountNumber,
          amount: Number(requestByCode.amount || 0),
          status: requestByCode.status,
        },
        {
          transactionId,
          actualBankAccount: accountNumber,
          actualAmount: providerAmount,
          mismatchType: 'BANK_ACCOUNT',
        },
      );
      await this.notifySePayMismatch(requestByCode.tenantId, {
        title: `SePay sai tài khoản cho mã ${paymentCode}`,
        message: `Webhook SePay nhận vào tài khoản ${accountNumber}, nhưng payment request ${paymentCode} đang chờ trên tài khoản ${requestByCode.bankAccountNumber}.`,
        paymentCode,
        transactionId,
        expectedAmount: Number(requestByCode.amount || 0),
        actualAmount: providerAmount,
        expectedBankAccount: requestByCode.bankAccountNumber,
        actualBankAccount: accountNumber,
      });
    }

    if (!request || request.status !== PaymentRequestStatus.PENDING) {
      await this.markSePayWebhookLog(log.id, 'NEEDS_REVIEW', { tenantId: requestByCode?.tenantId || null });
      return { success: true };
    }

    if (providerAmount < Number(request.amount)) {
      await this.logPaymentAudit(
        request.tenantId,
        'SePayWebhookMismatch',
        log.id,
        {
          paymentRequestId: request.id,
          paymentCode,
          bankAccountNumber: request.bankAccountNumber,
          amount: Number(request.amount || 0),
          status: request.status,
        },
        {
          transactionId,
          actualBankAccount: accountNumber || request.bankAccountNumber,
          actualAmount: providerAmount,
          mismatchType: 'SHORT_AMOUNT',
        },
      );
      await this.notifySePayMismatch(request.tenantId, {
        title: `SePay thiếu tiền cho mã ${paymentCode}`,
        message: `Webhook SePay nhận ${providerAmount.toLocaleString('vi-VN')} VND, thấp hơn số tiền yêu cầu ${Number(request.amount || 0).toLocaleString('vi-VN')} VND.`,
        paymentCode,
        transactionId,
        expectedAmount: Number(request.amount || 0),
        actualAmount: providerAmount,
        expectedBankAccount: request.bankAccountNumber,
        actualBankAccount: accountNumber || request.bankAccountNumber,
      });
      await this.markSePayWebhookLog(log.id, 'NEEDS_REVIEW', { tenantId: request.tenantId });
      return { success: true };
    }

    if (providerAmount > Number(request.amount)) {
      await this.logPaymentAudit(
        request.tenantId,
        'SePayWebhookMismatch',
        log.id,
        {
          paymentRequestId: request.id,
          paymentCode,
          bankAccountNumber: request.bankAccountNumber,
          amount: Number(request.amount || 0),
          status: request.status,
        },
        {
          transactionId,
          actualBankAccount: accountNumber || request.bankAccountNumber,
          actualAmount: providerAmount,
          mismatchType: 'OVERPAYMENT',
        },
      );
      await this.notifySePayMismatch(request.tenantId, {
        title: `SePay thừa tiền cho mã ${paymentCode}`,
        message: `Webhook SePay nhận ${providerAmount.toLocaleString('vi-VN')} VND, cao hơn số tiền yêu cầu ${Number(request.amount || 0).toLocaleString('vi-VN')} VND. Hệ thống sẽ chỉ cấn theo số yêu cầu và chờ xử lý phần thừa.`,
        paymentCode,
        transactionId,
        expectedAmount: Number(request.amount || 0),
        actualAmount: providerAmount,
        expectedBankAccount: request.bankAccountNumber,
        actualBankAccount: accountNumber || request.bankAccountNumber,
      });
    }

    if (request.sourceType === PaymentSourceType.INVOICE) {
      const existingPayment = await this.prisma.payment.findFirst({
        where: {
          tenantId: request.tenantId,
          provider: 'SEPAY',
          providerRef: transactionId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!existingPayment) {
        await this.invoicesService.pay(request.sourceId, Number(request.amount), 'SEPAY', transactionId, 'SEPAY_WEBHOOK');
      }
    } else if (request.sourceType === PaymentSourceType.DEPOSIT) {
      await this.depositsService.collect(request.sourceId, `SePay transaction ${transactionId}`, 'SEPAY_WEBHOOK');
    }

    await this.prisma.paymentRequest.update({
      where: { id: request.id },
      data: {
        status: PaymentRequestStatus.CONFIRMED,
        providerTransactionId: transactionId,
        paidAt: new Date(),
      },
    });

    await this.logPaymentAudit(
      request.tenantId,
      'PaymentRequest',
      request.id,
      {
        status: request.status,
        paymentCode,
        amount: Number(request.amount || 0),
        providerTransactionId: request.providerTransactionId || null,
      },
      {
        status: PaymentRequestStatus.CONFIRMED,
        paymentCode,
        amount: Number(request.amount || 0),
        providerTransactionId: transactionId,
        paidAt: new Date().toISOString(),
      },
      'SEPAY_WEBHOOK',
    );

    await this.markSePayWebhookLog(log.id, providerAmount > Number(request.amount) ? 'NEEDS_REVIEW' : 'PROCESSED', {
      tenantId: request.tenantId,
    });

    return { success: true };
  }
}
