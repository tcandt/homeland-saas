import { describe, it, expect } from 'vitest';
import {
  buildQrCropCandidates,
  fitIntoCanvas,
  isLikelyCccdQrPayload,
  normalizeVietnameseDate,
  parseCccdQrPayload,
} from './lib/utils/cccd-qr';
import { CCCD_LIVE_SCAN_CONFIG } from './lib/utils/cccd-camera';
import { shouldRecoverSessionFromUnauthorized } from './lib/api/auth-unauthorized-policy';
import { getLoginErrorMessage } from './lib/auth/login-errors';
import { getPasswordChangePromptKey, shouldShowPasswordChangePrompt } from './lib/auth/password-change-prompt';

describe('Web Workspace', () => {
  it('should pass a basic sanity check', () => {
    expect(1 + 1).toBe(2);
  });
});

describe('authentication error handling', () => {
  it('keeps expected authentication form errors out of session recovery', () => {
    expect(shouldRecoverSessionFromUnauthorized('/auth/login')).toBe(false);
    expect(shouldRecoverSessionFromUnauthorized('/auth/change-password', 'AUTH_INVALID_CREDENTIALS')).toBe(false);
    expect(shouldRecoverSessionFromUnauthorized('/auth/change-password', 'AUTH_TOKEN_EXPIRED')).toBe(true);
    expect(shouldRecoverSessionFromUnauthorized('/auth/refresh')).toBe(false);
    expect(shouldRecoverSessionFromUnauthorized('/auth/me')).toBe(true);
  });

  it('shows actionable Vietnamese login errors', () => {
    expect(getLoginErrorMessage({ status: 401, code: 'AUTH_INVALID_CREDENTIALS' }))
      .toBe('Tài khoản hoặc mật khẩu không chính xác.');
    expect(getLoginErrorMessage({ status: 401, code: 'AUTH_ACCOUNT_DISABLED' }))
      .toBe('Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.');
  });

  it('shows the temporary-password prompt until it is deferred or completed', () => {
    expect(getPasswordChangePromptKey('user-1')).toBe('homeland:password-change-deferred:user-1');
    expect(shouldShowPasswordChangePrompt(true, false, '/')).toBe(true);
    expect(shouldShowPasswordChangePrompt(true, true, '/')).toBe(false);
    expect(shouldShowPasswordChangePrompt(false, false, '/')).toBe(false);
    expect(shouldShowPasswordChangePrompt(true, false, '/change-password')).toBe(false);
  });
});

describe('CCCD QR utilities', () => {
  it('parses a complete CCCD payload', () => {
    const result = parseCccdQrPayload('012345678901|123456789|NGUYỄN VĂN A|25121995|Nam|Số 1, Hà Nội|25122021');
    expect(result).toMatchObject({ citizenId: '012345678901', fullName: 'NGUYỄN VĂN A', birthDate: '1995-12-25', gender: 'Nam' });
  });

  it('preserves indexes when the old ID is empty', () => {
    const result = parseCccdQrPayload('012345678901||NGUYỄN THỊ B|01/02/1990|Nữ|Đà Nẵng|01012022');
    expect(result).toMatchObject({ citizenId: '012345678901', fullName: 'NGUYỄN THỊ B', birthDate: '1990-02-01', gender: 'Nữ', address: 'Đà Nẵng' });
  });

  it('normalizes female exactly and rejects unrelated QR values', () => {
    expect(parseCccdQrPayload('012345678901||JANE DOE|01011990|female|Hà Nội|')?.gender).toBe('Nữ');
    expect(isLikelyCccdQrPayload('https://example.com/random')).toBe(false);
    expect(isLikelyCccdQrPayload('hello world')).toBe(false);
  });

  it('normalizes compact and slash dates', () => {
    expect(normalizeVietnameseDate('25121995')).toBe('1995-12-25');
    expect(normalizeVietnameseDate('25/12/1995')).toBe('1995-12-25');
  });

  it('parses JSON CCCD payloads through the shared parser', () => {
    const result = parseCccdQrPayload(JSON.stringify({
      fullName: 'NGUY\u00e1\u00bb\u201eN V\u00c4\u201aN A',
      citizenId: '012345678901',
      birthDate: '25/12/1995',
      gender: 'female',
      address: 'H\u00c3\u00a0 N\u00e1\u00bb\u2122i',
      nationality: 'Vi\u00e1\u00bb\u2021t Nam',
    }));

    expect(result).toMatchObject({
      fullName: 'NGUY\u00e1\u00bb\u201eN V\u00c4\u201aN A',
      citizenId: '012345678901',
      birthDate: '1995-12-25',
      gender: 'Nữ',
      address: 'H\u00c3\u00a0 N\u00e1\u00bb\u2122i',
    });
  });

  it('builds bounded, unique crops at all requested scales and corners', () => {
    const crops = buildQrCropCandidates(1000, 800);
    expect(crops[0]).toEqual({ x: 0, y: 0, width: 1000, height: 800 });
    for (const scale of [0.25, 0.33, 0.4, 0.5, 0.65]) {
      expect(crops.some((crop) => crop.width === Math.round(1000 * scale) && crop.height === Math.round(800 * scale))).toBe(true);
    }
    expect(crops.some((crop) => crop.x === 0 && crop.y === 0 && crop.width === 250)).toBe(true);
    expect(crops.some((crop) => crop.x === 750 && crop.y === 600 && crop.width === 250)).toBe(true);
    expect(crops.every((crop) => crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= 1000 && crop.y + crop.height <= 800)).toBe(true);
    expect(new Set(crops.map((crop) => `${crop.x}:${crop.y}:${crop.width}:${crop.height}`)).size).toBe(crops.length);
  });

  it('upscales small QR crops without exceeding the maximum dimension', () => {
    expect(fitIntoCanvas(150, 150)).toMatchObject({ width: 800, height: 800 });
    const large = fitIntoCanvas(4000, 3000);
    expect(Math.max(large.width, large.height)).toBe(2000);
  });

  it('uses a square QR-only live camera region at 10 FPS', () => {
    expect(CCCD_LIVE_SCAN_CONFIG.disableFlip).toBe(false);
    expect(CCCD_LIVE_SCAN_CONFIG.fps).toBe(10);
    expect(typeof CCCD_LIVE_SCAN_CONFIG.qrbox).toBe('function');
    const qrbox = (CCCD_LIVE_SCAN_CONFIG.qrbox as (width: number, height: number) => { width: number; height: number })(430, 700);
    expect(qrbox.width).toBe(qrbox.height);
    expect(qrbox.width).toBe(Math.floor(430 * 0.46));
  });
});
