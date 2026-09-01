import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ACTIVE_LIKE_CONTRACT_STATUSES } from '../../contracts/contracts.adapter';
import { ZaloProvider } from '../providers/communication.providers';
import { NormalizedZaloUpdate } from '../adapters/zalo-normalizer';
import { buildAdminGroupConnectedMessage } from './admin-zalo-message-builder';

type RegisterCommand = {
  phones: string[];
  primaryPhone: string;
  secondaryPhones: string[];
  roomNumber: string;
};

type UnregisterCommand = {
  phones: string[];
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
    if (!update.chatId) {
      return { route: 'ignored', reason: 'MISSING_CHAT_ID' };
    }

    const command = String(update.text || '').trim();
    const isFollow = isFollowOrSubscribeEvent(update);

    // 1. Handle explicit Follow / Subscribe OA events only
    if (isFollow) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId,
        'HomeLand - Đăng ký nhận thông tin',
        buildWelcomeGuideMessage(),
      );
      return { route: 'customer', action: 'welcome_sent', chatId: update.chatId };
    }

    // Ignore non-text messages (like contact cards, stickers, media) without spamming guide
    if (!command) {
      return { route: 'ignored', reason: 'EMPTY_TEXT' };
    }

    // 2. Chat ID command (/id, /chatid)
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

    // 3. Admin group setup command (/setadmin <code>)
    const adminGroupSetupResult = await this.trySetAdminGroup(tenantId, update, settingsValue);
    if (adminGroupSetupResult) {
      return adminGroupSetupResult;
    }

    const adminGroupChatId = String(settingsValue?.adminGroupChatId || '').trim();
    if (adminGroupChatId && update.chatId === adminGroupChatId) {
      return { route: 'admin', action: 'ignored' };
    }

    // 4. Check Unregister command (HUY / HỦY)
    const unregisterParsed = parseUnregisterCommand(command);
    if (unregisterParsed) {
      return this.unregisterCustomerZalo(tenantId, update, unregisterParsed, settingsValue);
    }

    // 5. Check Register command (DK / ĐK / ĐĂNG KÝ)
    const parsed = parseRegisterCommand(command);
    if (parsed) {
      return this.registerCustomerZalo(tenantId, update, parsed, settingsValue);
    }

    // 6. Greetings, Help, Menu
    if (isGreetingOrHelpCommand(command)) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId,
        'HomeLand - Hướng dẫn đăng ký Zalo Bot',
        buildWelcomeGuideMessage(),
      );
      return { route: 'customer', action: 'guide_sent', chatId: update.chatId };
    }

    if (isUnregisterAttempt(command)) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId,
        'HomeLand - Hủy nhận thông báo Zalo',
        [
          'Cú pháp hủy chưa đúng.',
          'Vui lòng nhắn theo mẫu:',
          'HUY <SĐT> <MÃ PHÒNG>',
          '',
          'Ví dụ: HUY 0567867889 LK31.06',
          'hoặc: HUY 0567867889 31.06',
        ].join('\n'),
      );
      return { route: 'customer', action: 'syntax_error' };
    }

    if (isRegisterAttempt(command)) {
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
          'hoặc: DK 0567867889,0329484353 31.06',
        ].join('\n'),
      );
      return { route: 'customer', action: 'syntax_error' };
    }

    // Any other private message from customer: send guide
    if (update.chatType === 'private') {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId,
        'HomeLand - Hướng dẫn đăng ký Zalo Bot',
        buildWelcomeGuideMessage(),
      );
      return { route: 'customer', action: 'guide_sent', chatId: update.chatId };
    }

    return { route: 'customer', action: 'ignored' };
  }

  private async findRoom(tenantId: string, roomQuery: string) {
    let room = await this.prisma.room.findFirst({
      where: {
        tenantId,
        code: roomQuery,
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

      room = matchFlexibleRoom(allRooms, roomQuery);
    }

    return room;
  }

  private async registerCustomerZalo(
    tenantId: string,
    update: NormalizedZaloUpdate,
    command: RegisterCommand,
    settingsValue: any,
  ) {
    const room = await this.findRoom(tenantId, command.roomNumber);

    if (!room) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId!,
        'HomeLand - Đăng ký không thành công',
        [
          'Đăng ký không thành công.',
          `Không tìm thấy căn hộ tương ứng với "${command.roomNumber}".`,
          'Vui lòng kiểm tra lại Số điện thoại và Mã phòng trong hợp đồng.',
        ].join('\n'),
      );
      await this.sendAdminMessage(
        tenantId,
        settingsValue,
        'HomeLand - Đăng ký Bot thất bại',
        `Đăng ký Bot thất bại\nPhòng nhập: ${command.roomNumber}\nSĐT: ${command.phones.join(', ')}\nLý do: ROOM_NOT_FOUND`,
      );
      return { ok: false, code: 'ROOM_NOT_FOUND' };
    }

    const roomLabel = formatRoomLabel(room);

    const contracts = Array.isArray(room.contracts) ? room.contracts : [];
    if (contracts.length === 0) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId!,
        'HomeLand - Đăng ký không thành công',
        [
          'Đăng ký không thành công.',
          `${roomLabel} hiện không có hợp đồng đang hoạt động.`,
        ].join('\n'),
      );
      return { ok: false, code: 'NO_ACTIVE_CONTRACT', roomId: room.id };
    }

    // Collect all customers from active contracts and roommates
    const potentialCustomers: Array<{
      id: string;
      fullName: string | null;
      phone: string | null;
      zaloChatId: string | null;
      zaloUserId: string | null;
      contractId?: string;
    }> = [];

    for (const contract of contracts) {
      if (contract.customer) {
        potentialCustomers.push({
          ...contract.customer,
          contractId: contract.id,
        });
      }
    }
    if (Array.isArray(room.roommates)) {
      for (const rm of room.roommates) {
        potentialCustomers.push(rm);
      }
    }

    // Match all customers that match any phone in command.phones
    const matchedCustomers = potentialCustomers.filter((cust) =>
      command.phones.some((phone) => phoneMatches(cust.phone, phone)),
    );

    if (matchedCustomers.length === 0) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId!,
        'HomeLand - Đăng ký không thành công',
        [
          'Đăng ký không thành công.',
          `Số điện thoại (${command.phones.join(', ')}) không khớp với hợp đồng của ${roomLabel}.`,
          'Vui lòng kiểm tra lại Số điện thoại và Mã phòng trong hợp đồng.',
        ].join('\n'),
      );
      await this.sendAdminMessage(
        tenantId,
        settingsValue,
        'HomeLand - Đăng ký Bot cần kiểm tra',
        `Đăng ký Bot cần kiểm tra\n${roomLabel}\nSĐT: ${command.phones.join(', ')}\nLý do: PHONE_NOT_IN_CONTRACT`,
      );
      return { ok: false, code: 'PHONE_NOT_IN_CONTRACT', roomId: room.id };
    }

    // Update all matched customers
    for (const cust of matchedCustomers) {
      await this.prisma.customer.update({
        where: { id: cust.id },
        data: {
          zaloChatId: update.chatId,
          zaloUserId: update.senderId || cust.zaloUserId || null,
          zaloPhone: cust.phone || command.primaryPhone,
        },
      });
    }

    const matchedNames = Array.from(new Set(matchedCustomers.map((c) => c.fullName).filter(Boolean))).join(', ') || 'Quý khách';
    const matchedPhones = Array.from(new Set(matchedCustomers.map((c) => c.phone).filter(Boolean))).join(', ') || command.phones.join(', ');

    await this.sendCustomerMessage(
      tenantId,
      update.chatId!,
      'HomeLand - Đăng ký thành công',
      [
        'HomeLand - Đăng ký nhận thông tin thành công',
        `Khách hàng: ${matchedNames}`,
        `Căn hộ: ${roomLabel}`,
        `SĐT nhận tin: ${matchedPhones}`,
        '',
        'Tài khoản Zalo này đã được kích hoạt nhận thông báo tự động (hóa đơn, tiền phòng, hợp đồng).',
      ].join('\n'),
    );

    await this.sendAdminMessage(
      tenantId,
      settingsValue,
      'HomeLand - Khách đã đăng ký Zalo Bot',
      [
        'Khách đã đăng ký Zalo Bot',
        `Khách hàng: ${matchedNames}`,
        `Căn hộ: ${roomLabel}`,
        `SĐT: ${matchedPhones}`,
        `Chat ID: ${update.chatId}`,
      ].join('\n'),
    );

    this.logger.log({
      message: 'Bound Zalo chat to customer(s)',
      tenantId,
      customerIds: matchedCustomers.map((c) => c.id),
      roomId: room.id,
      chatId: update.chatId,
    });

    return {
      ok: true,
      customerIds: matchedCustomers.map((c) => c.id),
      customerId: matchedCustomers[0].id,
      roomId: room.id,
      contractId: matchedCustomers[0].contractId || contracts[0]?.id || null,
      roomCode: room.code,
    };
  }

  private async unregisterCustomerZalo(
    tenantId: string,
    update: NormalizedZaloUpdate,
    command: UnregisterCommand,
    settingsValue: any,
  ) {
    const room = await this.findRoom(tenantId, command.roomNumber);

    if (!room) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId!,
        'HomeLand - Hủy nhận thông báo Zalo',
        [
          'Thông tin hủy không chính xác.',
          `Không tìm thấy căn hộ tương ứng với "${command.roomNumber}".`,
        ].join('\n'),
      );
      return { ok: false, code: 'ROOM_NOT_FOUND' };
    }

    const roomLabel = formatRoomLabel(room);

    const contracts = Array.isArray(room.contracts) ? room.contracts : [];
    const potentialCustomers: Array<{
      id: string;
      fullName: string | null;
      phone: string | null;
      zaloChatId: string | null;
      zaloUserId: string | null;
    }> = [];

    for (const contract of contracts) {
      if (contract.customer) potentialCustomers.push(contract.customer);
    }
    if (Array.isArray(room.roommates)) {
      for (const rm of room.roommates) potentialCustomers.push(rm);
    }

    // Match customers by phone or by current chatId
    const matchedCustomers = potentialCustomers.filter((cust) =>
      command.phones.some((phone) => phoneMatches(cust.phone, phone)) || cust.zaloChatId === update.chatId,
    );

    if (matchedCustomers.length === 0) {
      await this.sendCustomerMessage(
        tenantId,
        update.chatId!,
        'HomeLand - Hủy nhận thông báo Zalo',
        [
          'Thông tin hủy không chính xác.',
          `Số điện thoại (${command.phones.join(', ')}) không khớp với thông tin đã đăng ký của ${roomLabel}.`,
        ].join('\n'),
      );
      return { ok: false, code: 'PHONE_NOT_MATCHED' };
    }

    for (const cust of matchedCustomers) {
      await this.prisma.customer.update({
        where: { id: cust.id },
        data: {
          zaloChatId: null,
          zaloUserId: null,
          zaloPhone: null,
        },
      });
    }

    const matchedNames = Array.from(new Set(matchedCustomers.map((c) => c.fullName).filter(Boolean))).join(', ') || 'Quý khách';

    await this.sendCustomerMessage(
      tenantId,
      update.chatId!,
      'HomeLand - Hủy nhận thông báo thành công',
      [
        'HomeLand - Đã hủy nhận thông báo Zalo',
        `Khách hàng: ${matchedNames}`,
        `Căn hộ: ${roomLabel}`,
        '',
        'Tài khoản Zalo này đã dừng nhận thông báo tự động từ hệ thống.',
      ].join('\n'),
    );

    await this.sendAdminMessage(
      tenantId,
      settingsValue,
      'HomeLand - Khách hủy nhận tin Zalo Bot',
      [
        'Khách hủy nhận tin Zalo Bot',
        `Khách hàng: ${matchedNames}`,
        `Căn hộ: ${roomLabel}`,
        `SĐT: ${command.phones.join(', ')}`,
        `Chat ID: ${update.chatId}`,
      ].join('\n'),
    );

    this.logger.log({
      message: 'Unbound Zalo chat from customer(s)',
      tenantId,
      customerIds: matchedCustomers.map((c) => c.id),
      roomId: room.id,
      chatId: update.chatId,
    });

    return {
      ok: true,
      action: 'unregistered',
      customerIds: matchedCustomers.map((c) => c.id),
      roomId: room.id,
    };
  }

  private async sendCustomerMessage(tenantId: string, chatId: string, title: string, message: string) {
    try {
      await this.zaloProvider.send({
        tenantId,
        recipient: chatId,
        title,
        message,
        context: {},
      });
    } catch (err: any) {
      this.logger.warn(`Failed to send message to customer chat ${chatId}: ${err?.message || err}`);
    }
  }

  private async sendAdminMessage(tenantId: string, settingsValue: any, title: string, message: string) {
    const adminGroupChatId = String(settingsValue?.adminGroupChatId || '').trim();
    if (!adminGroupChatId) return;

    try {
      await this.zaloProvider.send({
        tenantId,
        recipient: adminGroupChatId,
        title,
        message,
        context: {},
      });
    } catch (err: any) {
      this.logger.warn(`Failed to send message to admin group chat ${adminGroupChatId}: ${err?.message || err}`);
    }
  }

  private async trySetAdminGroup(tenantId: string, update: NormalizedZaloUpdate, settingsValue: any) {
    const parsed = parseSetAdminCommand(update.text);
    if (!parsed) return null;

    const expectedCode = String(settingsValue?.adminSetupCode || '').trim().toUpperCase();
    const expiresAt = String(settingsValue?.adminSetupCodeExpiresAt || '').trim();
    const notExpired = !expiresAt || Date.now() <= new Date(expiresAt).getTime();
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

export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim();
}

