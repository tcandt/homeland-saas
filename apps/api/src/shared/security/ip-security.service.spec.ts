import { describe, it, expect, beforeEach } from 'vitest';
import { IpSecurityService } from './ip-security.service';
import { ForbiddenException } from '@nestjs/common';

describe('IpSecurityService', () => {
  let service: IpSecurityService;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      get: (key: string) => {
        if (key === 'SECURITY_IP_WHITELIST') return '1.2.3.4,5.6.7.8';
        return null;
      },
    };
    service = new IpSecurityService(mockConfigService);
  });

  describe('extractClientIp', () => {
    it('extracts IP from cf-connecting-ip', () => {
      const req = { headers: { 'cf-connecting-ip': '113.161.0.1' } };
      expect(service.extractClientIp(req)).toBe('113.161.0.1');
    });

    it('extracts first IP from x-forwarded-for', () => {
      const req = { headers: { 'x-forwarded-for': '14.162.0.1, 10.0.0.1' } };
      expect(service.extractClientIp(req)).toBe('14.162.0.1');
    });
  });

  describe('isPrivateOrLocalIp', () => {
    it('detects localhost and private RFC 1918 ranges', () => {
      expect(service.isPrivateOrLocalIp('127.0.0.1')).toBe(true);
      expect(service.isPrivateOrLocalIp('::1')).toBe(true);
      expect(service.isPrivateOrLocalIp('192.168.1.10')).toBe(true);
      expect(service.isPrivateOrLocalIp('10.0.0.5')).toBe(true);
      expect(service.isPrivateOrLocalIp('172.16.0.1')).toBe(true);

      expect(service.isPrivateOrLocalIp('113.161.0.1')).toBe(false);
      expect(service.isPrivateOrLocalIp('8.8.8.8')).toBe(false);
    });
  });

  describe('isVietnamIp', () => {
    it('allows private/local IPs', () => {
      const req = { headers: {} };
      expect(service.isVietnamIp(req, '127.0.0.1')).toBe(true);
    });

    it('allows VN country header', () => {
      const req = { headers: { 'cf-ipcountry': 'VN' } };
      expect(service.isVietnamIp(req, '113.161.0.1')).toBe(true);
    });

    it('rejects foreign country header (e.g. US, CN, RU)', () => {
      const reqUs = { headers: { 'cf-ipcountry': 'US' } };
      expect(service.isVietnamIp(reqUs, '8.8.8.8')).toBe(false);

      const reqCn = { headers: { 'cloudfront-viewer-country': 'CN' } };
      expect(service.isVietnamIp(reqCn, '1.1.1.1')).toBe(false);
    });
  });

  describe('Brute-force password lockout (5 failed attempts)', () => {
    const testIp = '113.161.99.88';

    it('does not block IP on 1 to 4 failed attempts', () => {
      service.recordFailedAttempt(testIp);
      service.recordFailedAttempt(testIp);
      service.recordFailedAttempt(testIp);
      service.recordFailedAttempt(testIp);

      expect(() => service.checkIpBlocked(testIp)).not.toThrow();
    });

    it('blocks IP immediately when reaching 5 failed attempts', () => {
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt(testIp);
      }

      expect(() => service.checkIpBlocked(testIp)).toThrow(ForbiddenException);
    });

    it('resets counter on successful login', () => {
      service.recordFailedAttempt(testIp);
      service.recordFailedAttempt(testIp);
      service.recordFailedAttempt(testIp);

      service.resetFailedAttempts(testIp);

      expect(() => service.checkIpBlocked(testIp)).not.toThrow();
    });
  });
});
