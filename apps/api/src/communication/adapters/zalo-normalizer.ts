export type NormalizedZaloUpdate = {
  updateId: string | null;
  chatId: string | null;
  chatType: 'group' | 'private' | 'unknown';
  senderId: string | null;
  text: string | null;
  eventName: string | null;
  displayName: string | null;
  raw: any;
};

export type ZaloWebhookChat = {
  chatId: string;
  chatType?: 'group' | 'private' | 'unknown';
  userId?: string | null;
  displayName?: string | null;
  eventName?: string | null;
  source?: 'zalo' | 'legacy';
  lastSeenAt: string;
};

export function normalizeZaloUpdate(raw: any): NormalizedZaloUpdate {
  const payload = unwrapZaloWebhookPayload(raw);
  const chatId = firstStringValue(payload, [
    'message.chat.id',
    'message.chat_id',
    'message.group_id',
    'message.room_id',
    'message.thread_id',
    'chat.id',
    'chat_id',
    'group_id',
    'groupId',
    'room_id',
    'roomId',
    'conversation_id',
    'conversationId',
    'thread_id',
    'threadId',
    'conversation.id',
    'thread.id',
    'recipient.chat_id',
    'recipient.id',
    'sender.id',
  ]);

  const senderId = firstStringValue(payload, [
    'message.from.id',
    'from.id',
    'sender.id',
    'sender.user_id',
    'user_id',
    'userId',
  ]);

  const text = firstStringValue(payload, [
    'message.text',
    'text',
  ]);

  const chatType = firstStringValue(payload, [
    'message.chat.chat_type',
    'message.chat.type',
    'chat.type',
    'chat.chat_type',
    'conversation.type',
    'thread.type',
    'event.chat.type',
    'message.type',
    'event.type',
  ]).toLowerCase();

  const inferredChatType = inferChatType(payload, chatType, chatId);

  return {
    updateId: firstStringValue(payload, ['update_id', 'id']) || null,
    chatId: chatId || senderId || null,
    chatType: inferredChatType,
    senderId: senderId || null,
    text: text || null,
    eventName: firstStringValue(payload, ['event_name', 'eventName', 'event', 'type']) || null,
    displayName: firstStringValue(payload, [
      'message.from.display_name',
      'sender.name',
      'sender.display_name',
      'message.from.name',
      'from.name',
      'user.name',
    ]) || null,
    raw: payload,
  };
}

export function extractZaloWebhookChat(raw: any): ZaloWebhookChat | null {
  const update = normalizeZaloUpdate(raw);
  if (!update.chatId) return null;

  return {
    chatId: update.chatId,
    chatType: update.chatType,
    userId: update.senderId || null,
    displayName: update.displayName || null,
    eventName: update.eventName || null,
    source: isWrappedZaloWebhookPayload(raw) ? 'zalo' : 'legacy',
    lastSeenAt: new Date().toISOString(),
  };
}

export function mergeRecentZaloWebhookChat(value: any, capturedChat: ZaloWebhookChat) {
  const existing = value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {};
  const currentList = Array.isArray(existing.recentWebhookChats) ? existing.recentWebhookChats : [];
  const withoutDuplicate = currentList.filter((item: any) => String(item?.chatId || '') !== capturedChat.chatId);

  return {
    ...existing,
    defaultChatId: existing.defaultChatId || capturedChat.chatId,
    recentWebhookChats: [capturedChat, ...withoutDuplicate].slice(0, 10),
  };
}

export function buildTenantWebhookUrl(value: any) {
  const rawBaseUrl = String(
    value?.webhookBaseUrl
    || value?.baseUrl
    || process.env.APP_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || '',
  ).trim();
  if (!rawBaseUrl) return '';
  return `${rawBaseUrl.replace(/\/+$/, '')}/api/v1/notifications/zalo/webhook`;
}

function firstStringValue(source: any, paths: string[]) {
  for (const path of paths) {
    const value = getPath(source, path);
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function inferChatType(raw: any, chatType: string, chatId: string) {
  if (chatType === 'group' || chatType === 'private') return chatType;

  const typeHints = [
    firstStringValue(raw, ['conversation.type', 'thread.type', 'chat.type']),
    firstStringValue(raw, ['message.chat.type', 'data.message.chat.type', 'event.message.chat.type']),
  ]
    .map((value) => String(value || '').toLowerCase())
    .filter(Boolean);

  if (typeHints.some((value) => value.includes('group'))) return 'group';
  if (typeHints.some((value) => value.includes('private') || value.includes('user'))) return 'private';

  const hasGroupId = Boolean(firstStringValue(raw, [
    'group_id',
    'groupId',
    'message.group_id',
    'message.room_id',
    'event.group_id',
  ]));
  if (hasGroupId) return 'group';

  if (chatId) {
    const senderId = firstStringValue(raw, ['message.from.id', 'from.id', 'sender.id', 'sender.user_id', 'user_id', 'userId']);
    if (senderId && senderId === chatId) return 'private';
  }

  return 'unknown';
}

export function unwrapZaloWebhookPayload(raw: any) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.ok === true && raw.result && typeof raw.result === 'object') {
    return raw.result;
  }
  return raw;
}

export function isWrappedZaloWebhookPayload(raw: any) {
  return raw && typeof raw === 'object' && !Array.isArray(raw) && raw.ok === true && raw.result && typeof raw.result === 'object';
}

function getPath(source: any, path: string) {
  return path.split('.').reduce((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[key];
  }, source);
}
