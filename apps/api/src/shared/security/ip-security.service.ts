import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IpAttemptRecord {
  count: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
  blockedUntil?: number;
}

@Injectable()
export class IpSecurityService {
  private readonly logger = new Logger(IpSecurityService.name);

  // Lưu vết số lần đăng nhập sai theo IP (in-memory)
  private readonly failedAttempts = new Map<string, IpAttemptRecord>();

  // Cấu hình giới hạn
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10 phút
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // Khóa 15 phút

  constructor(private readonly configService: ConfigService) {
    // Tự động dọn dẹp các IP đã hết hạn sau mỗi 10 phút
    setInterval(() => this.cleanupExpiredRecords(), 10 * 60 * 1000);
  }

  /**
   * Trích xuất địa chỉ IP thực của client từ Request
   */
  extractClientIp(req: any): string {
    if (!req) return '127.0.0.1';

    const cfIp = req.headers?.['cf-connecting-ip'];
    if (cfIp) return String(cfIp).trim();

    const xRealIp = req.headers?.['x-real-ip'];
    if (xRealIp) return String(xRealIp).trim();

    const xForwardedFor = req.headers?.['x-forwarded-for'];
    if (xForwardedFor) {
      const parts = String(xForwardedFor).split(',');
      if (parts.length > 0 && parts[0].trim()) {
        return parts[0].trim();
      }
    }

    const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip;
    return String(socketIp || '127.0.0.1').replace(/^::ffff:/, '').trim();
  }

  /**
   * Kiểm tra xem IP có phải là IP nội bộ / Localhost không
   */
  isPrivateOrLocalIp(ip: string): boolean {
    const cleanIp = ip.replace(/^::ffff:/, '').trim();

    if (
      cleanIp === '127.0.0.1' ||
      cleanIp === '::1' ||
      cleanIp === 'localhost' ||
      cleanIp === '0.0.0.0'
    ) {
      return true;
    }

    // 10.0.0.0 - 10.255.255.255
    if (cleanIp.startsWith('10.')) return true;

    // 192.168.0.0 - 192.168.255.255
    if (cleanIp.startsWith('192.168.')) return true;

    // 172.16.0.0 - 172.31.255.255
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp)) return true;

    // Carrier-grade NAT (100.64.0.0/10)
    if (/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(cleanIp)) return true;

    // IPv6 Unique Local / Link-local (fc00::/7, fe80::/10)
    if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd') || cleanIp.startsWith('fe80')) return true;

    return false;
  }

  /**
   * Kiểm tra IP có xuất xứ từ Việt Nam hay không
   */
  isVietnamIp(req: any, clientIp: string): boolean {
    // Luôn cho phép IP nội bộ / Localhost (phục vụ dev, docker, cluster nội bộ)
    if (this.isPrivateOrLocalIp(clientIp)) {
      return true;
    }

    // Kiểm tra Header từ Reverse Proxy / CDN (Cloudflare, AWS CloudFront, Nginx GeoIP)
    const headers = req?.headers || {};
    const countryHeader =
      headers['cf-ipcountry'] ||
      headers['cloudfront-viewer-country'] ||
      headers['x-country-code'] ||
      headers['x-geoip-country'];

    if (countryHeader) {
      const countryCode = String(countryHeader).toUpperCase().trim();
      // Nếu có header xác thực quốc gia: Chỉ cho phép VN (hoặc XX/T1 dùng cho mạng nội bộ/tor test nếu whitelist)
      return countryCode === 'VN';
    }

    // Nếu không có header CDN (môi trường trực tiếp), kiểm tra whitelist cấu hình
    const ipWhitelist = this.configService.get<string>('SECURITY_IP_WHITELIST') || '';
    if (ipWhitelist) {
      const allowedList = ipWhitelist.split(',').map((s) => s.trim());
      if (allowedList.includes(clientIp)) return true;
    }

    // Mặc định cho phép nếu chưa qua CDN xác định hoặc có cấu hình bật/tắt
    return true;
  }

  /**
   * Kiểm tra xem IP có đang bị tạm khóa do nhập sai mật khẩu quá 5 lần không
   */
  checkIpBlocked(ip: string): void {
    if (!ip || this.isPrivateOrLocalIp(ip)) {
      return; // Không khóa IP loopback trong quá trình test
    }

    const record = this.failedAttempts.get(ip);
    if (!record) return;

    const now = Date.now();
    if (record.blockedUntil && record.blockedUntil > now) {
      const remainingMinutes = Math.ceil((record.blockedUntil - now) / 60000);
      this.logger.warn(`Blocked IP ${ip} attempted to access. Remaining lock time: ${remainingMinutes}m.`);
      
      throw new ForbiddenException({
        code: 'AUTH_IP_TEMPORARILY_BLOCKED',
        message: `Địa chỉ IP của bạn tạm thời bị khóa do nhập sai mật khẩu quá 5 lần liên tiếp. Vui lòng thử lại sau ${remainingMinutes} phút.`,
        remainingMinutes,
      });
    }

    // Nếu đã qua thời gian khóa, tự động mở khóa
    if (record.blockedUntil && record.blockedUntil <= now) {
      this.failedAttempts.delete(ip);
    }
  }

  /**
   * Ghi nhận 1 lần đăng nhập sai mật khẩu từ IP
   */
  recordFailedAttempt(ip: string): void {
    if (!ip) return;

    const now = Date.now();
    const record = this.failedAttempts.get(ip);

    if (!record) {
      this.failedAttempts.set(ip, {
        count: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      });
      return;
    }

    // Nếu quá khung thời gian 10 phút, reset đếm lại từ 1
    if (now - record.firstAttemptAt > this.ATTEMPT_WINDOW_MS) {
      record.count = 1;
      record.firstAttemptAt = now;
      record.lastAttemptAt = now;
      delete record.blockedUntil;
      return;
    }

    record.count += 1;
    record.lastAttemptAt = now;

    // Nếu đạt ngưỡng 5 lần -> Khóa IP ngay lập tức
    if (record.count >= this.MAX_FAILED_ATTEMPTS) {
      record.blockedUntil = now + this.LOCKOUT_DURATION_MS;
      this.logger.error(
        `🚨 SECURITY ALERT: IP ${ip} has entered wrong password ${record.count} times. IP IS LOCKED for 15 minutes!`,
      );
    }
  }

  /**
   * Xóa vết đăng nhập sai khi người dùng đăng nhập thành công
   */
  resetFailedAttempts(ip: string): void {
    if (!ip) return;
    this.failedAttempts.delete(ip);
  }

  /**
   * Dọn dẹp bộ nhớ
   */
  private cleanupExpiredRecords(): void {
    const now = Date.now();
    for (const [ip, record] of this.failedAttempts.entries()) {
      if (record.blockedUntil && record.blockedUntil <= now) {
        this.failedAttempts.delete(ip);
      } else if (!record.blockedUntil && now - record.lastAttemptAt > this.ATTEMPT_WINDOW_MS) {
        this.failedAttempts.delete(ip);
      }
    }
  }
}
