import { Controller, Get, Query, Res, UseGuards, Param } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ExportService } from './export/export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../shared/guards/permissions.guard';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('finance.read')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ExportService,
    private readonly cls: ClsService,
    private readonly prisma: PrismaService
  ) {}

  private async getTenantId() {
    const userId = this.cls.get('userId');
    const user = await this.prisma.user.findUnique({ where: { id: userId }});
    return user.tenantId;
  }

  @Get('cashflow')
  @ApiOperation({ summary: 'Get Cashflow Report' })
  async getCashFlow() {
    const tenantId = await this.getTenantId();
    return await this.reportsService.getCashFlow(tenantId);
  }

  @Get('profit-loss')
  @ApiOperation({ summary: 'Get Profit & Loss Report' })
  async getProfitLoss() {
    const tenantId = await this.getTenantId();
    return await this.reportsService.getProfitLoss(tenantId);
  }

  @Get('revenue-by-building')
  @ApiOperation({ summary: 'Get Revenue by Building Report' })
  async getRevenueByBuilding() {
    const tenantId = await this.getTenantId();
    return await this.reportsService.getRevenueByBuilding(tenantId);
  }

  @Get('revenue-by-room')
  @ApiOperation({ summary: 'Get Revenue by Room Report' })
  async getRevenueByRoom() {
    const tenantId = await this.getTenantId();
    return await this.reportsService.getRevenueByRoom(tenantId);
  }

  @Get('deposit-liability')
  @ApiOperation({ summary: 'Get Deposit Liability Report' })
  async getDepositLiability() {
    const tenantId = await this.getTenantId();
    return await this.reportsService.getDepositLiability(tenantId);
  }

  @Get('receivable-aging')
  @ApiOperation({ summary: 'Get Receivable Aging Report' })
  async getReceivableAging() {
    const tenantId = await this.getTenantId();
    return await this.reportsService.getReceivableAging(tenantId);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get(':type/export')
  @ApiOperation({ summary: 'Export Report' })
  async exportReport(
    @Param('type') type: string,
    @Query('format') format: string = 'xlsx',
    @Res() res: Response
  ) {
    const tenantId = await this.getTenantId();
    let data: any[];
    let title: string;

    switch (type) {
      case 'deposit-liability':
        data = await this.reportsService.getDepositLiability(tenantId);
        title = 'Deposit Liability Report';
        break;
      case 'receivable-aging':
        data = await this.reportsService.getReceivableAging(tenantId);
        title = 'Receivable Aging Report';
        break;
      case 'revenue-by-building':
        data = await this.reportsService.getRevenueByBuilding(tenantId);
        title = 'Revenue by Building';
        break;
      case 'revenue-by-room':
        data = await this.reportsService.getRevenueByRoom(tenantId);
        title = 'Revenue by Room';
        break;
      // Cashflow and P/L have nested structures, flattening them for simple export
      case 'cashflow':
        const cf = await this.reportsService.getCashFlow(tenantId);
        data = [{ Inflow: cf.totalInflow, Outflow: cf.totalOutflow, Net: cf.netCashFlow }];
        title = 'Cash Flow Summary';
        break;
      case 'profit-loss':
        const pl = await this.reportsService.getProfitLoss(tenantId);
        data = [{ Revenue: pl.revenue, Expenses: pl.expenses, NetProfit: pl.netProfit }];
        title = 'Profit & Loss Summary';
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid report type' });
    }

    const exportResult = await this.exportService.exportData(format.toLowerCase(), title, data);
    
    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report.${exportResult.extension}`);
    return res.send(exportResult.buffer);
  }
}
