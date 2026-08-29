import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ACTIVE_LIKE_CONTRACT_STATUSES } from '../../contracts/contracts.adapter';
import { ZaloProvider } from '../providers/communication.providers';
import { NormalizedZaloUpdate } from '../adapters/zalo-normalizer';
import { buildAdminGroupConnectedMessage } from './admin-zalo-message-builder';

type RegisterCommand = {
  primaryPhone: string;
  secondaryPhones: string[];
  roomNumber: string;
};

@Injectable()
export class ZaloRegistrationService {
  private readonly logger = new Logger(ZaloRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zaloProvider: ZaloProvider,
  ) {}

  async handleIncomingMessage(
    tenantId: string,
    update: NormalizedZaloUpdate,
    settingsValue: any,
  ) {
    if (!update.chatId || !update.text) {
      return { route: 'ignored', reason: 'MISSING_CHAT_OR_TEXT' };
    }

    const command = String(update.text || '').trim();
    if (isChatIdCommand(command)) {
      const autoBindResult = await this.tryAutoBindAdminGroupFromChatCommand(tenantId, update, settingsValue);
      await this.sendCustomerMessage(
        tenantId,
        update.chatId,
        'HomeLand - Chat ID',
        [
          'HomeLand - Chat ID',
          '',
          `Chat ID: ${update.chatId}`,
          `Chat type: ${update.chatType || 'unknown'}`,
        ].join('\n'),
      );
      return autoBindResult || { route: 'command', action: 'chat_id_echo' };
    }

    const adminGroupSetupResult = await this.trySetAdminGroup(tenantId, update, settingsValue);
    if (adminGroupSetupResult) {
      return adminGroupSetupResult;
    }

    const adminGroupChatId = String(settingsValue?.adminGroupChatId || '').trim();
    if (adminGroupChatId && update.chatId === adminGroupChatId) {
      return { route: 'admin', action: 'ignored' };
    }

    const parsed = parseRegisterCommand(command);
    if (!parsed) {
      if (/^\s*dk\b/i.test(update.text)) {
        await this.sendCustomerMessage(
          tenantId,
          update.chatId,
          'HomeLand - Đăng ký Zalo Bot',
          [
            'Cú pháp đăng ký chưa đúng.',
            'Vui lòng nhắn theo mẫu:',
            'DK <SĐT> <PHÒNG>',
            '',
            'Ví dụ: DK 0567867889 31.06',
          ].join('\n'),
        );
        return { route: 'customer', action: 'syntax_error' };
      }

      return { route: 'customer', action: 'ignored' };
    }

    return this.registerCustomerZalo(tenantId, update, parsed, settingsValue);
  }

