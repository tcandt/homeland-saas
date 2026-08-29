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
    'message.chatId',
    'message.chat.chat_id',
    'message.chat.chatId',
    'message.group_id',
    'message.groupId',
    'message.room_id',
    'message.roomId',
    'message.thread_id',
    'message.threadId',
    'message.conversation_id',
    'message.conversationId',
    'message.conversation.id',
    'message.conversation.chat_id',
    'message.conversation.chatId',
    'message.peer.id',
    'message.recipient.id',
    'data.message.chat.id',
    'data.message.chat_id',
    'data.message.chatId',
    'data.message.chat.chat_id',
    'data.message.chat.chatId',
    'data.message.group_id',
    'data.message.groupId',
    'data.message.room_id',
    'data.message.roomId',
    'data.message.thread_id',
    'data.message.threadId',
    'data.message.conversation_id',
    'data.message.conversationId',
    'data.message.conversation.id',
    'data.message.conversation.chat_id',
    'data.message.conversation.chatId',
    'data.message.peer.id',
    'event.message.chat.id',
    'event.message.chat_id',
    'event.message.chatId',
    'event.message.chat.chat_id',
    'event.message.chat.chatId',
    'event.message.group_id',
    'event.message.groupId',
    'event.message.room_id',
    'event.message.roomId',
    'event.message.thread_id',
    'event.message.threadId',
    'event.message.conversation_id',
    'event.message.conversationId',
    'event.message.conversation.id',
    'event.message.conversation.chat_id',
    'event.message.conversation.chatId',
    'event.message.peer.id',
    'result.message.chat.id',
    'result.message.chat_id',
    'result.message.chatId',
    'result.message.chat.chat_id',
    'result.message.chat.chatId',
    'result.message.group_id',
    'result.message.groupId',
    'result.message.room_id',
    'result.message.roomId',
    'result.message.thread_id',
    'result.message.threadId',
    'result.message.conversation_id',
    'result.message.conversationId',
    'result.message.conversation.id',
    'result.message.conversation.chat_id',
    'result.message.conversation.chatId',
    'result.message.peer.id',
    'chat.id',
    'chat_id',
    'chatId',
    'chat.chat_id',
    'chat.chatId',
    'group_id',
    'groupId',
    'room_id',
    'roomId',
    'conversation_id',
    'conversationId',
    'conversation.id',
    'conversation.chat_id',
    'conversation.chatId',
    'thread_id',
    'threadId',
    'thread.id',
    'recipient.chat_id',
    'recipient.id',
    'sender.id',
  ]);

  const senderId = firstStringValue(payload, [
    'message.from.id',
    'message.sender.id',
    'message.user.id',
    'from.id',
    'sender.id',
    'sender.user_id',
    'sender.userId',
    'data.message.from.id',
    'data.message.sender.id',
    'data.message.user.id',
    'data.from.id',
    'data.sender.id',
    'event.message.from.id',
    'event.message.sender.id',
    'event.message.user.id',
    'result.message.from.id',
    'result.message.sender.id',
    'result.message.user.id',
    'user_id',
    'userId',
  ]);

  const text = firstStringValue(payload, [
    'message.text',
    'text',
    'data.message.text',
    'event.message.text',
    'result.message.text',
  ]);

  const chatType = firstStringValue(payload, [
    'message.chat.chat_type',
    'message.chat.chatType',
    'message.chat.type',
    'message.conversation.chat_type',
    'message.conversation.chatType',
    'message.conversation.type',
    'message.conversation_type',
    'message.conversationType',
    'message.peer.type',
    'chat.type',
    'chat.chat_type',
    'chat.chatType',
    'chat.conversation_type',
    'chat.conversationType',
    'conversation.type',
    'conversation.chat_type',
    'conversation.chatType',
    'thread.type',
    'event.chat.type',
    'event.chat.chat_type',
    'event.chat.chatType',
    'event.message.chat.chat_type',
    'event.message.chat.chatType',
    'event.message.chat.type',
    'event.message.conversation.chat_type',
    'event.message.conversation.chatType',
    'event.message.conversation.type',
    'data.chat.type',
    'data.chat.chat_type',
    'data.chat.chatType',
    'data.message.chat.chat_type',
    'data.message.chat.chatType',
    'data.message.chat.type',
    'data.message.conversation.chat_type',
    'data.message.conversation.chatType',
    'data.message.conversation.type',
    'result.chat.type',
    'result.chat.chat_type',
    'result.chat.chatType',
    'result.message.chat.chat_type',
    'result.message.chat.chatType',
    'result.message.chat.type',
    'result.message.conversation.chat_type',
    'result.message.conversation.chatType',
    'result.message.conversation.type',
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
      'message.from.displayName',
      'message.sender.display_name',
      'message.sender.displayName',
      'message.user.display_name',
      'message.user.displayName',
      'sender.name',
      'sender.display_name',
      'sender.displayName',
      'message.from.name',
      'from.name',
      'user.name',
      'data.message.from.display_name',
      'data.message.from.displayName',
      'data.message.sender.display_name',
      'data.message.sender.displayName',
      'data.sender.display_name',
      'data.sender.displayName',
      'event.message.from.display_name',
      'event.message.from.displayName',
      'event.message.sender.display_name',
      'event.message.sender.displayName',
      'result.message.from.display_name',
      'result.message.from.displayName',
      'result.message.sender.display_name',
      'result.message.sender.displayName',
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
    firstStringValue(raw, [
      'message.chat.type',
      'message.chat.chat_type',
      'message.chat.chatType',
      'message.peer.type',
      'data.message.chat.type',
      'data.message.chat.chat_type',
      'data.message.chat.chatType',
      'event.message.chat.type',
      'event.message.chat.chat_type',
      'event.message.chat.chatType',
      'result.message.chat.type',
      'result.message.chat.chat_type',
      'result.message.chat.chatType',
    ]),
  ]
    .map((value) => String(value || '').toLowerCase())
    .filter(Boolean);

  if (typeHints.some((value) => value.includes('group'))) return 'group';
  if (typeHints.some((value) => value.includes('private') || value.includes('user'))) return 'private';

  const hasGroupId = Boolean(firstStringValue(raw, [
    'group_id',
    'groupId',
    'message.group_id',
    'message.groupId',
    'message.conversation_id',
    'message.conversationId',
    'message.conversation.id',
    'message.conversation.chat_id',
    'message.conversation.chatId',
    'message.room_id',
    'message.roomId',
    'message.conversation_id',
    'message.conversationId',
    'event.group_id',
    'event.groupId',
    'data.message.group_id',
    'data.message.groupId',
    'data.message.conversation_id',
    'data.message.conversationId',
    'data.message.conversation.id',
    'data.message.conversation.chat_id',
    'data.message.conversation.chatId',
    'data.message.room_id',
    'data.message.roomId',
    'data.message.conversation_id',
    'data.message.conversationId',
    'result.message.group_id',
    'result.message.groupId',
    'result.message.conversation_id',
    'result.message.conversationId',
    'result.message.conversation.id',
    'result.message.conversation.chat_id',
    'result.message.conversation.chatId',
    'result.message.room_id',
    'result.message.roomId',
    'result.message.conversation_id',
    'result.message.conversationId',
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
