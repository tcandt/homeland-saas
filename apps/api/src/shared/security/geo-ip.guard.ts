import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IpSecurityService } from './ip-security.service';

@Injectable()
export class GeoIpGuard implements CanActivate {
  private readonly logger = new Logger(GeoIpGuard.name);

  constructor(
    private readonly ipSecurityService: IpSecurityService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Nếu tính năng bị tắt qua biến môi trường (mặc định BẬT bảo vệ)
    const isGeoBlockEnabled = this.configService.get<string>('ENABLE_GEO_IP_BLOCK') !== 'false';
    if (!isGeoBlockEnabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const path = request?.url || '';

    // Bỏ qua các endpoint công khai không cần chặn GeoIP (Health Check, Webhook thanh toán/Zalo)
    if (
      path.includes('/health') ||
      path.includes('/metrics') ||
      path.includes('/webhook') ||
      path.includes('/payments/webhook') ||
      path.includes('/communication/webhook')
    ) {
      return true;
    }

    const clientIp = this.ipSecurityService.extractClientIp(request);

    // Kiểm tra xem IP có hợp lệ (thuộc Việt Nam hoặc mạng nội bộ)
    const isAllowed = this.ipSecurityService.isVietnamIp(request, clientIp);
    if (!isAllowed) {
      this.logger.warn(`🚫 Blocked foreign IP access: ${clientIp} to ${path}`);
      throw new ForbiddenException({
        code: 'GEO_IP_BLOCKED',
        message: 'Truy cập bị từ chối: Hệ thống giới hạn chỉ cho phép truy cập từ địa chỉ IP Việt Nam.',
      });
    }

    return true;
  }
}