  private async registerCustomerZalo(
    tenantId: string,
    update: NormalizedZaloUpdate,
    command: RegisterCommand,
    settingsValue: any,
  ) {
    const room = await this.prisma.room.findFirst({
      where: {
        tenantId,
        code: command.roomNumber,
        deletedAt: null,
      },
      include: {
        building: true,
        roommates: {
          where: { deletedAt: null },
          select: {
            id: true,
            fullName: true,
            phone: true,
            zaloChatId: true,
            zaloUserId: true,
          },
        },
        contracts: {
          where: {
            deletedAt: null,
            status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
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
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!room) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId,
        'HomeLand - Đăng ký Zalo Bot',
        `Không thể đăng ký.\nKhông tìm thấy phòng ${command.roomNumber}.`,
      );
      await this.sendAdminMessage(
        tenantId,
        settingsValue,
        'HomeLand - Đăng ký Bot thất bại',
        `Đăng ký Bot thất bại\nPhòng: ${command.roomNumber}\nSĐT: ${command.primaryPhone}\nLý do: ROOM_NOT_FOUND`,
      );
      return { ok: false, code: 'ROOM_NOT_FOUND' };
    }

    const contracts = Array.isArray(room.contracts) ? room.contracts : [];
    if (contracts.length === 0) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId,
        'HomeLand - Đăng ký Zalo Bot',
        `Không thể đăng ký.\nPhòng ${command.roomNumber} không có hợp đồng đang hoạt động.`,
      );
      return { ok: false, code: 'NO_ACTIVE_CONTRACT', roomId: room.id };
    }

    const matchedContract = contracts.find((contract) =>
      phoneMatches(contract.customer?.phone, command.primaryPhone),
    ) || null;
    const matchedRoommate = matchedContract
      ? null
      : (Array.isArray(room.roommates) ? room.roommates.find((customer) => phoneMatches(customer.phone, command.primaryPhone)) : null) || null;
    const matchedCustomer = matchedContract?.customer || matchedRoommate || null;
    const primaryContract = matchedContract || contracts[0] || null;

    if (!matchedCustomer) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId,
        'HomeLand - Đăng ký Zalo Bot',
        `Không thể xác minh đăng ký.\nSĐT chưa được ghi nhận cho phòng ${command.roomNumber}.`,
      );
      await this.sendAdminMessage(
        tenantId,
        settingsValue,
        'HomeLand - Đăng ký Bot cần kiểm tra',
        `Đăng ký Bot cần kiểm tra\nPhòng: ${command.roomNumber}\nSĐT: ${command.primaryPhone}\nLý do: PHONE_NOT_IN_CONTRACT`,
      );
      return { ok: false, code: 'PHONE_NOT_IN_CONTRACT', roomId: room.id };
    }

    await this.prisma.customer.update({
      where: { id: matchedCustomer.id },
      data: {
        zaloChatId: update.chatId,
        zaloUserId: update.senderId || matchedCustomer.zaloUserId || null,
        zaloPhone: command.primaryPhone,
      },
    });

    await this.sendCustomerMessage(
      tenantId,
      update.chatId,
      'HomeLand - Đăng ký thành công',
      [
        'HomeLand - Đăng ký thành công',
        `Phòng: ${command.roomNumber}`,
        `SĐT: ${command.primaryPhone}`,
        '',
        'Tài khoản Zalo này sẽ nhận thông báo liên quan đến hợp đồng và thanh toán.',
      ].join('\n'),
    );

    await this.sendAdminMessage(
      tenantId,
      settingsValue,
      'HomeLand - Khách đã đăng ký Zalo Bot',
      [
        'Khách đã đăng ký Zalo Bot',
        `Phòng: ${command.roomNumber}`,
        `SĐT: ${command.primaryPhone}`,
        `Chat ID: ${update.chatId}`,
      ].join('\n'),
    );

    this.logger.log({
      message: 'Bound Zalo chat to customer',
      tenantId,
      customerId: matchedCustomer.id,
      contractId: primaryContract?.id || null,
      roomId: room.id,
      chatId: update.chatId,
    });

    return {
      ok: true,
      customerId: matchedCustomer.id,
      roomId: room.id,
      contractId: primaryContract?.id || null,
      roomCode: room.code,
    };
  }

  private async sendCustomerMessage(tenantId: string, chatId: string, title: string, message: string) {
    await this.zaloProvider.send({
      tenantId,
      recipient: chatId,
      title,
      message,
      context: {},
    });
  }

  private async sendAdminMessage(tenantId: string, settingsValue: any, title: string, message: string) {
    const adminGroupChatId = String(settingsValue?.adminGroupChatId || '').trim();
    if (!adminGroupChatId) return;

    await this.zaloProvider.send({
      tenantId,
      recipient: adminGroupChatId,
      title,
      message,
      context: {},
    });
  }

  private async trySetAdminGroup(tenantId: string, update: NormalizedZaloUpdate, settingsValue: any) {
    const parsed = parseSetAdminCommand(update.text);
    if (!parsed) return null;

    const expectedCode = String(settingsValue?.adminSetupCode || '').trim().toUpperCase();
    const expiresAt = String(settingsValue?.adminSetupCodeExpiresAt || '').trim();
    const notExpired = Boolean(expiresAt) && Date.now() <= new Date(expiresAt).getTime();
    const isValid = Boolean(expectedCode) && notExpired && parsed.setupCode.toUpperCase() === expectedCode;

    if (!isValid) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId!,
        'HomeLand - Kết nối nhóm Admin',
        'Mã kết nối nhóm Admin không hợp lệ hoặc đã hết hạn.',
      );
      return { route: 'command', action: 'admin_group_setup_invalid' };
    }

    const setting = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: 'TENANT' as any,
          ownerId: tenantId,
          key: 'zalo-provider',
        },
      },
    });

    if (!setting?.id) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId!,
        'HomeLand - Kết nối nhóm Admin',
        'Chưa tìm thấy cấu hình Zalo để lưu nhóm Admin.',
      );
      return { route: 'command', action: 'admin_group_settings_missing' };
    }

    const currentValue = ((setting.value as any) || {});
    const nextValue = {
      ...currentValue,
      adminGroupChatId: update.chatId,
      adminGroupConnectedAt: new Date().toISOString(),
      adminSetupCode: null,
      adminSetupCodeExpiresAt: null,
      adminSetupCodePending: null,
      lastWebhookChatId: update.chatId,
      lastWebhookChatType: update.chatType || 'unknown',
      lastWebhookSenderId: update.senderId || null,
      lastWebhookEventName: update.eventName || 'admin_group_setup',
      lastWebhookReceivedAt: new Date().toISOString(),
    };

    await this.prisma.appSetting.update({
      where: { id: setting.id },
      data: {
        value: nextValue,
      },
    });

    const connectedMessage = buildAdminGroupConnectedMessage({
      chatId: update.chatId!,
      senderId: update.senderId || null,
      connectedAt: new Date(),
      domain: process.env.APP_URL || null,
    });

    await this.sendCustomerMessage(
      tenantId,
      update.chatId!,
      connectedMessage.title,
      connectedMessage.message,
    );

    this.logger.log({
      message: 'Bound Zalo admin group chat',
      tenantId,
      chatId: update.chatId,
      senderId: update.senderId || null,
    });

    return {
      route: 'command',
      action: 'admin_group_connected',
      chatId: update.chatId,
    };
  }

  private async tryAutoBindAdminGroupFromChatCommand(
    tenantId: string,
    update: NormalizedZaloUpdate,
    settingsValue: any,
  ) {
    if (!isAdminGroupCandidate(update)) return null;

    const configuredAdminGroupChatId = String(settingsValue?.adminGroupChatId || '').trim();
    if (configuredAdminGroupChatId === update.chatId) {
      return { route: 'command', action: 'chat_id_echo' };
    }
    if (configuredAdminGroupChatId) return null;

    const setting = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: 'TENANT' as any,
          ownerId: tenantId,
          key: 'zalo-provider',
        },
      },
    });

    if (!setting?.id) return null;

    const currentValue = ((setting.value as any) || {});
    const nextValue = {
      ...currentValue,
      adminGroupChatId: update.chatId,
      adminGroupConnectedAt: new Date().toISOString(),
      adminSetupCode: null,
      adminSetupCodeExpiresAt: null,
      adminSetupCodePending: null,
      lastWebhookChatId: update.chatId,
      lastWebhookChatType: update.chatType || 'group',
      lastWebhookSenderId: update.senderId || null,
      lastWebhookEventName: update.eventName || 'chat_id_echo',
      lastWebhookReceivedAt: new Date().toISOString(),
    };

    await this.prisma.appSetting.update({
      where: { id: setting.id },
      data: { value: nextValue },
    });

    this.logger.log({
      message: 'Auto-bound Zalo admin group from /id command',
      tenantId,
      chatId: update.chatId,
      senderId: update.senderId || null,
    });

    return {
      route: 'command',
      action: 'admin_group_auto_connected',
      chatId: update.chatId,
    };
  }
}