export function parseRegisterCommand(text: string): RegisterCommand | null {
  const cleanText = String(text || '').trim();
  if (!cleanText) return null;

  const normalized = removeVietnameseTones(cleanText);
  // Match prefix: DK, DANG KY, DANG KY NHAN TIN, DANGKY, REGISTER, REG with optional ':' or '-'
  const match = normalized.match(/(?:^|\s)(?:DK|DANG\s*KY|DANG\s*KY\s*NHAN\s*TIN|DANGKY|REGISTER|REG)[:\s-]+([\d,\s+./-]+?)\s+([A-Za-z0-9._\s/-]+)$/i);
  if (!match) return null;

  const rawPhones = match[1];
  const phones = rawPhones
    .split(/[,;\s/]+/)
    .map(normalizePhone)
    .filter((p) => p && p.length >= 9 && p.length <= 12);

  let rawRoom = String(match[2] || '').trim();
  // Strip words like 'phong', 'can', 'p.', 'p-'
  rawRoom = rawRoom.replace(/^(?:PHONG|CAN|TOA)\s+/i, '').replace(/^[Pp][.-]/, '').trim();

  if (!phones.length || !rawRoom) return null;

  return {
    phones,
    primaryPhone: phones[0],
    secondaryPhones: phones.slice(1),
    roomNumber: rawRoom,
  };
}

