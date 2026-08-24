type AdminZaloMessage = {
  title: string;
  message: string;
};

function compactLines(lines: Array<string | null | undefined>) {
  return lines.filter((line) => line && String(line).trim()).join('\n');
}

function formatTimestamp(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
      `🕒 ${formatTimestamp(input.connectedAt)}`,
    ]),
  };
}

export function buildUpdateAvailableMessage(input: {
  currentVersion: string;
  latestVersion: string;
  checkedAt?: string | Date | null;
  note?: string | null;
}): AdminZaloMessage {
  return {
    title: 'HomeLand - Update Available',
    message: compactLines([
      '🆕 *Có phiên bản mới*',
      '',
      `• Hiện tại: \`${input.currentVersion}\``,
      `• Mới nhất: \`${input.latestVersion}\``,
      `🕒 ${formatTimestamp(input.checkedAt)}`,
      input.note || 'Vui lòng kiểm tra mục cập nhật trước khi triển khai.',
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
    title: 'HomeLand - Server Alert',
    message: compactLines([
      '🚨 *Cảnh báo tải cao / request bất thường*',
      '',
      input.currentRps ? `• RPS hiện tại: \`${input.currentRps}\`` : null,
      input.suspiciousIpCount ? `• IP nghi vấn: \`${input.suspiciousIpCount}\`` : null,
      input.topSource ? `• Nguồn nổi bật: \`${input.topSource}\`` : null,
      `🕒 ${formatTimestamp(input.detectedAt)}`,
      input.note || 'Kiểm tra rate limit, reverse proxy và access log ngay.',
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
      `🕒 ${formatTimestamp(new Date())}`,
    ]),
  };
}
