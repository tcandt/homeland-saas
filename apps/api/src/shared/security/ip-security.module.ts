import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IpSecurityService } from './ip-security.service';
import { GeoIpGuard } from './geo-ip.guard';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [IpSecurityService, GeoIpGuard],
  exports: [IpSecurityService, GeoIpGuard],
})
export class IpSecurityModule {}