export function parseUnregisterCommand(text: string): UnregisterCommand | null {
  const cleanText = String(text || '').trim();
  if (!cleanText) return null;

  const normalized = removeVietnameseTones(cleanText);
  // Match prefix: HUY, HUY DANG KY, HUY NHAN TIN, UNREGISTER, STOP with optional ':' or '-'
  const match = normalized.match(/(?:^|\s)(?:HUY|HUY\s*DANG\s*KY|HUY\s*NHAN\s*TIN|UNREGISTER|UNREG|STOP)[:\s-]+([\d,\s+./-]+?)\s+([A-Za-z0-9._\s/-]+)$/i);
  if (!match) return null;

  const rawPhones = match[1];
  const phones = rawPhones
    .split(/[,;\s/]+/)
    .map(normalizePhone)
    .filter((p) => p && p.length >= 9 && p.length <= 12);

  let rawRoom = String(match[2] || '').trim();
  rawRoom = rawRoom.replace(/^(?:PHONG|CAN|TOA)\s+/i, '').replace(/^[Pp][.-]/, '').trim();

  if (!phones.length || !rawRoom) return null;

  return {
    phones,
    roomNumber: rawRoom,
  };
}

export function isRegisterAttempt(text: string): boolean {
  const norm = removeVietnameseTones(String(text || '')).toLowerCase();
  return (
    /(?:^|\s)(?:dk|dang\s*ky|dangky|register|reg)\b/i.test(norm) ||
    norm.includes('nhan thong tin') ||
    norm.includes('dang ky nhan')
  );
}

