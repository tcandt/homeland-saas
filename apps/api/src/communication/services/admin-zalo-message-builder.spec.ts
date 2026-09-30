import { describe, expect, it } from 'vitest';
import {
  buildServerOverloadAlertMessage,
  buildUpdateAvailableMessage,
  buildUpdateSuccessMessage,
} from './admin-zalo-message-builder';

describe('Admin Zalo system messages', () => {
  const at = '2026-09-29T12:28:35.000Z';

  it('keeps update notices compact and omits changelog details', () => {
    const result = buildUpdateAvailableMessage({
      currentVersion: 'v2.8.1', latestVersion: 'v2.8.2',
      checkedAt: at, details: ['Long internal changelog'],
    });
    expect(result.message).toBe(
      '📢 CÓ BẢN CẬP NHẬT MỚI\n\nHiện tại: v2.8.1\nPhiên bản mới: v2.8.2\n🕒 19:28 • 29/09/2026',
    );
  });

  it('puts the minute-level timestamp last on success and overload alerts', () => {
    expect(buildUpdateSuccessMessage({ fromVersion: 'v2.8.1', toVersion: 'v2.8.2', updatedAt: at }).message)
      .toContain('v2.8.1 → v2.8.2\nHệ thống hoạt động bình thường.\n🕒 19:28 • 29/09/2026');
    expect(buildServerOverloadAlertMessage({ currentRps: 18, suspiciousIpCount: 32, detectedAt: at }).message)
      .toContain('RPS: 18 • IP: 32\nPhát hiện lưu lượng bất thường.\n➡️ Kiểm tra hệ thống.\n🕒 19:28 • 29/09/2026');
  });
});
