type AdminZaloMessage = {
  title: string;
  message: string;
};

import { formatZaloTimestamp } from './zalo-message-formatter';

function compactLines(lines: Array<string | null | undefined>) {
  return lines.filter((line) => line !== null && line !== undefined)
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function formatTimestamp(value?: string | Date | null) {
  return formatZaloTimestamp(value || new Date());
}

export function buildAdminGroupConnectedMessage(input: {
  chatId: string;
  senderId?: string | null;
  connectedAt?: string | Date | null;
  domain?: string | null;
}): AdminZaloMessage {
  return {
    title: 'HomeLand - Admin Bot Connected',
    message: compactLines([
      '✅ *Bot Admin đã kết nối*',
      '',
      `#️⃣ Chat ID: \`${input.chatId}\``,
      input.senderId ? `👤 Sender: \`${input.senderId}\`` : null,
      input.domain ? `🌐 Domain: ${input.domain}` : null,
      formatTimestamp(input.connectedAt),
    ]),
  };
}

export function buildUpdateAvailableMessage(input: {
  currentVersion: string;
  latestVersion: string;
  checkedAt?: string | Date | null;
  details?: string | string[] | null;
  note?: string | null;
}): AdminZaloMessage {
  return {
    title: '📢 CÓ BẢN CẬP NHẬT MỚI',
    message: compactLines([
      '📢 CÓ BẢN CẬP NHẬT MỚI',
      '',
      `Hiện tại: ${input.currentVersion}`,
      `Phiên bản mới: ${input.latestVersion}`,
      formatTimestamp(input.checkedAt),
    ]),
  };
}

export function buildUpdateSuccessMessage(input: {
  fromVersion?: string | null;
  toVersion: string;
  updatedAt?: string | Date | null;
  durationSeconds?: number | null;
  note?: string | null;
}): AdminZaloMessage {
  return {
    title: '✅ CẬP NHẬT THÀNH CÔNG',
    message: compactLines([
      '✅ CẬP NHẬT THÀNH CÔNG',
      '',
      input.fromVersion ? `${input.fromVersion} → ${input.toVersion}` : input.toVersion,
      'Hệ thống hoạt động bình thường.',
      formatTimestamp(input.updatedAt),
    ]),
  };
}

export function buildServerOverloadAlertMessage(input: {
  currentRps?: number | null;
  suspiciousIpCount?: number | null;
  topSource?: string | null;
  note?: string | null;
  detectedAt?: string | Date | null;
}): AdminZaloMessage {
  return {
    title: '🚨 SERVER TẢI CAO',
    message: compactLines([
      '🚨 SERVER TẢI CAO',
      '',
      `RPS: ${input.currentRps || 0} • IP: ${input.suspiciousIpCount || 0}`,
      'Phát hiện lưu lượng bất thường.',
      '➡️ Kiểm tra hệ thống.',
      formatTimestamp(input.detectedAt),
    ]),
  };
}

export function buildAdminGroupTestMessage(): AdminZaloMessage {
  return {
    title: 'HomeLand - Admin Bot Test',
    message: compactLines([
      '🧪 *Admin Bot test*',
      '',
      'Kênh Zalo admin group đang nhận tin nhắn bình thường.',
      formatTimestamp(new Date()),
    ]),
  };
}