export function isUnregisterAttempt(text: string): boolean {
  const norm = removeVietnameseTones(String(text || '')).toLowerCase();
  return /(?:^|\s)(?:huy|huy\s*dang\s*ky|huy\s*nhan|unregister|stop)\b/i.test(norm);
}

export function isGreetingOrHelpCommand(text: string): boolean {
  const norm = removeVietnameseTones(String(text || '')).toLowerCase();
  const keywords = [
    'xin chao',
    'chao',
    'hello',
    'hi',
    'alo',
    'bat dau',
    'start',
    '/start',
    'menu',
    'huong dan',
    'help',
    '/help',
    'quan tam',
    'thong tin',
    'nhan tin',
  ];
  return keywords.some((kw) => norm === kw || norm.startsWith(`${kw} `) || norm.endsWith(` ${kw}`));
}

export function isFollowOrSubscribeEvent(update: NormalizedZaloUpdate): boolean {
  const event = String(update.eventName || '').toLowerCase();
  return (
    event.includes('follow') ||
    event.includes('subscribe') ||
    event.includes('join') ||
    event === 'oa_open' ||
    event === 'user_follow_oa'
  );
}

export function formatRoomLabel(room: any): string {
  if (!room) return 'Căn hộ';
  const bRaw = String(room.building?.name || room.building?.code || '').trim();
  const bName = bRaw ? (bRaw.toLowerCase().startsWith('tòa') ? bRaw : `Tòa ${bRaw}`) : '';
  const rRaw = String(room.name || room.code || '').trim();
  const rName = rRaw ? (rRaw.toLowerCase().startsWith('phòng') || rRaw.toLowerCase().startsWith('p') ? rRaw : `Phòng ${rRaw}`) : '';
  if (bName && rName) return `${bName} - ${rName}`;
  return bName || rName || 'Căn hộ';
}

