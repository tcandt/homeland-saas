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
      if (/(?:^|\s)dk\b/i.test(update.text || '')) {
        await this.sendCustomerMessage(
          tenantId,
          update.chatId,
          'HomeLand - Đăng ký Zalo Bot',
          [
            'Cú pháp đăng ký chưa đúng.',
            'Vui lòng nhắn theo mẫu:',
            'DK <SĐT> <MÃ PHÒNG>',
            '',
            'Ví dụ: DK 0567867889 LK31.06',
            'hoặc: DK 0567867889 31.06',
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
    let room = await this.prisma.room.findFirst({
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
      const allRooms = await this.prisma.room.findMany({
        where: {
          tenantId,
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

      room = matchFlexibleRoom(allRooms, command.roomNumber);
    }

    const roomLabel = room
      ? `${room.building?.name || room.building?.code ? `Tòa ${room.building?.name || room.building?.code} - ` : ''}Phòng ${room.name || room.code}`
      : command.roomNumber;

    if (!room) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId,
        'HomeLand - Đăng ký Zalo Bot',
        `Không thể đăng ký.\nKhông tìm thấy phòng tương ứng với "${command.roomNumber}".\nVui lòng kiểm tra lại mã phòng hoặc tòa nhà (Ví dụ: LK31.06 hoặc 31.06).`,
      );
      await this.sendAdminMessage(
        tenantId,
        settingsValue,
        'HomeLand - Đăng ký Bot thất bại',
        `Đăng ký Bot thất bại\nPhòng nhập: ${command.roomNumber}\nSĐT: ${command.primaryPhone}\nLý do: ROOM_NOT_FOUND`,
      );
      return { ok: false, code: 'ROOM_NOT_FOUND' };
    }

    const contracts = Array.isArray(room.contracts) ? room.contracts : [];
    if (contracts.length === 0) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId,
        'HomeLand - Đăng ký Zalo Bot',
        `Không thể đăng ký.\n${roomLabel} hiện không có hợp đồng đang hoạt động.`,
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
        `Không thể xác minh đăng ký.\nSĐT ${command.primaryPhone} chưa được ghi nhận trong hợp đồng của ${roomLabel}.`,
      );
      await this.sendAdminMessage(
        tenantId,
        settingsValue,
        'HomeLand - Đăng ký Bot cần kiểm tra',
        `Đăng ký Bot cần kiểm tra\n${roomLabel}\nSĐT: ${command.primaryPhone}\nLý do: PHONE_NOT_IN_CONTRACT`,
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
        `Khách hàng: ${matchedCustomer.fullName || 'Quý khách'}`,
        `Căn hộ: ${roomLabel}`,
        `SĐT: ${command.primaryPhone}`,
        '',
        'Tài khoản Zalo này sẽ nhận thông báo tự động liên quan đến hợp đồng và hóa đơn thanh toán.',
      ].join('\n'),
    );

    await this.sendAdminMessage(
      tenantId,
      settingsValue,
      'HomeLand - Khách đã đăng ký Zalo Bot',
      [
        'Khách đã đăng ký Zalo Bot',
        `Khách hàng: ${matchedCustomer.fullName || 'N/A'}`,
        `Căn hộ: ${roomLabel}`,
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
  const cleanText = String(text || '').trim();
  const match = cleanText.match(/(?:^|\s)DK\s+([\d,\s+.-]+?)\s+([A-Za-z0-9._\s-]+)$/i);
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

function cleanAlphanumeric(s: any): string {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function extractTokens(s: any): { clean: string; parts: string[]; numbers: string[] } {
  const clean = String(s || '').toUpperCase().trim();
  const parts = clean.split(/[^A-Z0-9]+/).filter(Boolean);
  const numbers = clean.match(/\d+/g) || [];
  return { clean, parts, numbers };
}

export function matchFlexibleRoom(rooms: any[], query: string): any | null {
  if (!Array.isArray(rooms) || !rooms.length || !query) return null;

  const queryClean = cleanAlphanumeric(query);
  const { numbers: qNumbers } = extractTokens(query);

  // 1. Direct match on room code or name
  for (const r of rooms) {
    if (cleanAlphanumeric(r.code) === queryClean || cleanAlphanumeric(r.name) === queryClean) {
      return r;
    }
  }

  // 2. Direct match on building code/name + room code/name
  for (const r of rooms) {
    const bCodeClean = cleanAlphanumeric(r.building?.code);
    const rCodeClean = cleanAlphanumeric(r.code);
    if (cleanAlphanumeric(bCodeClean + rCodeClean) === queryClean) {
      return r;
    }
    // Also without leading zeros in building (e.g. LK0131 -> LK31)
    const bShort = bCodeClean.replace(/0+(\d+)/g, '$1');
    if (cleanAlphanumeric(bShort + rCodeClean) === queryClean) {
      return r;
    }
  }

  // 3. Match building + room numbers
  let bestMatch = null;
  let highestScore = 0;

  for (const r of rooms) {
    const bTokens = extractTokens(r.building?.code + ' ' + (r.building?.name || ''));
    const rTokens = extractTokens(r.code + ' ' + (r.name || ''));

    let score = 0;
    const allRoomNumbers = [...bTokens.numbers, ...rTokens.numbers];

    if (qNumbers.length > 0) {
      const matchedNumbers = qNumbers.filter((qn) => {
        const qnNum = parseInt(qn, 10);
        return allRoomNumbers.some((rn) => parseInt(rn, 10) === qnNum || rn === qn);
      });
      if (matchedNumbers.length === qNumbers.length) {
        score += 10 * matchedNumbers.length;
      }
    }

    const combined = cleanAlphanumeric(
      (r.building?.code || '') + ' ' + (r.building?.name || '') + ' ' + (r.code || '') + ' ' + (r.name || ''),
    );
    if (combined.includes(queryClean)) {
      score += 20;
    }

    if (qNumbers.length >= 2) {
      const [bNum, rNum] = [parseInt(qNumbers[0], 10), parseInt(qNumbers[1], 10)];
      const bHas = bTokens.numbers.some((n) => parseInt(n, 10) === bNum);
      const rHas = rTokens.numbers.some((n) => parseInt(n, 10) === rNum || parseInt(n, 10) === (bNum * 100 + rNum));
      if (bHas && rHas) {
        score += 50;
      }
    } else if (qNumbers.length === 1 && qNumbers[0].length === 4) {
      const bNum = parseInt(qNumbers[0].slice(0, 2), 10);
      const rNum = parseInt(qNumbers[0].slice(2), 10);
      const bHas = bTokens.numbers.some((n) => parseInt(n, 10) === bNum);
      const rHas = rTokens.numbers.some((n) => parseInt(n, 10) === rNum || parseInt(n, 10) === parseInt(qNumbers[0], 10));
      if (bHas && rHas) {
        score += 45;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = r;
    }
  }

  return highestScore >= 20 ? bestMatch : null;
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
