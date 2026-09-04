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
  details?: string | string[] | null;
  note?: string | null;
}): AdminZaloMessage {
  const detailsList = Array.isArray(input.details)
    ? input.details.filter(Boolean).map((d) => `• ${d.replace(/^[•\-\s]+/, '')}`).join('\n')
    : typeof input.details === 'string' && input.details.trim()
    ? input.details.trim()
    : '• Tối ưu hóa hiệu năng, cập nhật giao diện và vá lỗi hệ thống.';

  return {
    title: 'HomeLand - Phát hiện phiên bản mới',
    message: compactLines([
      '📢 *THÔNG BÁO PHÁT HIỆN PHIÊN BẢN MỚI*',
      '',
      `• Phiên bản hiện tại: \`${input.currentVersion}\``,
      `• Phiên bản mới: \`${input.latestVersion}\``,
      `🕒 ${formatTimestamp(input.checkedAt)}`,
      '',
      '✨ *Chi tiết các điểm mới:*',
      detailsList,
      '',
      '👉 *Hướng dẫn cập nhật:*',
      'Vào menu *Cài đặt ➔ Cập nhật, sao lưu & rollback* để tiến hành cập nhật hệ thống.',
      input.note ? `\n_${input.note}_` : null,
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
    title: 'HomeLand - Cập nhật thành công',
    message: compactLines([
      '🚀 *HỆ THỐNG CẬP NHẬT PHIÊN BẢN MỚI THÀNH CÔNG*',
      '',
      input.fromVersion ? `• Phiên bản trước: \`${input.fromVersion}\`` : null,
      `• Phiên bản hiện tại: \`${input.toVersion}\``,
      input.durationSeconds ? `• Thời gian thực hiện: \`${input.durationSeconds}s\`` : null,
      `🕒 ${formatTimestamp(input.updatedAt)}`,
      '',
      input.note || 'Hệ thống đã hoàn tất cập nhật và đang hoạt động ổn định.',
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