export function buildWelcomeGuideMessage(): string {
  return [
    'HomeLand - Hướng dẫn đăng ký nhận thông báo',
    '',
    'Để kích hoạt nhận thông báo tự động (hóa đơn, tiền phòng, hợp đồng), Quý khách vui lòng gửi tin nhắn theo cú pháp:',
    '',
    '👉 DK <Số điện thoại> <Mã phòng>',
    '',
    '📌 Ví dụ:',
    '• DK 0567867889 LK31.06',
    '• hoặc: DK 0567867889 31.06',
    '• Nhiều SĐT cùng phòng: DK 0567867889,0329484353 31.06',
    '',
    '📌 Để hủy nhận thông báo:',
    '👉 HUY <Số điện thoại> <Mã phòng>',
  ].join('\n');
}

function cleanAlphanumeric(s: any): string {
  return removeVietnameseTones(String(s || '')).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function extractTokens(s: any): { clean: string; parts: string[]; numbers: string[] } {
  const clean = removeVietnameseTones(String(s || '')).toUpperCase().trim();
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
    candidates.add(normalized.slice(2));
  }
  if (normalized.startsWith('0') && normalized.length > 9) {
    candidates.add(`84${normalized.slice(1)}`);
    candidates.add(normalized.slice(1));
  }
  if (normalized.length === 9 && !normalized.startsWith('0')) {
    candidates.add(`0${normalized}`);
    candidates.add(`84${normalized}`);
  }
  return Array.from(candidates);
}