function parseRegisterCommand(text: string): RegisterCommand | null {
  const match = text.match(/^DK\s+([\d,\s+.-]+)\s+([A-Za-z0-9._-]+)$/i);
  if (!match) return null;

  const phones = match[1]
    .split(',')
    .map(normalizePhone)
    .filter(Boolean);
  const roomNumber = String(match[2] || '').trim();

  if (!phones.length || !roomNumber) return null;

  return {
    primaryPhone: phones[0],
    secondaryPhones: phones.slice(1),
    roomNumber,
  };
}

function normalizePhone(phone: string) {
  return String(phone || '').replace(/\D/g, '');
}

function phoneMatches(source: string | null | undefined, expected: string | null | undefined) {
  const sourceCandidates = buildComparablePhones(source);
  const expectedCandidates = buildComparablePhones(expected);
  return sourceCandidates.some((value) => expectedCandidates.includes(value));
}

function isChatIdCommand(text: string) {
  const normalized = normalizeCommandKeyword(text);
  return normalized === '/id' || normalized === '/chatid' || normalized === 'chatid';
}

function isAdminGroupCandidate(update: NormalizedZaloUpdate) {
  if (!update.chatId) return false;
  if (update.chatType === 'group') return true;
  if (update.chatType === 'private') return false;
  return true;
}

function parseSetAdminCommand(text: string | null | undefined) {
  const match = String(text || '').trim().match(/(?:^|\s)\/setadmin(?:@\S+)?\s+(\S+)/i);
  if (!match) return null;
  const setupCode = String(match[1] || '').trim();
  if (!setupCode) return null;
  return { setupCode };
}

function normalizeCommandKeyword(text: string | null | undefined) {
  const normalized = String(text || '').trim().toLowerCase();
  const firstToken = normalized.split(/\s+/)[0] || '';
  return firstToken.replace(/@\S+$/, '');
}

function buildComparablePhones(value: string | null | undefined) {
  const normalized = normalizePhone(String(value || ''));
  if (!normalized) return [];

  const candidates = new Set<string>([normalized]);
  if (normalized.startsWith('84') && normalized.length > 9) {
    candidates.add(`0${normalized.slice(2)}`);
  }
  if (normalized.startsWith('0') && normalized.length > 9) {
    candidates.add(`84${normalized.slice(1)}`);
  }
  return Array.from(candidates);
}
