import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly cls: ClsService,
    private readonly prisma: PrismaService
  ) {}

  private async getTenantId() {
    const userId = this.cls.get('userId');
    const user = await this.prisma.user.findUnique({ where: { id: userId }});
    return user.tenantId;
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get Revenue Analytics' })
  async getRevenue() {
    const tenantId = await this.getTenantId();
    return await this.analyticsService.getRevenueAnalytics(tenantId);
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Get Occupancy Analytics' })
  async getOccupancy() {
    const tenantId = await this.getTenantId();
    return await this.analyticsService.getOccupancyAnalytics(tenantId);
  }

  @Get('debt')
  @ApiOperation({ summary: 'Get Debt Analytics' })
  async getDebt() {
    const tenantId = await this.getTenantId();
    return await this.analyticsService.getDebtAnalytics(tenantId);
  }

  @Get('finance')
  @ApiOperation({ summary: 'Get Finance Analytics' })
  async getFinance() {
    const tenantId = await this.getTenantId();
    return await this.analyticsService.getFinanceAnalytics(tenantId);
  }
}
